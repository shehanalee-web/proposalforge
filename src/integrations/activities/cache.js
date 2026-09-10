/**
 * H16.7 — TimelineCache port (dormant).
 *
 * Defines the seam a Redis or PostgreSQL cache will plug into and ships the
 * null implementation only. `buildTimeline` never consults a cache in H16.7;
 * the port exists so that adding one later is a registration rather than a
 * redesign of the read path.
 *
 * Why the port is asynchronous: Redis and PostgreSQL are network-bound, so a
 * synchronous port could not be implemented against either without blocking
 * the event loop. Every method therefore returns a promise even though the
 * null cache resolves immediately. The consequence is recorded rather than
 * hidden — today's read path is synchronous, so the phase that first registers
 * a real cache must also make the read path async. Fixing the port shape now is
 * what keeps that change local to the engine instead of spreading to the
 * contract, the key derivation, and every caller.
 *
 * Why caching cannot switch on by accident: a cache is live only when the
 * capability flag is set AND the registered cache declares itself durable. The
 * null cache declares `durable: false`, so no configuration alone enables it.
 * This mirrors the H16.7 rule that authoring cannot be enabled without a
 * durable repository.
 *
 * Pure. Reads no store and writes nothing.
 */

import { ValidationError } from '../../services/errors.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import {
  ACTIVITY_SCHEMA_VERSION,
  TIMELINE_CACHE_ID,
  TIMELINE_CACHE_LIMITS,
  TIMELINE_CACHE_MODE,
  TIMELINE_CACHE_MODES,
} from './types.js'
import { stableHash } from './schema.js'

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

/**
 * Fingerprint of the active source set.
 *
 * A cached page is only valid for the sources that produced it. Registering,
 * removing, or disabling a source changes this value, so stale pages from a
 * different source set can never be served.
 *
 * @param {Array<{ id: string, priority: number, enabled?: boolean }>} sources
 */
export function deriveTimelineSourceFingerprint(sources) {
  const list = (Array.isArray(sources) ? sources : [])
    .map((entry) => {
      const id = String(entry?.id ?? '').trim()
      const priority = Number(entry?.priority ?? 0)
      const enabled = entry?.enabled === false ? 0 : 1
      return `${id}:${priority}:${enabled}`
    })
    .sort()
  return stableHash(list.join('|'))
}

/**
 * Derive a cache key for one timeline page.
 *
 * Every input that can change the result is part of the key, including the
 * schema version and the source fingerprint, so a schema bump or a source
 * change invalidates implicitly rather than needing a manual flush.
 *
 * companyId stays in the clear as a key prefix so a backend can invalidate one
 * tenant by prefix scan. The variable part is hashed to keep keys bounded.
 *
 * @param {object} query
 * @param {{ sourceFingerprint?: string }} [context]
 * @returns {string}
 */
export function deriveTimelineCacheKey(query = {}, context = {}) {
  const companyId = String(query.companyId ?? '').trim()
  if (!companyId) {
    // A key without a company would be a cross-tenant cache entry.
    throw invalid('Timeline cache key requires companyId.', 'companyId')
  }

  const canonical = [
    `v=${ACTIVITY_SCHEMA_VERSION}`,
    `co=${companyId}`,
    `st=${String(query.subjectType ?? '')}`,
    `si=${String(query.subjectId ?? '')}`,
    `au=${String(query.audience ?? '')}`,
    `ki=${[...(Array.isArray(query.kinds) ? query.kinds : [])].map(String).sort().join(',')}`,
    `or=${[...(Array.isArray(query.origins) ? query.origins : [])].map(String).sort().join(',')}`,
    `sn=${String(query.since ?? '')}`,
    `un=${String(query.until ?? '')}`,
    `li=${String(query.limit ?? '')}`,
    `cu=${String(query.cursor ?? '')}`,
    `sf=${String(context.sourceFingerprint ?? '')}`,
  ].join('|')

  const key = `tlc:${companyId}:${stableHash(canonical)}`
  if (key.length > TIMELINE_CACHE_LIMITS.MAX_KEY) {
    throw invalid('Timeline cache key exceeds the maximum length.', 'cacheKey')
  }
  return key
}

/**
 * Whether a built page may be stored.
 *
 * A degraded page is missing whichever source threw. Caching it would freeze a
 * transient legacy-store failure into a result that looks complete, so partial
 * pages are never storable.
 *
 * @param {object} diagnostics
 */
export function isTimelinePageCacheable(diagnostics) {
  if (!diagnostics || typeof diagnostics !== 'object') return false
  const degraded = diagnostics.sourcesDegraded
  if (Array.isArray(degraded) && degraded.length > 0) return false
  return true
}

/**
 * @param {number | null | undefined} value
 */
export function resolveTimelineCacheTtlSeconds(value) {
  const ttl = Number(value)
  if (!Number.isFinite(ttl) || ttl <= 0) return TIMELINE_CACHE_LIMITS.DEFAULT_TTL_SECONDS
  return Math.min(Math.floor(ttl), TIMELINE_CACHE_LIMITS.MAX_TTL_SECONDS)
}

/**
 * Validate an implementation against the TimelineCache port.
 *
 * @param {object} cache
 */
export function assertTimelineCacheContract(cache) {
  if (!cache || typeof cache !== 'object') {
    throw invalid('TimelineCache must be an object.', 'cache')
  }

  for (const method of ['get', 'set', 'invalidate', 'describe']) {
    if (typeof cache[method] !== 'function') {
      throw invalid(`TimelineCache must implement ${method}().`, `cache.${method}`)
    }
  }

  const descriptor = cache.describe()
  if (!descriptor || typeof descriptor !== 'object') {
    throw invalid('TimelineCache.describe() must return a descriptor.', 'cache.describe')
  }

  const id = String(descriptor.id ?? '').trim()
  if (!id) {
    throw invalid('TimelineCache descriptor requires an id.', 'cache.describe.id')
  }

  if (!TIMELINE_CACHE_MODES.includes(descriptor.mode)) {
    throw invalid(
      `TimelineCache mode ${String(descriptor.mode)} is not supported.`,
      'cache.describe.mode',
    )
  }

  if (typeof descriptor.durable !== 'boolean') {
    throw invalid(
      'TimelineCache descriptor must declare durable as a boolean.',
      'cache.describe.durable',
    )
  }

  if (descriptor.mode === TIMELINE_CACHE_MODE.DISABLED && descriptor.durable !== false) {
    throw invalid(
      'A disabled TimelineCache cannot declare itself durable.',
      'cache.describe.durable',
    )
  }

  return Object.freeze({ id, mode: descriptor.mode, durable: descriptor.durable })
}

/**
 * The only implementation in H16.7. Always misses and stores nothing, so the
 * engine behaves exactly as it would with no cache at all.
 */
export function createNullTimelineCache() {
  return {
    id: TIMELINE_CACHE_ID.NULL,

    describe() {
      return {
        id: TIMELINE_CACHE_ID.NULL,
        mode: TIMELINE_CACHE_MODE.DISABLED,
        durable: false,
      }
    },

    async get() {
      return null
    },

    async set() {
      return false
    },

    async invalidate() {
      return 0
    },
  }
}

let registered = createNullTimelineCache()

/**
 * Install a cache implementation. One slot: a timeline served from two caches
 * could disagree with itself.
 *
 * @param {object} cache
 */
export function registerTimelineCache(cache) {
  const descriptor = assertTimelineCacheContract(cache)
  registered = cache
  return descriptor
}

/**
 * Restore the null cache. Never leaves the slot empty, so callers never have to
 * null-check the seam.
 */
export function resetTimelineCache() {
  registered = createNullTimelineCache()
  return registered
}

export function getTimelineCache() {
  return registered
}

export function describeTimelineCache() {
  return assertTimelineCacheContract(registered)
}

/**
 * Structurally false in H16.7: the capability ships disabled and the only
 * implementation declares itself non-durable, so both conditions fail.
 */
export function isTimelineCacheEnabled() {
  if (INTEGRATION_CAPABILITIES.activityTimelineCache !== true) return false
  return describeTimelineCache().durable === true
}
