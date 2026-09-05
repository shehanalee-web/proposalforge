import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { resolveWorkflowActor } from '../workflow/actors.js'
import { emitFollowupEvent } from './events.js'
import {
  resolveFollowupInteractions,
  resolveFollowupPortal,
  resolveFollowupProposal,
  resolveFollowupProposals,
  resolveFollowupWorkflow,
} from './lookups.js'
import { addMs, clockOf, isFollowupOverdue, toIso } from './policy.js'
import { FOLLOWUP_POLICY } from './policy.js'
import { studioCanMutateFollowup, studioCanViewFollowup } from './permissions.js'
import { followupSignalKey } from './reasons.js'
import { evaluateFollowupSignals } from './resolver.js'
import {
  makeFollowupRecord,
  normalizeFollowupDescription,
  normalizeFollowupTitle,
  requireWellFormedId,
} from './schema.js'
import { isOpenFollowupStatus, isTerminalFollowupStatus } from './statuses.js'
import {
  compareFollowups,
  getNextFollowupAction,
  presentFollowupSignal,
  presentStudioFollowup,
  summarizeFollowupQueue,
} from './summary.js'
import {
  findFollowupRecord,
  insertFollowupRecord,
  listFollowupsForCompany,
  listFollowupsForProposal,
  replaceFollowupRecord,
} from './store.js'
import { assertFollowupTransition } from './transitions.js'
import {
  FOLLOWUP_EVENT,
  FOLLOWUP_REASON,
  FOLLOWUP_REASONS,
  FOLLOWUP_SOURCE,
  FOLLOWUP_STATUS,
  FOLLOWUP_STATUSES,
} from './types.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function actorOf(input) {
  return resolveWorkflowActor(input)
}

function assertCompanyActor(actor, companyId) {
  if (actor.companyId !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function stamp(record, now) {
  return { ...record, updatedAt: toIso(now, new Date().toISOString()) }
}

function save(record) {
  const next = makeFollowupRecord(record)
  const existing = findFollowupRecord(next.id)
  if (existing) replaceFollowupRecord(existing.id, { ...next, id: existing.id })
  else insertFollowupRecord(next)
  return makeFollowupRecord(findFollowupRecord(next.id))
}

function loadOwnedFollowup(companyId, followupId, actor) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  const id = requireWellFormedId(followupId, 'followupId')
  const record = findFollowupRecord(id)
  if (!record || record.companyId !== scoped) {
    throw new NotFoundError('Follow-up not found.')
  }
  return { record, user, scoped }
}

function contextForProposal(companyId, proposalId) {
  const proposal = resolveFollowupProposal(proposalId, companyId)
  if (!proposal) return null
  return {
    proposal,
    workflow: resolveFollowupWorkflow(companyId, proposalId),
    portal: resolveFollowupPortal(companyId, proposalId),
    interactions: resolveFollowupInteractions(companyId, proposalId),
  }
}

function existingKey(record) {
  return followupSignalKey(record.reason, record.reason === FOLLOWUP_REASON.OVERDUE_TASK ? record.sourceId : '')
}

function maybeNotifyDue(record, now) {
  if (!isOpenFollowupStatus(record.status) || !isFollowupOverdue(record.dueAt, now)) return
  emitFollowupEvent({
    type: FOLLOWUP_EVENT.DUE,
    proposalId: record.proposalId,
    title: record.title,
    description: record.description,
  })
}

export function listFollowupSignals({ companyId, proposalId, actor, now } = {}) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewFollowup(user)) {
    throw new ForbiddenError('You do not have permission to view follow-ups.')
  }
  const pid = requireWellFormedId(proposalId, 'proposalId')
  const context = contextForProposal(scoped, pid)
  if (!context) {
    throw new NotFoundError('Proposal not found.')
  }
  return evaluateFollowupSignals({ ...context, now }).map((item) => presentFollowupSignal(item))
}

export function syncFollowupsForProposal({ companyId, proposalId, actor, now } = {}) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewFollowup(user)) {
    throw new ForbiddenError('You do not have permission to view follow-ups.')
  }
  const pid = requireWellFormedId(proposalId, 'proposalId')
  const context = contextForProposal(scoped, pid)
  if (!context) {
    throw new NotFoundError('Proposal not found.')
  }

  const clock = clockOf(now)
  const signals = evaluateFollowupSignals({ ...context, now: clock })
  const existing = listFollowupsForProposal(scoped, pid)
  const signalKeys = new Set(signals.map((item) => item.signalKey))

  for (const record of existing) {
    if (!isOpenFollowupStatus(record.status)) continue
    if (record.reason === FOLLOWUP_REASON.MANUAL) continue
    const key = existingKey(record)
    if (!signalKeys.has(key)) {
      save(
        stamp(
          {
            ...record,
            status: FOLLOWUP_STATUS.COMPLETED,
            completedAt: toIso(clock),
          },
          clock,
        ),
      )
      emitFollowupEvent({
        type: FOLLOWUP_EVENT.SIGNAL_RESOLVED,
        proposalId: pid,
        title: record.title,
      })
    }
  }

  const remaining = listFollowupsForProposal(scoped, pid)
  for (const item of signals) {
    const openMatch = remaining.find(
      (record) => isOpenFollowupStatus(record.status) && existingKey(record) === item.signalKey,
    )
    if (openMatch) continue
    const historical = remaining.find(
      (record) => isTerminalFollowupStatus(record.status) && existingKey(record) === item.signalKey,
    )
    if (historical) continue
    const created = save(
      makeFollowupRecord({
        companyId: scoped,
        proposalId: pid,
        ownerActorId: item.ownerActorId || user.id,
        reason: item.reason,
        title: item.title,
        description: item.description,
        priority: item.priority,
        status: FOLLOWUP_STATUS.OPEN,
        dueAt: item.dueAt,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
      }),
    )
    maybeNotifyDue(created, clock)
  }

  return listFollowupsForProposal(scoped, pid)
}

export function syncFollowupsForCompany({ companyId, actor, now } = {}) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewFollowup(user)) {
    throw new ForbiddenError('You do not have permission to view follow-ups.')
  }
  const proposals = resolveFollowupProposals(scoped)
  for (const proposal of proposals) {
    const id = String(proposal?.id ?? '').trim()
    if (!id) continue
    syncFollowupsForProposal({ companyId: scoped, proposalId: id, actor: user, now })
  }
  return listFollowupsForCompany(scoped)
}

export function listStudioFollowups({
  companyId,
  proposalId,
  status,
  reason,
  actor,
  now,
  sync = true,
} = {}) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewFollowup(user)) {
    throw new ForbiddenError('You do not have permission to view follow-ups.')
  }

  if (sync) {
    if (proposalId) {
      syncFollowupsForProposal({ companyId: scoped, proposalId, actor: user, now })
    } else {
      syncFollowupsForCompany({ companyId: scoped, actor: user, now })
    }
  }

  let list = proposalId
    ? listFollowupsForProposal(scoped, requireWellFormedId(proposalId, 'proposalId'))
    : listFollowupsForCompany(scoped)

  if (status) {
    if (status === 'overdue') {
      list = list.filter(
        (item) => isOpenFollowupStatus(item.status) && isFollowupOverdue(item.dueAt, now),
      )
    } else {
      if (!FOLLOWUP_STATUSES.includes(status)) {
        throw new ValidationError('A valid status is required.', [
          { field: 'status', message: 'status is not a supported follow-up status.' },
        ])
      }
      list = list.filter((item) => item.status === status)
    }
  }

  if (reason) {
    if (!FOLLOWUP_REASONS.includes(reason)) {
      throw new ValidationError('A valid reason is required.', [
        { field: 'reason', message: 'reason is not a supported follow-up reason.' },
      ])
    }
    list = list.filter((item) => item.reason === reason)
  }

  return list
    .sort((left, right) => compareFollowups(left, right, now))
    .map((item) => {
      const view = presentStudioFollowup(item, now)
      const proposal = resolveFollowupProposal(item.proposalId, item.companyId)
      return { ...view, proposalTitle: proposal?.title || item.proposalId }
    })
}

export function getStudioFollowup({ companyId, followupId, actor, now } = {}) {
  const { record, user } = loadOwnedFollowup(companyId, followupId, actor)
  if (!studioCanViewFollowup(user)) {
    throw new ForbiddenError('You do not have permission to view this follow-up.')
  }
  return presentStudioFollowup(record, now)
}

export function getProposalFollowupView({ companyId, proposalId, actor, now } = {}) {
  const records = listStudioFollowups({
    companyId,
    proposalId,
    actor,
    now,
    sync: true,
  })
  return {
    followups: records,
    nextAction: getNextFollowupAction(records, now),
    summary: summarizeFollowupQueue(records, now),
  }
}

export function getCompanyFollowupOverview({ companyId, actor, now } = {}) {
  const followups = listStudioFollowups({ companyId, actor, now, sync: true })
  return {
    ...summarizeFollowupQueue(followups, now),
    followups,
  }
}

export function createManualFollowup({
  companyId,
  proposalId,
  actor,
  title,
  description,
  dueAt,
  ownerActorId,
  now,
} = {}) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanMutateFollowup(user)) {
    throw new ForbiddenError('You do not have permission to create a follow-up.')
  }
  const pid = requireWellFormedId(proposalId, 'proposalId')
  const proposal = resolveFollowupProposal(pid, scoped)
  if (!proposal) {
    throw new NotFoundError('Proposal not found.')
  }
  const workflow = resolveFollowupWorkflow(scoped, pid)
  const owner = String(ownerActorId ?? '').trim() || workflow?.ownerId || user.id
  const ownerActor = resolveWorkflowActor({ id: owner })
  if (ownerActor.companyId !== scoped) {
    throw new ForbiddenError('You cannot assign a follow-up to another company.')
  }
  const clock = clockOf(now)
  const record = save(
    makeFollowupRecord({
      companyId: scoped,
      proposalId: pid,
      ownerActorId: ownerActor.id,
      reason: FOLLOWUP_REASON.MANUAL,
      title: normalizeFollowupTitle(title || 'Follow up'),
      description: normalizeFollowupDescription(description),
      status: FOLLOWUP_STATUS.OPEN,
      dueAt: dueAt ? toIso(dueAt) : addMs(clock, FOLLOWUP_POLICY.manualDefaultDueMs),
      sourceType: FOLLOWUP_SOURCE.MANUAL,
      sourceId: pid,
    }),
  )
  emitFollowupEvent({
    type: FOLLOWUP_EVENT.CREATED,
    proposalId: pid,
    title: record.title,
  })
  maybeNotifyDue(record, clock)
  return presentStudioFollowup(record, clock)
}

export function startFollowup({ companyId, followupId, actor, now } = {}) {
  const { record, user } = loadOwnedFollowup(companyId, followupId, actor)
  if (!studioCanMutateFollowup(user)) {
    throw new ForbiddenError('You do not have permission to start this follow-up.')
  }
  assertFollowupTransition(record.status, FOLLOWUP_STATUS.IN_PROGRESS)
  const clock = clockOf(now)
  const next = save(
    stamp(
      {
        ...record,
        status: FOLLOWUP_STATUS.IN_PROGRESS,
      },
      clock,
    ),
  )
  emitFollowupEvent({ type: FOLLOWUP_EVENT.STARTED, proposalId: next.proposalId, title: next.title })
  return presentStudioFollowup(next, clock)
}

export function completeFollowup({ companyId, followupId, actor, now } = {}) {
  const { record, user } = loadOwnedFollowup(companyId, followupId, actor)
  if (!studioCanMutateFollowup(user)) {
    throw new ForbiddenError('You do not have permission to complete this follow-up.')
  }
  assertFollowupTransition(record.status, FOLLOWUP_STATUS.COMPLETED)
  const clock = clockOf(now)
  const next = save(
    stamp(
      {
        ...record,
        status: FOLLOWUP_STATUS.COMPLETED,
        completedAt: toIso(clock),
      },
      clock,
    ),
  )
  emitFollowupEvent({
    type: FOLLOWUP_EVENT.COMPLETED,
    proposalId: next.proposalId,
    title: next.title,
  })
  return presentStudioFollowup(next, clock)
}

export function dismissFollowup({ companyId, followupId, actor, now } = {}) {
  const { record, user } = loadOwnedFollowup(companyId, followupId, actor)
  if (!studioCanMutateFollowup(user)) {
    throw new ForbiddenError('You do not have permission to dismiss this follow-up.')
  }
  assertFollowupTransition(record.status, FOLLOWUP_STATUS.DISMISSED)
  const clock = clockOf(now)
  const next = save(
    stamp(
      {
        ...record,
        status: FOLLOWUP_STATUS.DISMISSED,
        dismissedAt: toIso(clock),
      },
      clock,
    ),
  )
  emitFollowupEvent({
    type: FOLLOWUP_EVENT.DISMISSED,
    proposalId: next.proposalId,
    title: next.title,
  })
  return presentStudioFollowup(next, clock)
}

export function assignFollowupOwner({ companyId, followupId, actor, ownerActorId, now } = {}) {
  const { record, user, scoped } = loadOwnedFollowup(companyId, followupId, actor)
  if (!studioCanMutateFollowup(user)) {
    throw new ForbiddenError('You do not have permission to assign this follow-up.')
  }
  if (isTerminalFollowupStatus(record.status)) {
    throw new ValidationError('A completed or dismissed follow-up cannot be assigned.', [
      { field: 'status', message: 'Follow-up is terminal.' },
    ])
  }
  const ownerId = String(ownerActorId ?? '').trim()
  let nextOwner = ''
  if (ownerId) {
    const owner = resolveWorkflowActor({ id: requireWellFormedId(ownerId, 'ownerActorId') })
    if (owner.companyId !== scoped) {
      throw new ForbiddenError('You cannot assign a follow-up to another company.')
    }
    nextOwner = owner.id
  }
  const clock = clockOf(now)
  const next = save(stamp({ ...record, ownerActorId: nextOwner }, clock))
  emitFollowupEvent({ type: FOLLOWUP_EVENT.ASSIGNED, proposalId: next.proposalId, title: next.title })
  return presentStudioFollowup(next, clock)
}

export function scheduleFollowup({ companyId, followupId, actor, dueAt, now } = {}) {
  const { record, user } = loadOwnedFollowup(companyId, followupId, actor)
  if (!studioCanMutateFollowup(user)) {
    throw new ForbiddenError('You do not have permission to schedule this follow-up.')
  }
  if (isTerminalFollowupStatus(record.status)) {
    throw new ValidationError('A completed or dismissed follow-up cannot be rescheduled.', [
      { field: 'status', message: 'Follow-up is terminal.' },
    ])
  }
  const nextDue = toIso(dueAt)
  if (!nextDue) {
    throw new ValidationError('A valid due date is required.', [
      { field: 'dueAt', message: 'dueAt is not a valid date.' },
    ])
  }
  const clock = clockOf(now)
  const next = save(stamp({ ...record, dueAt: nextDue }, clock))
  emitFollowupEvent({
    type: FOLLOWUP_EVENT.SCHEDULED,
    proposalId: next.proposalId,
    title: next.title,
  })
  return presentStudioFollowup(next, clock)
}

export function clientFollowupApiDenied() {
  throw new ForbiddenError('Follow-ups are studio-only.')
}
