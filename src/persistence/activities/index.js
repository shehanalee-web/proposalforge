/**
 * H16.8 — Activity persistence barrel (Slice 8.1).
 *
 * Exports contracts, the native record builder, and a closed health seam.
 * No adapter is registered yet, so durable health is structurally false.
 * Slice 8.2 replaces the stub with the repository registry.
 *
 * This barrel does not export create / update / archive.
 */

import { ACTIVITY_REPOSITORY_ID, ACTIVITY_REPOSITORY_MODE } from './types.js'

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

/**
 * Slice 8.1 stub. No durable adapter is registered.
 *
 * @returns {{ id: string, durable: boolean, mode: string }}
 */
export function describeActivityRepository() {
  return Object.freeze({
    id: ACTIVITY_REPOSITORY_ID.NULL,
    durable: false,
    mode: ACTIVITY_REPOSITORY_MODE.NULL,
  })
}

/**
 * Slice 8.1 stub. Always false until Slice 8.2 registers a healthy durable adapter.
 */
export function isDurableActivityRepositoryHealthy() {
  return false
}
