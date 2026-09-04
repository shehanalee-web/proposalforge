import { createRecordId } from '../models/ids.js'
import { CLIENT_ACTIVITY_TYPE } from '../models/clientActivity.js'
import { NOTIFICATION_TYPE } from '../models/notification.js'

/**
 * Notification dispatch bus.
 *
 * Listeners persist in-app notifications. No email, SMS, or push provider
 * is connected.
 */

export const NOTIFICATION_EVENT = Object.freeze({
  PROPOSAL_VIEWED: NOTIFICATION_TYPE.PROPOSAL_VIEWED,
  QUESTIONNAIRE_SUBMITTED: NOTIFICATION_TYPE.QUESTIONNAIRE_SUBMITTED,
  FILES_UPLOADED: NOTIFICATION_TYPE.FILES_UPLOADED,
  COMMENT_ADDED: NOTIFICATION_TYPE.COMMENT_RECEIVED,
  REQUEST_CHANGES: NOTIFICATION_TYPE.REQUEST_CHANGES,
  APPROVED: NOTIFICATION_TYPE.PROPOSAL_ACCEPTED,
  DECLINED: NOTIFICATION_TYPE.DECLINED,
  SIGNATURE_REQUESTED: NOTIFICATION_TYPE.SIGNATURE_REQUESTED,
  SIGNATURE_COMPLETED: NOTIFICATION_TYPE.SIGNATURE_COMPLETED,
  PAYMENT_COMPLETED: NOTIFICATION_TYPE.PAYMENT_RECEIVED,
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
  [CLIENT_ACTIVITY_TYPE.SIGNATURE_REQUESTED]: NOTIFICATION_EVENT.SIGNATURE_REQUESTED,
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
  if (type) {
    const dispatched = emitNotificationEvent(type, { activity: event })
    void import('../services/notificationService.js').then((mod) => {
      mod.ingestDispatchedNotification(dispatched)
    })
  }
  return event
}
