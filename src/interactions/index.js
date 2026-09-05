export {
  DEFAULT_COMPANY_ID,
  INTERACTION_CAPABILITIES,
  INTERACTION_EVENT,
  INTERACTION_EVENTS,
  INTERACTION_ISOLATION_COMPANY_ID,
  INTERACTION_SOURCE,
  INTERACTION_SOURCES,
  INTERACTION_STATUS,
  INTERACTION_STATUSES,
  INTERACTION_TYPE,
  INTERACTION_TYPES,
} from './types.js'

export { getInteractionStatusMeta, INTERACTION_STATUS_LABELS, INTERACTION_TYPE_LABELS } from './statuses.js'
export {
  INTERACTION_TRANSITIONS,
  allowedInteractionTransitions,
  canTransitionInteractionStatus,
  assertInteractionTransition,
} from './transitions.js'
export {
  clientCanViewInteraction,
  clientCanCreateInteraction,
  studioCanViewInteraction,
  studioCanAcknowledgeInteraction,
  studioCanResolveInteraction,
} from './permissions.js'
export {
  presentClientInteraction,
  presentStudioInteraction,
  presentUnavailableInteractions,
  assertClientSafeInteraction,
  INTERNAL_INTERACTION_KEYS,
} from './projection.js'
export {
  resetInteractionStore,
  allInteractionRecords,
  configureInteractionStore,
  replaceInteractionRecords,
  findInteractionRecord,
} from './store.js'
export { configureInteractionResolvers, resetInteractionResolvers } from './resolvers.js'
export { makeInteractionRecord, emptyInteraction, containsSecret } from './schema.js'
export { getInteractionActivity } from './activity.js'
export { INTERACTION_NOTIFICATION_EVENTS, emitInteractionEvent } from './events.js'
export { resolveBlockReference, listBlockTargets } from './references.js'

export {
  listClientInteractions,
  createClientInteraction,
  listStudioInteractions,
  getStudioInteraction,
  acknowledgeInteraction,
  resolveInteraction,
  mutateClientInteraction,
  deleteClientInteraction,
  mutateClientInteractionStatus,
} from './repository.js'
