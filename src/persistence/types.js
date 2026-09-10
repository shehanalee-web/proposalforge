/**
 * H16.8 — Persistence foundation contracts.
 *
 * Provider-agnostic PostgreSQL is the durable runtime. Adapter ids and env
 * names live here so later slices register implementations without renaming
 * the seam. Slice 8.1 defines the contracts only — no adapters, migrations,
 * or network client.
 */

export const ACTIVITY_REPOSITORY_ID = Object.freeze({
  NULL: 'null_activity_repository',
  MEMORY: 'memory_activity_repository',
  POSTGRES: 'postgres_activity_repository',
})

export const ACTIVITY_REPOSITORY_IDS = Object.freeze(
  Object.values(ACTIVITY_REPOSITORY_ID),
)

export const ACTIVITY_REPOSITORY_MODE = Object.freeze({
  NULL: 'null',
  MEMORY: 'memory',
  POSTGRES: 'postgres',
})

export const ACTIVITY_REPOSITORY_MODES = Object.freeze(
  Object.values(ACTIVITY_REPOSITORY_MODE),
)

/** Native Activity ids. Distinct from derived timeline ids (`tl-…`). */
export const ACTIVITY_NATIVE_ID_PREFIX = 'act'

export const ACTIVITY_DATABASE_URL_ENV = 'ACTIVITY_DATABASE_URL'

/** Secret-ref form. Defaults to env:ACTIVITY_DATABASE_URL when unset. */
export const ACTIVITY_DATABASE_URL_REF_ENV = 'ACTIVITY_DATABASE_URL_REF'

export const ACTIVITY_DATABASE_POOL_MAX_ENV = 'ACTIVITY_DATABASE_POOL_MAX'

export const ACTIVITY_DATABASE_POOL_MAX_DEFAULT = 2
export const ACTIVITY_DATABASE_POOL_MAX_MIN = 1
export const ACTIVITY_DATABASE_POOL_MAX_MAX = 10
