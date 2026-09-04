import { buildProposalTimeline } from './clientActivity.js'
import { PAYMENT_STATUS } from './payment.js'
import { DISPLAY_STATUS, getDisplayStatus, PROPOSAL_STATUS } from './proposal.js'
import { SIGNATURE_STATUS } from './signature.js'

/**
 * Operational queues derived from proposal records.
 * No CRM, billing, or signature vendor is contacted.
 */

export const FOLLOW_UP_AFTER_MS = 2 * 24 * 60 * 60 * 1000
export const NEVER_OPENED_AFTER_MS = 24 * 60 * 60 * 1000
export const EXPIRING_WITHIN_MS = 7 * 24 * 60 * 60 * 1000
export const QUEUE_LIMIT = 6

const CLOSED = new Set([
  PROPOSAL_STATUS.ACCEPTED,
  PROPOSAL_STATUS.DECLINED,
  PROPOSAL_STATUS.EXPIRED,
  PROPOSAL_STATUS.CANCELLED,
  PROPOSAL_STATUS.ARCHIVED,
])

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {string | null}
 */
export function getLastActivityAt(proposal) {
  if (!proposal) return null
  if (proposal.lastActivityAt) return proposal.lastActivityAt
  const latest = buildProposalTimeline(proposal)[0]
  return latest?.at || proposal.updatedAt || proposal.createdAt || null
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {number}
 */
export function getViewCount(proposal) {
  const counted = Number(proposal?.analytics?.viewCount ?? 0)
  if (counted > 0) return counted
  return proposal?.lastViewedAt ? 1 : 0
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {boolean}
 */
export function isAwaitingSignature(proposal) {
  return proposal?.signature?.status === SIGNATURE_STATUS.WAITING
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @returns {boolean}
 */
export function isAwaitingPayment(proposal) {
  if (!proposal || CLOSED.has(proposal.status) || proposal.status === PROPOSAL_STATUS.DRAFT) {
    return false
  }
  const status = proposal?.payment?.status
  return (
    status === PAYMENT_STATUS.DEPOSIT_DUE ||
    status === PAYMENT_STATUS.OUTSTANDING ||
    status === PAYMENT_STATUS.OVERDUE
  )
}

function isOpenSent(proposal) {
  if (!proposal || CLOSED.has(proposal.status)) return false
  return (
    proposal.status === PROPOSAL_STATUS.SENT ||
    proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED
  )
}

function sentAt(proposal) {
  return proposal.lastEmail?.sentAt || proposal.updatedAt || proposal.createdAt
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @param {number} [now]
 * @returns {boolean}
 */
export function needsFollowUp(proposal, now = Date.now()) {
  if (!isOpenSent(proposal)) return false
  if (proposal.lastViewedAt) {
    const viewed = Date.parse(proposal.lastViewedAt)
    return Number.isFinite(viewed) && now - viewed >= FOLLOW_UP_AFTER_MS
  }
  const sent = Date.parse(sentAt(proposal))
  return Number.isFinite(sent) && now - sent >= NEVER_OPENED_AFTER_MS
}

/**
 * @param {import('./proposal.js').Proposal | null | undefined} proposal
 * @param {number} [now]
 * @returns {boolean}
 */
export function isExpiringSoon(proposal, now = Date.now()) {
  if (!isOpenSent(proposal) || !proposal.validUntil) return false
  const end = Date.parse(`${proposal.validUntil}T23:59:59.999`)
  if (!Number.isFinite(end)) return false
  return end > now && end - now <= EXPIRING_WITHIN_MS
}

function byStamp(field) {
  return (left, right) => String(right[field] || '').localeCompare(String(left[field] || ''))
}

function take(list, limit = QUEUE_LIMIT) {
  return list.slice(0, limit)
}

/**
 * @param {import('./proposal.js').Proposal[]} records
 * @param {number} [now]
 */
export function buildCommercialQueues(records = [], now = Date.now()) {
  const open = records.filter((item) => !CLOSED.has(item.status))

  return {
    needsFollowUp: take(
      open.filter((item) => needsFollowUp(item, now)).sort(byStamp('lastViewedAt')),
    ),
    expiringSoon: take(
      open
        .filter((item) => isExpiringSoon(item, now))
        .sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil))),
    ),
    awaitingSignature: take(
      records.filter(isAwaitingSignature).sort(byStamp('updatedAt')),
    ),
    awaitingPayment: take(
      records.filter(isAwaitingPayment).sort(byStamp('updatedAt')),
    ),
    recentlyViewed: take(
      records
        .filter((item) => item.lastViewedAt)
        .sort(byStamp('lastViewedAt')),
    ),
    recent: take([...records].sort(byStamp('updatedAt'))),
  }
}

/**
 * @param {import('./proposal.js').Proposal[]} records
 */
export function buildOperationalStats(records = []) {
  const now = Date.now()
  let viewed = 0
  let awaitingSignature = 0
  let awaitingPayment = 0
  let followUp = 0
  let expiring = 0

  for (const record of records) {
    if (getDisplayStatus(record) === DISPLAY_STATUS.VIEWED || record.lastViewedAt) {
      viewed += 1
    }
    if (isAwaitingSignature(record)) awaitingSignature += 1
    if (isAwaitingPayment(record)) awaitingPayment += 1
    if (needsFollowUp(record, now)) followUp += 1
    if (isExpiringSoon(record, now)) expiring += 1
  }

  return {
    viewed,
    awaitingSignature,
    awaitingPayment,
    followUp,
    expiring,
  }
}
