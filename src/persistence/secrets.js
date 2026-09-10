/**
 * H16.8 — Activity persistence secret-ref DSN resolution (Slice 8.3).
 *
 * Resolves env:/vault:/secretref: for ACTIVITY_DATABASE_URL. Never logs or
 * returns the DSN in messages. Unresolved vault/secretref is unhealthy, not
 * an import-time throw.
 */

import { ValidationError } from '../services/errors.js'
import { normalizeSecretRef, assertNoSecretValues } from '../integrations/schema.js'
import {
  ACTIVITY_DATABASE_POOL_MAX_DEFAULT,
  ACTIVITY_DATABASE_POOL_MAX_ENV,
  ACTIVITY_DATABASE_POOL_MAX_MAX,
  ACTIVITY_DATABASE_POOL_MAX_MIN,
  ACTIVITY_DATABASE_URL_ENV,
  ACTIVITY_DATABASE_URL_REF_ENV,
} from './types.js'

/** @type {Map<string, string>} */
const testSecretBag = new Map()

const RAW_DSN_KEYS = Object.freeze(['connectionString', 'databaseUrl', 'dsn', 'url'])

export const ACTIVITY_DATABASE_DEFAULT_REF = `env:${ACTIVITY_DATABASE_URL_ENV}`

/**
 * @param {Record<string, string> | Map<string, string> | null} bag
 */
export function setActivityPersistenceTestSecrets(bag) {
  testSecretBag.clear()
  if (!bag) return
  const entries = bag instanceof Map ? bag.entries() : Object.entries(bag)
  for (const [key, value] of entries) {
    const ref = String(key ?? '').trim()
    const secret = value == null ? '' : String(value)
    if (ref && secret) testSecretBag.set(ref, secret)
  }
}

export function clearActivityPersistenceTestSecrets() {
  testSecretBag.clear()
}

/**
 * @param {object} [input]
 */
export function assertActivityPersistenceConfig(input = {}) {
  assertNoSecretValues(input)
  if (!input || typeof input !== 'object') return
  for (const key of RAW_DSN_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw new ValidationError('Raw secret values are forbidden on persistence config.', [
      {
        field: key,
        message: `${key} is not allowed. Store a secret reference instead.`,
      },
    ])
  }
}

/**
 * Secret-ref used to resolve the DSN. Does not resolve the secret.
 *
 * @returns {string}
 */
export function readActivityDatabaseUrlRef() {
  const raw = String(process.env[ACTIVITY_DATABASE_URL_REF_ENV] ?? '').trim()
  return raw || ACTIVITY_DATABASE_DEFAULT_REF
}

/**
 * @param {unknown} value
 */
export function isActivityPostgresConnectionString(value) {
  const text = String(value ?? '').trim().toLowerCase()
  return text.startsWith('postgres://') || text.startsWith('postgresql://')
}

/**
 * SSL option for the pg protocol client. SSL is used only when the DSN
 * declares sslmode. The DSN itself is never logged.
 *
 * @param {string} dsn
 * @returns {boolean | { rejectUnauthorized: boolean } | undefined}
 */
export function activityDatabaseSslOption(dsn) {
  try {
    const parsed = new URL(String(dsn ?? '').trim())
    const sslmode = String(parsed.searchParams.get('sslmode') ?? '').trim().toLowerCase()
    if (!sslmode || sslmode === 'disable') return undefined
    if (sslmode === 'require') return { rejectUnauthorized: false }
    if (sslmode === 'verify-ca' || sslmode === 'verify-full') {
      return { rejectUnauthorized: true }
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * @returns {number}
 */
export function resolveActivityDatabasePoolMax() {
  const raw = String(process.env[ACTIVITY_DATABASE_POOL_MAX_ENV] ?? '').trim()
  if (!raw) return ACTIVITY_DATABASE_POOL_MAX_DEFAULT
  const value = Number(raw)
  if (!Number.isInteger(value)) return ACTIVITY_DATABASE_POOL_MAX_DEFAULT
  return Math.min(
    ACTIVITY_DATABASE_POOL_MAX_MAX,
    Math.max(ACTIVITY_DATABASE_POOL_MAX_MIN, value),
  )
}

function unresolved(message) {
  return Object.freeze({
    ok: false,
    ref: readActivityDatabaseUrlRef(),
    url: null,
    message,
  })
}

function resolveRefValue(ref) {
  if (testSecretBag.has(ref)) {
    return { ok: true, value: testSecretBag.get(ref) }
  }

  if (ref.startsWith('env:')) {
    const name = ref.slice(4)
    const value = process.env[name]
    if (value == null || String(value).trim() === '') {
      return { ok: false, message: 'Activity database URL is not configured.' }
    }
    return { ok: true, value: String(value) }
  }

  if (ref.startsWith('vault:') || ref.startsWith('secretref:')) {
    return {
      ok: false,
      message: 'Activity database URL reference could not be resolved.',
    }
  }

  return { ok: false, message: 'Activity database URL reference is invalid.' }
}

/**
 * Resolve the DSN. Never throws at import time. `url` is for the migrate
 * runner only — do not put it in logs, health, or capabilities.
 *
 * @returns {{ ok: boolean, ref: string, url: string | null, message: string }}
 */
export function resolveActivityDatabaseUrl() {
  const ref = readActivityDatabaseUrlRef()
  try {
    const normalized = normalizeSecretRef(ref, ACTIVITY_DATABASE_URL_REF_ENV)
    if (!normalized) return unresolved('Activity database URL is not configured.')
    const resolved = resolveRefValue(normalized)
    if (!resolved.ok) {
      return Object.freeze({
        ok: false,
        ref: normalized,
        url: null,
        message: resolved.message,
      })
    }
    const url = String(resolved.value ?? '').trim()
    if (!isActivityPostgresConnectionString(url)) {
      return Object.freeze({
        ok: false,
        ref: normalized,
        url: null,
        message: 'Activity database URL is not a PostgreSQL connection string.',
      })
    }
    return Object.freeze({
      ok: true,
      ref: normalized,
      url,
      message: 'Activity database URL resolved.',
    })
  } catch {
    return unresolved('Activity database URL reference is invalid.')
  }
}
