/**
 * H16.7 — Activity timeline barrel.
 *
 * Read-only projection surface. No write path is exported because none exists;
 * native Activity persistence lands in H16.8 under `persistence/`.
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

export {
  deriveTimelineEntryId,
  sanitizeTimelineAttributes,
  resolveTimelineTimestamps,
  makeTimelineSubject,
  makeTimelineSource,
  makeTimelineActor,
  makeTimelineEntry,
  cloneTimelineEntry,
  presentStudioTimelineEntry,
  presentClientTimelineEntry,
} from './schema.js'
