import { INTERACTION_EVENT } from './types.js'

export const INTERACTION_NOTIFICATION_EVENTS = Object.freeze([
  INTERACTION_EVENT.CREATED,
  INTERACTION_EVENT.ACKNOWLEDGED,
  INTERACTION_EVENT.RESOLVED,
])

/** Horizon 12 does not deliver email, WhatsApp, or any external notification. */
export function emitInteractionEvent(_event) {
  return null
}
