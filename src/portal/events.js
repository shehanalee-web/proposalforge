import { PORTAL_EVENT } from './types.js'

export const PORTAL_NOTIFICATION_EVENTS = Object.freeze([
  PORTAL_EVENT.CREATED,
  PORTAL_EVENT.PUBLISHED,
  PORTAL_EVENT.REVOKED,
  PORTAL_EVENT.EXPIRED,
  PORTAL_EVENT.ACCESS_DENIED,
])

/** Horizon 11 does not deliver email, WhatsApp, or any external notification. */
export function emitPortalEvent(_event) {
  return null
}
