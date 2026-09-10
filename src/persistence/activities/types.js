/**
 * H16.8 — Native Activity contracts.
 *
 * Native records are the write-side model. TimelineEntry remains a read-only
 * projection DTO. TASK is deliberately absent — H13 follow-ups and H10
 * workflow tasks stay their own systems.
 *
 * Slice 8.1 defines the record shape and allowlists. Adapters arrive in 8.2.
 */

import { ACTIVITY_KIND, ACTIVITY_ORIGIN } from '../../integrations/activities/types.js'
import { ACTIVITY_NATIVE_ID_PREFIX } from '../types.js'

export {
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_IDS,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_REPOSITORY_MODES,
  ACTIVITY_NATIVE_ID_PREFIX,
  ACTIVITY_DATABASE_URL_ENV,
  ACTIVITY_DATABASE_URL_REF_ENV,
  ACTIVITY_DATABASE_POOL_MAX_ENV,
  ACTIVITY_DATABASE_POOL_MAX_DEFAULT,
  ACTIVITY_DATABASE_POOL_MAX_MIN,
  ACTIVITY_DATABASE_POOL_MAX_MAX,
} from '../types.js'

export const NATIVE_ACTIVITY_SCHEMA_VERSION = 1

/** Kinds the repository may persist. Projected system_event is rejected. */
export const ACTIVITY_NATIVE_KIND = Object.freeze({
  NOTE: ACTIVITY_KIND.NOTE,
  CALL: ACTIVITY_KIND.CALL,
  MEETING: ACTIVITY_KIND.MEETING,
  EMAIL: ACTIVITY_KIND.EMAIL,
})

export const ACTIVITY_NATIVE_KINDS = Object.freeze(Object.values(ACTIVITY_NATIVE_KIND))

/** Origins the repository may persist. system / integration are projected. */
export const ACTIVITY_NATIVE_ORIGIN = Object.freeze({
  USER: ACTIVITY_ORIGIN.USER,
  AGENT: ACTIVITY_ORIGIN.AGENT,
})

export const ACTIVITY_NATIVE_ORIGINS = Object.freeze(Object.values(ACTIVITY_NATIVE_ORIGIN))

export const ACTIVITY_NATIVE_TYPE = Object.freeze({
  NOTE_CREATED: 'note.created',
  CALL_LOGGED: 'call.logged',
  MEETING_LOGGED: 'meeting.logged',
  EMAIL_LOGGED: 'email.logged',
})

export const ACTIVITY_NATIVE_TYPES = Object.freeze(Object.values(ACTIVITY_NATIVE_TYPE))

export const ACTIVITY_NATIVE_TYPE_BY_KIND = Object.freeze({
  [ACTIVITY_NATIVE_KIND.NOTE]: ACTIVITY_NATIVE_TYPE.NOTE_CREATED,
  [ACTIVITY_NATIVE_KIND.CALL]: ACTIVITY_NATIVE_TYPE.CALL_LOGGED,
  [ACTIVITY_NATIVE_KIND.MEETING]: ACTIVITY_NATIVE_TYPE.MEETING_LOGGED,
  [ACTIVITY_NATIVE_KIND.EMAIL]: ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED,
})

export const ACTIVITY_NATIVE_SOURCE_DOMAIN = 'activity'
export const ACTIVITY_NATIVE_SOURCE_ENTITY_TYPE = 'activity'

export const NATIVE_ACTIVITY_LIMITS = Object.freeze({
  MAX_PARTICIPANTS: 16,
  MAX_IDEMPOTENCY_KEY: 128,
})

export const NATIVE_ACTIVITY_ID_PATTERN = new RegExp(
  `^${ACTIVITY_NATIVE_ID_PREFIX}-[A-Za-z0-9-]+$`,
)

/**
 * @typedef {{
 *   id: string,
 *   durable: boolean,
 *   mode: 'null' | 'memory' | 'postgres',
 * }} ActivityRepositoryDescriptor
 *
 * @typedef {{
 *   ok: boolean,
 *   durable: boolean,
 *   migrated: boolean | null,
 *   message: string,
 * }} ActivityRepositoryHealth
 *
 * ActivityRepository (Slice 8.2 implements this port):
 *   describe() -> ActivityRepositoryDescriptor
 *   health() -> Promise<ActivityRepositoryHealth>
 *   create(input, context) -> Promise<NativeActivity>
 *   get(id, companyId) -> Promise<NativeActivity>
 *   list(query) -> Promise<{ entries: NativeActivity[], nextCursor: string | null }>
 *   update(id, patch, companyId) -> Promise<NativeActivity>
 *   archive(id, companyId) -> Promise<NativeActivity>
 */
