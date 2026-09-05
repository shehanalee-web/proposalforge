import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { resolveWorkflowActor } from '../workflow/actors.js'
import { appendPortalActivity, getPortalActivity } from './activity.js'
import { effectivePortalStatus, isClientAccessible } from './access.js'
import { emitPortalEvent } from './events.js'
import { canCreatePortal, canPublishPortal, canReadPortal, canRevokePortal } from './permissions.js'
import { presentClientPortalView, presentUnavailablePortal } from './projection.js'
import { resolvePortalProposal, resolveWorkflowStatus } from './resolvers.js'
import { emptyPortal, makePortalRecord, publicPortalPath } from './schema.js'
import {
  findAnyPortalByProposal,
  findPortalByProposal,
  findPortalRecord,
  insertPortalRecord,
  listPortalsForCompany,
  replacePortalRecord,
} from './store.js'
import { assertPortalTransition } from './transitions.js'
import {
  PORTAL_ACCESS_REASON,
  PORTAL_EVENT,
  PORTAL_PUBLISHABLE_WORKFLOW,
  PORTAL_STATUS,
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
  const next = makePortalRecord(stamp(record))
  const existing = findPortalByProposal(next.companyId, next.proposalId)
  if (existing) replacePortalRecord(existing.id, { ...next, id: existing.id })
  else insertPortalRecord(next)
  return makePortalRecord(findPortalByProposal(next.companyId, next.proposalId))
}

function recordEvent(record, actor, type, payload = {}) {
  const { record: next, event } = appendPortalActivity(record, {
    type,
    actorId: actor?.id ?? '',
    actorName: actor?.name ?? '',
    payload,
    from: payload.from ?? null,
    to: payload.to ?? null,
  })
  emitPortalEvent(event)
  return next
}

function requireProposalId(proposalId) {
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('A proposal id is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  return pid
}

function assertProposalOwnership(companyId, proposalId) {
  const claimed = findAnyPortalByProposal(proposalId)
  if (claimed && claimed.companyId !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function loadOwnedProposal(companyId, proposalId) {
  const proposal = resolvePortalProposal(proposalId, companyId)
  if (!proposal) {
    throw new NotFoundError('Proposal not found.')
  }
  const ownedBy = String(proposal.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
  if (ownedBy !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return proposal
}

function presentStudioPortal(record, now = Date.now()) {
  const status = effectivePortalStatus(record, now)
  return {
    ...record,
    status,
    publicPath: publicPortalPath(record.id),
    storedStatus: record.status,
  }
}

export function getPortal({ companyId, proposalId, actor, create = false, now } = {}) {
  const scoped = scopedCompany(companyId)
  const pid = requireProposalId(proposalId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!canReadPortal(user)) {
    throw new ForbiddenError('You do not have permission to view this portal.')
  }
  assertProposalOwnership(scoped, pid)

  const found = findPortalByProposal(scoped, pid)
  if (found) return presentStudioPortal(found, now)
  if (!create) {
    throw new NotFoundError('Portal not found.')
  }
  if (!canCreatePortal(user)) {
    throw new ForbiddenError('You do not have permission to create portal access.')
  }
  loadOwnedProposal(scoped, pid)
  let record = emptyPortal({ companyId: scoped, proposalId: pid })
  record = recordEvent(record, user, PORTAL_EVENT.CREATED, { proposalId: pid })
  return presentStudioPortal(save(record), now)
}

export function createPortal({ companyId, proposalId, actor, now } = {}) {
  return getPortal({ companyId, proposalId, actor, create: true, now })
}

export function listPortals({ companyId, proposalIds } = {}) {
  const scoped = scopedCompany(companyId)
  const all = listPortalsForCompany(scoped)
  if (!proposalIds?.length) return all
  const wanted = new Set(proposalIds.map(String))
  return all.filter((item) => wanted.has(item.proposalId))
}

export function publishPortal({
  companyId,
  proposalId,
  actor,
  expiresAt = null,
  now,
  clientLabel = '',
} = {}) {
  const scoped = scopedCompany(companyId)
  const pid = requireProposalId(proposalId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!canPublishPortal(user)) {
    throw new ForbiddenError('You do not have permission to publish this proposal.')
  }
  assertProposalOwnership(scoped, pid)
  const proposal = loadOwnedProposal(scoped, pid)

  const workflowStatus = resolveWorkflowStatus(scoped, pid)
  if (!PORTAL_PUBLISHABLE_WORKFLOW.includes(workflowStatus)) {
    throw new ValidationError(
      'This proposal is not ready to publish. Mark it Ready to Send in workflow first.',
      [{ field: 'workflow', message: `Workflow status is ${workflowStatus}.` }],
    )
  }

  let record = findPortalByProposal(scoped, pid)
  if (!record) {
    if (!canCreatePortal(user)) {
      throw new ForbiddenError('You do not have permission to create portal access.')
    }
    record = emptyPortal({ companyId: scoped, proposalId: pid })
    record = recordEvent(record, user, PORTAL_EVENT.CREATED, { proposalId: pid })
  }

  const from = effectivePortalStatus(record, now)
  if (from !== PORTAL_STATUS.PUBLISHED) {
    assertPortalTransition(from, PORTAL_STATUS.PUBLISHED)
  }

  let nextExpires = record.expiresAt
  if (expiresAt) {
    const parsed = new Date(expiresAt)
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError('A valid expiry date is required.', [
        { field: 'expiresAt', message: 'expiresAt must be a valid date.' },
      ])
    }
    nextExpires = parsed.toISOString()
  }

  const publishedAt = new Date().toISOString()
  record = {
    ...record,
    status: PORTAL_STATUS.PUBLISHED,
    publishedAt,
    revokedAt: null,
    expiresAt: nextExpires,
    clientFacing: {
      ...record.clientFacing,
      label: String(clientLabel || record.clientFacing?.label || proposal.title || '').trim(),
    },
  }

  record = recordEvent(record, user, PORTAL_EVENT.PUBLISHED, {
    from,
    to: PORTAL_STATUS.PUBLISHED,
    proposalId: pid,
  })
  const saved = presentStudioPortal(save(record), now)
  return {
    portal: saved,
    publicPath: saved.publicPath,
    view: presentClientPortalView(proposal, saved, now),
  }
}

export function revokePortal({ companyId, proposalId, actor, now } = {}) {
  const scoped = scopedCompany(companyId)
  const pid = requireProposalId(proposalId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!canRevokePortal(user)) {
    throw new ForbiddenError('You do not have permission to revoke portal access.')
  }

  const record = findPortalByProposal(scoped, pid)
  if (!record) throw new NotFoundError('Portal not found.')

  const from = effectivePortalStatus(record, now)
  assertPortalTransition(from, PORTAL_STATUS.REVOKED)

  let next = {
    ...record,
    status: PORTAL_STATUS.REVOKED,
    revokedAt: new Date().toISOString(),
  }
  next = recordEvent(next, user, PORTAL_EVENT.REVOKED, {
    from,
    to: PORTAL_STATUS.REVOKED,
    proposalId: pid,
  })
  return presentStudioPortal(save(next), now)
}

export function getPortalActivityForProposal({ companyId, proposalId, actor } = {}) {
  const portal = getPortal({ companyId, proposalId, actor, create: false })
  return getPortalActivity(portal)
}

export function previewPortal({ companyId, proposalId, actor, now } = {}) {
  const portal = getPortal({ companyId, proposalId, actor, create: false, now })
  const proposal = loadOwnedProposal(portal.companyId, portal.proposalId)
  return {
    portal,
    publicPath: portal.publicPath,
    view: presentClientPortalView(proposal, portal, now),
  }
}

function denyClient(record, actor, reason, message, { persist = true, notFound = false } = {}) {
  if (record && persist) {
    const next = recordEvent(record, actor, PORTAL_EVENT.ACCESS_DENIED, { reason })
    if (reason === PORTAL_ACCESS_REASON.EXPIRED && record.status === PORTAL_STATUS.PUBLISHED) {
      save(
        recordEvent(
          { ...next, status: PORTAL_STATUS.EXPIRED },
          actor,
          PORTAL_EVENT.EXPIRED,
          { from: PORTAL_STATUS.PUBLISHED, to: PORTAL_STATUS.EXPIRED },
        ),
      )
    } else {
      save(next)
    }
  }
  const error = notFound ? new NotFoundError(message) : new ForbiddenError(message)
  error.reason = reason
  error.unavailable = presentUnavailablePortal(reason, message)
  throw error
}

export function getClientPortalView({ portalId, now } = {}) {
  const id = String(portalId ?? '').trim()
  if (!id) {
    const error = new NotFoundError('Portal not found.')
    error.reason = PORTAL_ACCESS_REASON.UNKNOWN
    error.unavailable = presentUnavailablePortal(
      PORTAL_ACCESS_REASON.UNKNOWN,
      'This proposal is not available.',
    )
    throw error
  }

  const record = findPortalRecord(id)
  if (!record) {
    const error = new NotFoundError('Portal not found.')
    error.reason = PORTAL_ACCESS_REASON.UNKNOWN
    error.unavailable = presentUnavailablePortal(
      PORTAL_ACCESS_REASON.UNKNOWN,
      'This proposal is not available.',
    )
    throw error
  }

  const status = effectivePortalStatus(record, now)
  const guest = { id: '', name: 'Client', companyId: record.companyId }

  if (status === PORTAL_STATUS.DRAFT) {
    denyClient(record, guest, PORTAL_ACCESS_REASON.UNPUBLISHED, 'This proposal is not available.', {
      persist: false,
      notFound: true,
    })
  }
  if (status === PORTAL_STATUS.REVOKED) {
    denyClient(record, guest, PORTAL_ACCESS_REASON.REVOKED, 'This proposal is no longer available.')
  }
  if (status === PORTAL_STATUS.EXPIRED) {
    denyClient(record, guest, PORTAL_ACCESS_REASON.EXPIRED, 'This proposal link has expired.')
  }

  if (!isClientAccessible(record, now)) {
    denyClient(
      record,
      guest,
      PORTAL_ACCESS_REASON.UNPUBLISHED,
      'This proposal is not available.',
    )
  }

  const proposal = resolvePortalProposal(record.proposalId, record.companyId)
  if (!proposal) {
    const error = new NotFoundError('Proposal not found.')
    error.reason = PORTAL_ACCESS_REASON.UNKNOWN
    error.unavailable = presentUnavailablePortal(
      PORTAL_ACCESS_REASON.UNKNOWN,
      'This proposal is not available.',
    )
    throw error
  }

  const ownedBy = String(proposal.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
  if (ownedBy !== record.companyId) {
    denyClient(
      record,
      guest,
      PORTAL_ACCESS_REASON.COMPANY_MISMATCH,
      'This proposal is not available.',
    )
  }

  return {
    portal: {
      portalId: record.id,
      status,
      publishedAt: record.publishedAt,
      expiresAt: record.expiresAt,
    },
    view: presentClientPortalView(proposal, { ...record, status }, now),
  }
}

export { publicPortalPath }
