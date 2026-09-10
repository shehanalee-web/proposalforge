/**
 * H16.7 — Activity timeline barrel.
 *
 * Read-only projection surface. No write path is exported because none exists.
 * H16.8 persistence contracts live under `persistence/` and are re-exported
 * as describe/health only — never create/update/archive.
 */

export {
  ACTIVITY_SCHEMA_VERSION,
  ACTIVITY_KIND,
  ACTIVITY_KINDS,
  ACTIVITY_PROJECTED_KINDS,
  ACTIVITY_ORIGIN,
  ACTIVITY_ORIGINS,
  ACTIVITY_PROJECTED_ORIGINS,
  ACTIVITY_AUDIENCE,
  ACTIVITY_AUDIENCES,
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ACTOR_KINDS,
  ACTIVITY_SUBJECT_TYPE,
  ACTIVITY_SUBJECT_TYPES,
  ACTIVITY_RESOLVABLE_SUBJECT_TYPES,
  TIMELINE_ENTRY_ID_PREFIX,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  TIMELINE_SOURCE_PRIORITY,
  TIMELINE_UNSCOPED_SOURCE_IDS,
  TIMELINE_LIVING_CANONICAL_INTERACTION_TYPES,
  TIMELINE_DROP_REASON,
  TIMELINE_DROP_REASONS,
  TIMELINE_LIMITS,
  TIMELINE_CACHE_ID,
  TIMELINE_CACHE_MODE,
  TIMELINE_CACHE_MODES,
  TIMELINE_CACHE_LIMITS,
} from './types.js'

export {
  assertTimelineSourceContract,
  registerTimelineSource,
  unregisterTimelineSource,
  resetTimelineSources,
  listRegisteredTimelineSources,
  getTimelineSource,
  describeTimelineSources,
} from './sources/index.js'

export { createAutomationLedgerTimelineSource } from './sources/automationLedger.js'
export { createLivingEventsTimelineSource } from './sources/livingEvents.js'
export { createDomainActivityTimelineSource } from './sources/domainActivity.js'
export { createWorkflowActivityTimelineSource } from './sources/workflowActivity.js'
export { createPortalActivityTimelineSource } from './sources/portalActivity.js'
export { createInteractionActivityTimelineSource } from './sources/interactionActivity.js'
export { dedupeTimelineEntries } from './dedupe.js'
export {
  assertTimelineCacheContract,
  createNullTimelineCache,
  deriveTimelineCacheKey,
  deriveTimelineSourceFingerprint,
  describeTimelineCache,
  getTimelineCache,
  isTimelineCacheEnabled,
  isTimelinePageCacheable,
  registerTimelineCache,
  resetTimelineCache,
  resolveTimelineCacheTtlSeconds,
} from './cache.js'
export { createStudioAuditTimelineSource } from './sources/studioAudit.js'
export { createProposalActivityTimelineSource } from './sources/proposalActivity.js'
export { createCommercialCloseHistoryTimelineSource } from './sources/commercialCloseHistory.js'

export { projectTimelineCandidates, filterTimelineAudience } from './projection.js'

export {
  setActivityTimelineCapabilityOverrideForTests,
  clearActivityTimelineCapabilityOverrideForTests,
  setActivityAuthoringCapabilityOverrideForTests,
  clearActivityAuthoringCapabilityOverrideForTests,
  configureTimelineProposalLookup,
  resetTimelineProposalLookup,
  isActivityTimelineEnabled,
  isActivityAuthoringEnabled,
  compareTimelineEntries,
  encodeTimelineCursor,
  decodeTimelineCursor,
  buildTimeline,
} from './engine.js'

export {
  describeActivityRepository,
  isDurableActivityRepositoryHealthy,
  getActivityRepositoryHealth,
  refreshActivityRepositoryHealth,
} from '../../persistence/activities/index.js'

export {
  listStudioTimeline,
  listStudioTimelineForProposal,
  describeStudioTimelineSources,
  getActivityCapabilities,
} from './repository.js'

export {
  deriveTimelineEntryId,
  sanitizeTimelineAttributes,
  resolveTimelineTimestamps,
  makeTimelineSubject,
  makeTimelineSource,
  makeTimelineActor,
  makeTimelineEntry,
  cloneTimelineEntry,
  stableHash,
  presentStudioTimelineEntry,
  presentClientTimelineEntry,
} from './schema.js'
