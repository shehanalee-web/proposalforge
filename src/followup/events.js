import { NOTIFICATION_TYPE } from '../models/notification.js'
import { emitNotificationEvent } from '../collaboration/notify.js'
import { FOLLOWUP_EVENT } from './types.js'

export const FOLLOWUP_NOTIFICATION_EVENTS = Object.freeze([
  FOLLOWUP_EVENT.CREATED,
  FOLLOWUP_EVENT.STARTED,
  FOLLOWUP_EVENT.COMPLETED,
  FOLLOWUP_EVENT.DISMISSED,
  FOLLOWUP_EVENT.DUE,
])

/**
 * Horizon 13 does not send email, WhatsApp, or CRM events.
 * Due follow-ups may appear in the existing in-app notification bus.
 */
export function emitFollowupEvent(event) {
  if (event?.type === FOLLOWUP_EVENT.DUE) {
    emitNotificationEvent(NOTIFICATION_TYPE.FOLLOWUP_DUE, {
      proposalId: event.proposalId,
      title: event.title || 'Follow-up due',
      detail: event.description || event.title || 'A proposal follow-up is due.',
    })
  }
  return null
}
