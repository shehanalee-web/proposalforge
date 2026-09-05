/**
 * Proposal Client Portal public API.
 *
 * Metadata and access around an existing proposal. Does not own proposal
 * content, workflow, Health, Intelligence, Consistency, Coach, or generation.
 */

export {
  DEFAULT_COMPANY_ID,
  PORTAL_ACCESS_REASON,
  PORTAL_CAPABILITIES,
  PORTAL_EVENT,
  PORTAL_EVENTS,
  PORTAL_ISOLATION_COMPANY_ID,
  PORTAL_PUBLISHABLE_WORKFLOW,
  PORTAL_STATUS,
  PORTAL_STATUSES,
} from './types.js'

export { getPortalStatusMeta, PORTAL_STATUS_LABELS } from './statuses.js'
export {
  PORTAL_TRANSITIONS,
  allowedPortalTransitions,
  canTransitionPortalStatus,
  assertPortalTransition,
} from './transitions.js'
export { canCreatePortal, canPublishPortal, canReadPortal, canRevokePortal } from './permissions.js'
export { effectivePortalStatus, isClientAccessible, isPortalExpired, presentPublicAccess } from './access.js'
export {
  presentClientPortalView,
  presentUnavailablePortal,
  assertClientSafeView,
  INTERNAL_KEYS,
  UNRESOLVED_FACT,
} from './projection.js'
export { resetPortalStore, allPortalRecords, configurePortalStore, replacePortalRecords } from './store.js'
export { configurePortalResolvers, resetPortalResolvers } from './resolvers.js'
export { makePortalRecord, emptyPortal, publicPortalPath } from './schema.js'
export { getPortalActivity } from './activity.js'
export { PORTAL_NOTIFICATION_EVENTS, emitPortalEvent } from './events.js'

export {
  getPortal,
  createPortal,
  listPortals,
  publishPortal,
  revokePortal,
  previewPortal,
  getPortalActivityForProposal,
  getClientPortalView,
} from './repository.js'
