import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { DEFAULT_ACTOR_ID, getWorkflowActor, WORKFLOW_ACTORS } from '../workflow/actors.js'
import { WORKFLOW_ROLE } from '../workflow/types.js'
import { emitFollowupEvent } from '../followup/events.js'
import { FOLLOWUP_POLICY, addMs, clockOf } from '../followup/policy.js'
import { FOLLOWUP_REASON_META } from '../followup/reasons.js'
import { makeFollowupRecord } from '../followup/schema.js'
import { isOpenFollowupStatus } from '../followup/statuses.js'
import {
  insertFollowupRecord,
  listFollowupsForProposal,
  replaceFollowupRecord,
} from '../followup/store.js'
import {
  FOLLOWUP_EVENT,
  FOLLOWUP_REASON,
  FOLLOWUP_SOURCE,
  FOLLOWUP_STATUS,
} from '../followup/types.js'
import { COMMERCIAL_CLOSE_CAPABILITIES, COMMERCIAL_CLOSE_STATUS } from './types.js'

const CLOSE_FOLLOWUP_REASONS = Object.freeze([
  FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING,
  FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING,
])

function actorIdForCompany(companyId) {
  const scoped = String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
  const owner = WORKFLOW_ACTORS.find(
    (actor) => actor.companyId === scoped && actor.role === WORKFLOW_ROLE.OWNER,
  )
  if (owner) return owner.id
  const any = WORKFLOW_ACTORS.find((actor) => actor.companyId === scoped)
  if (any) return any.id
  return DEFAULT_ACTOR_ID
}

function completeOpenCloseFollowups(companyId, proposalId, exceptReason = null) {
  const open = listFollowupsForProposal(companyId, proposalId).filter(
    (item) =>
      CLOSE_FOLLOWUP_REASONS.includes(item.reason) &&
      isOpenFollowupStatus(item.status) &&
      item.reason !== exceptReason,
  )
  const now = new Date().toISOString()
  for (const item of open) {
    replaceFollowupRecord(item.id, {
      ...item,
      status: FOLLOWUP_STATUS.COMPLETED,
      updatedAt: now,
    })
    emitFollowupEvent({
      type: FOLLOWUP_EVENT.COMPLETED,
      proposalId,
      title: item.title,
    })
  }
}

function ensureCloseFollowup({
  companyId,
  proposalId,
  closeId,
  reason,
  ownerActorId,
  description,
  now,
}) {
  const meta = FOLLOWUP_REASON_META[reason]
  if (!meta) return null
  const existing = listFollowupsForProposal(companyId, proposalId).find(
    (item) => item.reason === reason && isOpenFollowupStatus(item.status),
  )
  if (existing) return existing

  const clock = clockOf(now)
  const record = insertFollowupRecord(
    makeFollowupRecord({
      companyId,
      proposalId,
      ownerActorId,
      reason,
      title: meta.title,
      description,
      status: FOLLOWUP_STATUS.OPEN,
      priority: meta.priority,
      dueAt: addMs(clock, FOLLOWUP_POLICY.manualDefaultDueMs),
      sourceType: FOLLOWUP_SOURCE.COMMERCIAL_CLOSE,
      sourceId: closeId,
    }),
  )
  emitFollowupEvent({
    type: FOLLOWUP_EVENT.CREATED,
    proposalId,
    title: record.title,
  })
  return record
}

/**
 * Best-effort H13 reconciliation after a commercial-close transition.
 * Never throws. Never writes proposals.json. No email/CRM delivery.
 *
 * @param {{
 *   companyId: string,
 *   proposalId: string,
 *   closeId: string,
 *   status: string,
 *   ownerActorId?: string,
 *   now?: number | Date | string,
 * }} input
 */
export function reconcileCommercialCloseFollowup(input = {}) {
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine) return null
  const proposalId = String(input.proposalId ?? '').trim()
  const closeId = String(input.closeId ?? '').trim()
  if (!proposalId || !closeId) return null
  const companyId = String(input.companyId ?? '').trim() || DEFAULT_COMPANY_ID
  const requested = String(input.ownerActorId ?? '').trim()
  const ownerActorId =
    requested && getWorkflowActor(requested)?.companyId === companyId
      ? requested
      : actorIdForCompany(companyId)

  try {
    const status = input.status
    if (status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING) {
      completeOpenCloseFollowups(companyId, proposalId, FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING)
      return ensureCloseFollowup({
        companyId,
        proposalId,
        closeId,
        reason: FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING,
        ownerActorId,
        description:
          'Commercial close is awaiting signature. Use the internal signature path; external signature providers are not connected yet.',
        now: input.now,
      })
    }
    if (status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
      completeOpenCloseFollowups(companyId, proposalId, FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING)
      return ensureCloseFollowup({
        companyId,
        proposalId,
        closeId,
        reason: FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING,
        ownerActorId,
        description:
          'Commercial close is awaiting payment. External payment providers are not connected yet.',
        now: input.now,
      })
    }
    if (
      status === COMMERCIAL_CLOSE_STATUS.SIGNED ||
      status === COMMERCIAL_CLOSE_STATUS.PAID ||
      status === COMMERCIAL_CLOSE_STATUS.CLOSED ||
      status === COMMERCIAL_CLOSE_STATUS.CANCELLED ||
      status === COMMERCIAL_CLOSE_STATUS.EXPIRED
    ) {
      completeOpenCloseFollowups(companyId, proposalId)
      return null
    }
    return null
  } catch {
    return null
  }
}
