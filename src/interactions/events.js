import { INTERACTION_EVENT } from './types.js'
import { fanoutInteractionEmission } from '../integrations/events/fanout.js'

export const INTERACTION_NOTIFICATION_EVENTS = Object.freeze([
  INTERACTION_EVENT.CREATED,
  INTERACTION_EVENT.ACKNOWLEDGED,
  INTERACTION_EVENT.RESOLVED,
])

/**
 * Horizon 12 does not deliver email, WhatsApp, or any external notification.
 * H16.2 fans out into automation intake when eventIntake is enabled.
 */
export function emitInteractionEvent(event) {
  fanoutInteractionEmission(event)
  return null
}
