/**
 * Approval lifecycle for a proposal.
 *
 * Stored `proposal.status` remains the source of truth. This module maps that
 * status onto the client-facing approval vocabulary (Approved, Needs revision,
 * Expired, Cancelled) without forking a second state machine.
 */

export const APPROVAL_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  NEEDS_REVISION: 'revision_requested',
  APPROVED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
})

export const APPROVAL_STATUSES = Object.freeze(Object.values(APPROVAL_STATUS))

export const APPROVAL_STATUS_LABELS = Object.freeze({
  [APPROVAL_STATUS.DRAFT]: 'Draft',
  [APPROVAL_STATUS.SENT]: 'Sent',
  [APPROVAL_STATUS.VIEWED]: 'Viewed',
  [APPROVAL_STATUS.NEEDS_REVISION]: 'Needs revision',
  [APPROVAL_STATUS.APPROVED]: 'Approved',
  [APPROVAL_STATUS.DECLINED]: 'Declined',
  [APPROVAL_STATUS.EXPIRED]: 'Expired',
  [APPROVAL_STATUS.CANCELLED]: 'Cancelled',
})

const LOCKED_STATUSES = new Set([
  APPROVAL_STATUS.APPROVED,
  APPROVAL_STATUS.DECLINED,
  APPROVAL_STATUS.EXPIRED,
  APPROVAL_STATUS.CANCELLED,
])

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {boolean}
 */
export function isProposalLocked(proposal) {
  return LOCKED_STATUSES.has(proposal?.status)
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {boolean}
 */
export function canMutateClientFiles(proposal) {
  return Boolean(proposal) && !isProposalLocked(proposal)
}

/**
 * @param {string | null | undefined} iso
 * @returns {boolean}
 */
export function isPastValidUntil(iso) {
  if (!iso) return false
  const end = new Date(`${iso}T23:59:59.999`)
  if (Number.isNaN(end.getTime())) return false
  return Date.now() > end.getTime()
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {string}
 */
export function getApprovalStatus(proposal) {
  if (!proposal) return APPROVAL_STATUS.DRAFT
  if (LOCKED_STATUSES.has(proposal.status) && proposal.status !== APPROVAL_STATUS.APPROVED) {
    return proposal.status
  }
  if (proposal.status === APPROVAL_STATUS.APPROVED) return APPROVAL_STATUS.APPROVED
  if (proposal.status === APPROVAL_STATUS.NEEDS_REVISION) return APPROVAL_STATUS.NEEDS_REVISION
  if (proposal.status === APPROVAL_STATUS.DRAFT) return APPROVAL_STATUS.DRAFT
  if (
    proposal.status === APPROVAL_STATUS.SENT &&
    isPastValidUntil(proposal.validUntil)
  ) {
    return APPROVAL_STATUS.EXPIRED
  }
  if (proposal.lastViewedAt && proposal.status === APPROVAL_STATUS.SENT) {
    return APPROVAL_STATUS.VIEWED
  }
  return proposal.status
}

/**
 * @typedef {object} ProposalApproval
 * @property {string} proposalId
 * @property {string} status
 * @property {string | null} decidedAt
 * @property {string | null} actor
 * @property {string} summary
 * @property {boolean} locked
 */

export function makeProposalApproval(input = {}, proposal = null) {
  const status = input.status ?? getApprovalStatus(proposal) ?? APPROVAL_STATUS.DRAFT
  return {
    proposalId: input.proposalId ?? proposal?.id ?? '',
    status,
    decidedAt: input.decidedAt ?? proposal?.acceptedAt ?? null,
    actor: input.actor ?? null,
    summary: String(input.summary ?? '').trim(),
    locked: Boolean(input.locked ?? LOCKED_STATUSES.has(status)),
  }
}
