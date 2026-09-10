/**
 * H16.8 — Activity persistence barrel (Slice 8.4).
 *
 * Registry + null/memory/postgres adapters. Boot wiring lives in the port;
 * this barrel still does not export a standalone create/update/archive
 * function for the timeline plugin.
 */

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
  NATIVE_ACTIVITY_SCHEMA_VERSION,
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_NATIVE_KINDS,
  ACTIVITY_NATIVE_ORIGIN,
  ACTIVITY_NATIVE_ORIGINS,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_NATIVE_TYPES,
  ACTIVITY_NATIVE_TYPE_BY_KIND,
  ACTIVITY_NATIVE_SOURCE_DOMAIN,
  ACTIVITY_NATIVE_SOURCE_ENTITY_TYPE,
  NATIVE_ACTIVITY_LIMITS,
  NATIVE_ACTIVITY_ID_PATTERN,
} from './types.js'

export { makeNativeActivity, cloneNativeActivity } from './schema.js'

export {
  assertActivityRepositoryContract,
  registerActivityRepository,
  getActivityRepository,
  describeActivityRepository,
  resetActivityRepository,
  getActivityRepositoryHealth,
  refreshActivityRepositoryHealth,
  isDurableActivityRepositoryHealthy,
  ensureActivityPersistence,
} from './port.js'

export { createNullActivityRepository } from './null.js'
export { createMemoryActivityRepository, resetMemoryActivityRepository } from './memory.js'
export {
  createPostgresActivityRepository,
  resetPostgresActivityRepository,
} from './postgres.js'
export { assertActivityRepositoryConformance } from './conformance.js'
