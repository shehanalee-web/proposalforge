import { PORTAL_EVENT } from './types.js'
import { fanoutPortalEmission } from '../integrations/events/fanout.js'

export const PORTAL_NOTIFICATION_EVENTS = Object.freeze([
  PORTAL_EVENT.CREATED,
  PORTAL_EVENT.PUBLISHED,
  PORTAL_EVENT.REVOKED,
  PORTAL_EVENT.EXPIRED,
  PORTAL_EVENT.ACCESS_DENIED,
])

/**
 * Horizon 11 does not deliver email, WhatsApp, or any external notification.
 * H16.2 fans out into automation intake when eventIntake is enabled.
 */
export function emitPortalEvent(event) {
  fanoutPortalEmission(event)
  return null
}
