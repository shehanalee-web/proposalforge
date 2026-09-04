import { createRecordId } from '../models/ids.js'
import { CLIENT_ACTIVITY_TYPE } from '../models/clientActivity.js'

/**
 * Notification architecture.
 *
 * Events are recorded and can be subscribed to. No email, SMS, or provider
 * is connected in Phase 8D.
 */

export const NOTIFICATION_EVENT = Object.freeze({
  PROPOSAL_VIEWED: 'proposal_viewed',
  QUESTIONNAIRE_SUBMITTED: 'questionnaire_submitted',
  FILES_UPLOADED: 'files_uploaded',
  COMMENT_ADDED: 'comment_added',
  REQUEST_CHANGES: 'request_changes',
  APPROVED: 'approved',
  DECLINED: 'declined',
  SIGNATURE_COMPLETED: 'signature_completed',
  PAYMENT_COMPLETED: 'payment_completed',
})

const ACTIVITY_TO_NOTIFICATION = {
  [CLIENT_ACTIVITY_TYPE.VIEWED]: NOTIFICATION_EVENT.PROPOSAL_VIEWED,
  [CLIENT_ACTIVITY_TYPE.QUESTIONNAIRE_SUBMITTED]:
    NOTIFICATION_EVENT.QUESTIONNAIRE_SUBMITTED,
  [CLIENT_ACTIVITY_TYPE.FILE_UPLOADED]: NOTIFICATION_EVENT.FILES_UPLOADED,
  [CLIENT_ACTIVITY_TYPE.COMMENTED]: NOTIFICATION_EVENT.COMMENT_ADDED,
  [CLIENT_ACTIVITY_TYPE.REPLIED]: NOTIFICATION_EVENT.COMMENT_ADDED,
  [CLIENT_ACTIVITY_TYPE.REVISION_REQUESTED]: NOTIFICATION_EVENT.REQUEST_CHANGES,
  [CLIENT_ACTIVITY_TYPE.ACCEPTED]: NOTIFICATION_EVENT.APPROVED,
  [CLIENT_ACTIVITY_TYPE.APPROVED]: NOTIFICATION_EVENT.APPROVED,
  [CLIENT_ACTIVITY_TYPE.DECLINED]: NOTIFICATION_EVENT.DECLINED,
  [CLIENT_ACTIVITY_TYPE.SIGNED]: NOTIFICATION_EVENT.SIGNATURE_COMPLETED,
  [CLIENT_ACTIVITY_TYPE.PAYMENT_COMPLETED]: NOTIFICATION_EVENT.PAYMENT_COMPLETED,
}

/** @type {Set<(event: object) => void>} */
const listeners = new Set()

/**
 * Subscribe to future notification dispatch. Returns an unsubscribe function.
 *
 * @param {(event: object) => void} handler
 */
export function onNotificationEvent(handler) {
  if (typeof handler !== 'function') return () => {}
  listeners.add(handler)
  return () => listeners.delete(handler)
}

/**
 * Record a notification intent. Nothing is sent.
 *
 * @param {string} type
 * @param {object} [payload]
 */
export function emitNotificationEvent(type, payload = {}) {
  const event = {
    id: createRecordId('nte'),
    type,
    payload,
    createdAt: new Date().toISOString(),
  }
  listeners.forEach((handler) => {
    try {
      handler(event)
    } catch {
      /* subscribers must not break writes */
    }
  })
  return event
}

/**
 * Extension point used by activity writes. Maps stored timeline events onto
 * notification intents without coupling UI to mail providers.
 *
 * @param {import('../models/clientActivity.js').ClientActivityEvent} event
 */
export function scheduleCollaborationNotice(event) {
  const type = ACTIVITY_TO_NOTIFICATION[event?.type]
  if (type) emitNotificationEvent(type, { activity: event })
  return event
}
