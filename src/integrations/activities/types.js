/**
 * H16.7 — Activity timeline contracts (read-only projection).
 *
 * The Activity domain is the future canonical home for user-authored CRM
 * records, but H16.7 owns no write path. Native persistence lands in H16.8 on
 * a provider-agnostic PostgreSQL repository. Nothing here mutates a store.
 *
 * H13 follow-ups and H10 workflow tasks remain their own systems. Their events
 * are projected; their task objects are not owned, listed, or transitioned.
 */

export const ACTIVITY_SCHEMA_VERSION = 1

export const TIMELINE_ENTRY_ID_PREFIX = 'tl'

/**
 * Native authoring kinds are declared so H16.8/H16.9 do not reshape the model.
 * Only SYSTEM_EVENT is populated in H16.7 because no native writer exists.
 * TASK is deliberately absent — see the H13/H10 separation decision.
 */
export const ACTIVITY_KIND = Object.freeze({
  NOTE: 'note',
  CALL: 'call',
  MEETING: 'meeting',
  EMAIL: 'email',
  SYSTEM_EVENT: 'system_event',
})

export const ACTIVITY_KINDS = Object.freeze(Object.values(ACTIVITY_KIND))

/** Kinds a projection source may emit in H16.7. */
export const ACTIVITY_PROJECTED_KINDS = Object.freeze([ACTIVITY_KIND.SYSTEM_EVENT])

export const ACTIVITY_ORIGIN = Object.freeze({
  USER: 'user',
  SYSTEM: 'system',
  AGENT: 'agent',
  INTEGRATION: 'integration',
})

export const ACTIVITY_ORIGINS = Object.freeze(Object.values(ACTIVITY_ORIGIN))

/** Origins a projection source may emit in H16.7. */
export const ACTIVITY_PROJECTED_ORIGINS = Object.freeze([ACTIVITY_ORIGIN.SYSTEM])

export const ACTIVITY_AUDIENCE = Object.freeze({
  INTERNAL: 'internal',
  CLIENT: 'client',
})

export const ACTIVITY_AUDIENCES = Object.freeze(Object.values(ACTIVITY_AUDIENCE))

export const ACTIVITY_ACTOR_KIND = Object.freeze({
  USER: 'user',
  CLIENT: 'client',
  SYSTEM: 'system',
  AGENT: 'agent',
})

export const ACTIVITY_ACTOR_KINDS = Object.freeze(Object.values(ACTIVITY_ACTOR_KIND))

/**
 * Polymorphic subject. Only PROPOSAL resolves in H16.7 — Contact/Company/Deal
 * are declared so H16.10 adds resolution rather than migrating stored records.
 */
export const ACTIVITY_SUBJECT_TYPE = Object.freeze({
  PROPOSAL: 'proposal',
  CONTACT: 'contact',
  COMPANY: 'company',
  DEAL: 'deal',
  CLOSE: 'close',
})

export const ACTIVITY_SUBJECT_TYPES = Object.freeze(
  Object.values(ACTIVITY_SUBJECT_TYPE),
)

/** Subject types a caller may query in H16.7. */
export const ACTIVITY_RESOLVABLE_SUBJECT_TYPES = Object.freeze([
  ACTIVITY_SUBJECT_TYPE.PROPOSAL,
])

export const TIMELINE_SOURCE_ID = Object.freeze({
  AUTOMATION_LEDGER: 'automation_ledger',
  STUDIO_AUDIT: 'studio_audit',
  LIVING_EVENTS: 'living_events',
  WORKFLOW_ACTIVITY: 'workflow_activity',
  PORTAL_ACTIVITY: 'portal_activity',
  INTERACTION_ACTIVITY: 'interaction_activity',
  PROPOSAL_ACTIVITY: 'proposal_activity',
  COMMERCIAL_CLOSE_HISTORY: 'commercial_close_history',
})

export const TIMELINE_SOURCE_IDS = Object.freeze(Object.values(TIMELINE_SOURCE_ID))

/**
 * Higher priority wins identity de-duplication. The normalized H16.2 ledger
 * form always beats the raw legacy record it was derived from.
 */
export const TIMELINE_SOURCE_PRIORITY = Object.freeze({
  [TIMELINE_SOURCE_ID.AUTOMATION_LEDGER]: 100,
  [TIMELINE_SOURCE_ID.STUDIO_AUDIT]: 80,
  [TIMELINE_SOURCE_ID.LIVING_EVENTS]: 60,
  [TIMELINE_SOURCE_ID.WORKFLOW_ACTIVITY]: 58,
  [TIMELINE_SOURCE_ID.PORTAL_ACTIVITY]: 56,
  [TIMELINE_SOURCE_ID.INTERACTION_ACTIVITY]: 54,
  [TIMELINE_SOURCE_ID.PROPOSAL_ACTIVITY]: 40,
  [TIMELINE_SOURCE_ID.COMMERCIAL_CLOSE_HISTORY]: 30,
})

/**
 * Sources with no companyId column. Attributed to DEFAULT_COMPANY_ID and only
 * readable by that company, so a second tenant never sees pre-tenant history.
 */
export const TIMELINE_UNSCOPED_SOURCE_IDS = Object.freeze([
  TIMELINE_SOURCE_ID.STUDIO_AUDIT,
  TIMELINE_SOURCE_ID.PROPOSAL_ACTIVITY,
])

/**
 * Interaction emissions that living owns. Mirrors the H16.2 normalizer so the
 * timeline and the automation stack can never disagree about canonical source.
 */
export const TIMELINE_LIVING_CANONICAL_INTERACTION_TYPES = Object.freeze([
  'comment_added',
  'change_requested',
  'question_answered',
])

export const TIMELINE_CACHE_ID = Object.freeze({
  NULL: 'null_cache',
})

/**
 * H16.7 ships DISABLED only. The other modes are declared so a Redis or
 * PostgreSQL cache is a registration rather than a reshape of the port.
 */
export const TIMELINE_CACHE_MODE = Object.freeze({
  DISABLED: 'disabled',
  MEMORY: 'memory',
  REDIS: 'redis',
  POSTGRES: 'postgres',
})

export const TIMELINE_CACHE_MODES = Object.freeze(Object.values(TIMELINE_CACHE_MODE))

export const TIMELINE_CACHE_LIMITS = Object.freeze({
  MAX_KEY: 512,
  DEFAULT_TTL_SECONDS: 30,
  MAX_TTL_SECONDS: 300,
})

export const TIMELINE_DROP_REASON = Object.freeze({
  CANONICAL_SOURCE_ELSEWHERE: 'canonical_source_elsewhere',
  DUPLICATE: 'duplicate',
  UNPLACEABLE: 'unplaceable',
  AUDIENCE_FILTERED: 'audience_filtered',
  OUT_OF_COMPANY_SCOPE: 'out_of_company_scope',
  UNSUPPORTED_SHAPE: 'unsupported_shape',
})

export const TIMELINE_DROP_REASONS = Object.freeze(Object.values(TIMELINE_DROP_REASON))

export const TIMELINE_LIMITS = Object.freeze({
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
  MAX_ID: 128,
  MAX_SUBJECT_LINE: 200,
  MAX_BODY: 1000,
  MAX_ATTRIBUTE_KEYS: 12,
  MAX_ATTRIBUTE_VALUE: 200,
  MAX_SOURCE_CANDIDATES: 5000,
})
