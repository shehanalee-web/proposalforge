import { PORTAL_EVENT } from '../../portal/types.js'

export function portalActivityLabel(event) {
  const actor = event.actorName || 'Someone'
  switch (event.type) {
    case PORTAL_EVENT.CREATED:
      return `${actor} created portal access`
    case PORTAL_EVENT.PUBLISHED:
      return `${actor} published this proposal to the client portal`
    case PORTAL_EVENT.REVOKED:
      return `${actor} revoked client portal access`
    case PORTAL_EVENT.EXPIRED:
      return 'Client portal access expired'
    case PORTAL_EVENT.ACCESS_DENIED:
      return 'A client view was denied'
    default:
      return `${actor} updated portal access`
  }
}
