import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { resolveWorkflowActor } from '../workflow/actors.js'
import { effectivePortalStatus, isClientAccessible } from '../portal/access.js'
import { PORTAL_ACCESS_REASON, PORTAL_STATUS } from '../portal/types.js'
import { appendInteractionActivity, getInteractionActivity } from './activity.js'
import { emitInteractionEvent } from './events.js'
import {
  clientCanCreateInteraction,
  clientCanViewInteraction,
  studioCanAcknowledgeInteraction,
  studioCanResolveInteraction,
  studioCanViewInteraction,
} from './permissions.js'
import {
  assertClientSafeInteraction,
  presentClientInteraction,
  presentStudioInteraction,
  presentUnavailableInteractions,
} from './projection.js'
import { listBlockTargets, resolveBlockReference } from './references.js'
import { resolveInteractionPortal, resolveInteractionProposal } from './resolvers.js'
import {
  isWellFormedId,
  makeInteractionRecord,
  normalizeBlockLabel,
  normalizeMessage,
  requireWellFormedId,
} from './schema.js'
import {
  findInteractionRecord,
  insertInteractionRecord,
  listInteractionsForCompany,
  listInteractionsForPortal,
  listInteractionsForProposal,
  replaceInteractionRecord,
} from './store.js'
import { assertInteractionTransition } from './transitions.js'
import {
  INTERACTION_EVENT,
  INTERACTION_SOURCE,
  INTERACTION_STATUS,
  INTERACTION_STATUSES,
  INTERACTION_TYPE,
  INTERACTION_TYPES,
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

function stamp(record) {
  return { ...record, updatedAt: new Date().toISOString() }
}

function save(record) {
  const next = makeInteractionRecord(stamp(record))
  const existing = findInteractionRecord(next.id)
  if (existing) replaceInteractionRecord(existing.id, { ...next, id: existing.id })
  else insertInteractionRecord(next)
  return makeInteractionRecord(findInteractionRecord(next.id))
}

function recordEvent(record, actor, type, payload = {}) {
  const { record: next, event } = appendInteractionActivity(record, {
    type,
    actorId: actor?.id ?? '',
    actorName: actor?.name ?? '',
    payload,
    from: payload.from ?? null,
    to: payload.to ?? null,
  })
  emitInteractionEvent(event)
  return next
}

function denyClient(reason, message, { notFound = false } = {}) {
  const error = notFound ? new NotFoundError(message) : new ForbiddenError(message)
  error.reason = reason
  error.unavailable = presentUnavailableInteractions(reason, message)
  throw error
}

function loadPortalOrDeny(portalId) {
  const id = String(portalId ?? '').trim()
  if (!id || !isWellFormedId(id)) {
    denyClient(PORTAL_ACCESS_REASON.UNKNOWN, 'This proposal is not available.', { notFound: true })
  }
  const record = resolveInteractionPortal(id)
  if (!record) {
    denyClient(PORTAL_ACCESS_REASON.UNKNOWN, 'This proposal is not available.', { notFound: true })
  }
  return record
}

function assertPublishedPortal(portal, now = Date.now()) {
  const status = effectivePortalStatus(portal, now)
  if (status === PORTAL_STATUS.DRAFT) {
    denyClient(PORTAL_ACCESS_REASON.UNPUBLISHED, 'This proposal is not available.', {
      notFound: true,
    })
  }
  if (status === PORTAL_STATUS.REVOKED) {
    denyClient(PORTAL_ACCESS_REASON.REVOKED, 'This proposal is no longer available.')
  }
  if (status === PORTAL_STATUS.EXPIRED) {
    denyClient(PORTAL_ACCESS_REASON.EXPIRED, 'This proposal link has expired.')
  }
  if (!isClientAccessible(portal, now)) {
    denyClient(PORTAL_ACCESS_REASON.UNPUBLISHED, 'This proposal is not available.')
  }
  return status
}

function blockMissingFor(record) {
  if (!record?.blockId) return false
  const proposal = resolveInteractionProposal(record.proposalId, record.companyId)
  return resolveBlockReference(proposal, record.blockId).missing
}

function presentClientListItem(record) {
  return presentClientInteraction(record, { blockMissing: blockMissingFor(record) })
}

function presentStudioListItem(record) {
  return presentStudioInteraction(record, { blockMissing: blockMissingFor(record) })
}

export function listClientInteractions({ portalId, now } = {}) {
  const portal = loadPortalOrDeny(portalId)
  assertPublishedPortal(portal, now)
  if (!clientCanViewInteraction(portal, now)) {
    denyClient(PORTAL_ACCESS_REASON.UNPUBLISHED, 'This proposal is not available.')
  }

  const interactions = listInteractionsForPortal(portal.id)
    .filter((item) => item.source === INTERACTION_SOURCE.CLIENT)
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    .map((item) => presentClientListItem(item))

  const proposal = resolveInteractionProposal(portal.proposalId, portal.companyId)
  const targets = listBlockTargets(proposal)

  return {
    portal: {
      portalId: portal.id,
      proposalId: portal.proposalId,
      status: effectivePortalStatus(portal, now),
    },
    interactions,
    targets,
  }
}

export function createClientInteraction({
  portalId,
  type,
  message,
  blockId,
  proposalId,
  companyId,
  now,
} = {}) {
  const portal = loadPortalOrDeny(portalId)
  assertPublishedPortal(portal, now)
  if (!clientCanCreateInteraction(portal, now)) {
    denyClient(PORTAL_ACCESS_REASON.UNPUBLISHED, 'This proposal is not available.')
  }

  if (companyId != null && String(companyId).trim() && String(companyId).trim() !== portal.companyId) {
    denyClient(PORTAL_ACCESS_REASON.COMPANY_MISMATCH, 'This proposal is not available.')
  }

  if (proposalId != null && String(proposalId).trim() && String(proposalId).trim() !== portal.proposalId) {
    throw new ValidationError('The proposal does not match this portal.', [
      { field: 'proposalId', message: 'proposalId does not match the portal.' },
    ])
  }

  if (!INTERACTION_TYPES.includes(type)) {
    throw new ValidationError('A valid interaction type is required.', [
      { field: 'type', message: 'type is not a supported interaction type.' },
    ])
  }

  const requiredMessage = type !== INTERACTION_TYPE.APPROVAL
  const text =
    type === INTERACTION_TYPE.APPROVAL
      ? normalizeMessage(message || 'Approved.', { required: false }) || 'Approved.'
      : normalizeMessage(message, { required: requiredMessage })

  const proposal = resolveInteractionProposal(portal.proposalId, portal.companyId)
  const reference = resolveBlockReference(
    proposal,
    blockId && isWellFormedId(String(blockId).trim()) ? String(blockId).trim() : '',
  )

  const guest = { id: '', name: 'Client', companyId: portal.companyId }
  let record = makeInteractionRecord({
    companyId: portal.companyId,
    portalId: portal.id,
    proposalId: portal.proposalId,
    type,
    status: INTERACTION_STATUS.OPEN,
    source: INTERACTION_SOURCE.CLIENT,
    actorId: '',
    actorName: 'Client',
    message: text,
    blockId: reference.blockId,
    blockLabel: normalizeBlockLabel(reference.blockLabel),
  })
  record = recordEvent(record, guest, INTERACTION_EVENT.CREATED, {
    type,
    portalId: portal.id,
    proposalId: portal.proposalId,
  })
  const saved = save(record)
  const view = presentClientListItem(saved)
  if (!assertClientSafeInteraction(view)) {
    throw new Error('Client interaction projection leaked internal fields.')
  }
  return view
}

export function listStudioInteractions({
  companyId,
  proposalId,
  portalId,
  status,
  actor,
} = {}) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewInteraction(user)) {
    throw new ForbiddenError('You do not have permission to view interactions.')
  }

  let list
  if (proposalId) {
    const pid = requireWellFormedId(proposalId, 'proposalId')
    list = listInteractionsForProposal(scoped, pid)
  } else if (portalId) {
    const id = requireWellFormedId(portalId, 'portalId')
    list = listInteractionsForPortal(id).filter((item) => item.companyId === scoped)
  } else {
    list = listInteractionsForCompany(scoped)
  }

  if (status) {
    if (!INTERACTION_STATUSES.includes(status)) {
      throw new ValidationError('A valid status is required.', [
        { field: 'status', message: 'status is not a supported interaction status.' },
      ])
    }
    list = list.filter((item) => item.status === status)
  }

  return list
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((item) => presentStudioListItem(item))
}

function loadOwnedInteraction(companyId, interactionId, actor) {
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  const id = requireWellFormedId(interactionId, 'interactionId')
  const record = findInteractionRecord(id)
  if (!record || record.companyId !== scoped) {
    throw new NotFoundError('Interaction not found.')
  }
  return { record, user, scoped }
}

export function getStudioInteraction({ companyId, interactionId, actor } = {}) {
  const { record, user } = loadOwnedInteraction(companyId, interactionId, actor)
  if (!studioCanViewInteraction(user)) {
    throw new ForbiddenError('You do not have permission to view this interaction.')
  }
  return presentStudioListItem(record)
}

export function acknowledgeInteraction({ companyId, interactionId, actor } = {}) {
  const { record, user } = loadOwnedInteraction(companyId, interactionId, actor)
  if (!studioCanAcknowledgeInteraction(user)) {
    throw new ForbiddenError('You do not have permission to acknowledge this interaction.')
  }
  assertInteractionTransition(record.status, INTERACTION_STATUS.ACKNOWLEDGED)
  const acknowledgedAt = new Date().toISOString()
  let next = {
    ...record,
    status: INTERACTION_STATUS.ACKNOWLEDGED,
    acknowledgedAt,
    acknowledgedBy: user.id,
  }
  next = recordEvent(next, user, INTERACTION_EVENT.ACKNOWLEDGED, {
    from: record.status,
    to: INTERACTION_STATUS.ACKNOWLEDGED,
  })
  return presentStudioListItem(save(next))
}

export function resolveInteraction({ companyId, interactionId, actor } = {}) {
  const { record, user } = loadOwnedInteraction(companyId, interactionId, actor)
  if (!studioCanResolveInteraction(user)) {
    throw new ForbiddenError('You do not have permission to resolve this interaction.')
  }
  assertInteractionTransition(record.status, INTERACTION_STATUS.RESOLVED)
  const resolvedAt = new Date().toISOString()
  let next = {
    ...record,
    status: INTERACTION_STATUS.RESOLVED,
    resolvedAt,
    resolvedBy: user.id,
    acknowledgedAt: record.acknowledgedAt || resolvedAt,
    acknowledgedBy: record.acknowledgedBy || user.id,
  }
  next = recordEvent(next, user, INTERACTION_EVENT.RESOLVED, {
    from: record.status,
    to: INTERACTION_STATUS.RESOLVED,
  })
  return presentStudioListItem(save(next))
}

export function getInteractionActivityForRecord(record) {
  return getInteractionActivity(record)
}

export function mutateClientInteraction() {
  throw new ForbiddenError('Clients cannot edit submitted interactions.')
}

export function deleteClientInteraction() {
  throw new ForbiddenError('Clients cannot delete submitted interactions.')
}

export function mutateClientInteractionStatus() {
  throw new ForbiddenError('Clients cannot change interaction status.')
}
