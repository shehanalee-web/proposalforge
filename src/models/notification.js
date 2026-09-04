import { createRecordId } from './ids.js'

/**
 * Studio notification center. In-app only — no email, SMS, or push provider.
 */

export const NOTIFICATION_TYPE = Object.freeze({
  PROPOSAL_VIEWED: 'proposal_viewed',
  PROPOSAL_ACCEPTED: 'proposal_accepted',
  COMMENT_RECEIVED: 'comment_received',
  SIGNATURE_REQUESTED: 'signature_requested',
  SIGNATURE_COMPLETED: 'signature_completed',
  PAYMENT_RECEIVED: 'payment_received',
  QUESTIONNAIRE_SUBMITTED: 'questionnaire_submitted',
  FILES_UPLOADED: 'files_uploaded',
  REQUEST_CHANGES: 'request_changes',
  DECLINED: 'declined',
})

export const NOTIFICATION_TYPES = Object.freeze(Object.values(NOTIFICATION_TYPE))

export const NOTIFICATION_TITLES = Object.freeze({
  [NOTIFICATION_TYPE.PROPOSAL_VIEWED]: 'Proposal viewed',
  [NOTIFICATION_TYPE.PROPOSAL_ACCEPTED]: 'Proposal accepted',
  [NOTIFICATION_TYPE.COMMENT_RECEIVED]: 'Comment received',
  [NOTIFICATION_TYPE.SIGNATURE_REQUESTED]: 'Signature requested',
  [NOTIFICATION_TYPE.SIGNATURE_COMPLETED]: 'Signature completed',
  [NOTIFICATION_TYPE.PAYMENT_RECEIVED]: 'Payment received',
  [NOTIFICATION_TYPE.QUESTIONNAIRE_SUBMITTED]: 'Questionnaire submitted',
  [NOTIFICATION_TYPE.FILES_UPLOADED]: 'Files uploaded',
  [NOTIFICATION_TYPE.REQUEST_CHANGES]: 'Changes requested',
  [NOTIFICATION_TYPE.DECLINED]: 'Proposal declined',
})

/**
 * @typedef {object} StudioNotification
 * @property {string} id
 * @property {string} type
 * @property {string | null} proposalId
 * @property {string} title
 * @property {string} body
 * @property {string | null} readAt
 * @property {string} createdAt
 */

/**
 * @param {Partial<StudioNotification>} [input]
 * @returns {StudioNotification}
 */
export function makeNotification(input = {}) {
  const type = NOTIFICATION_TYPES.includes(input.type)
    ? input.type
    : NOTIFICATION_TYPE.PROPOSAL_VIEWED

  return {
    id: input.id ?? createRecordId('ntf'),
    type,
    proposalId: input.proposalId ?? null,
    title: String(input.title ?? '').trim() || NOTIFICATION_TITLES[type] || 'Update',
    body: String(input.body ?? '').trim(),
    readAt: input.readAt ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

/**
 * @param {StudioNotification | null | undefined} notification
 * @returns {boolean}
 */
export function isNotificationUnread(notification) {
  return Boolean(notification && !notification.readAt)
}
