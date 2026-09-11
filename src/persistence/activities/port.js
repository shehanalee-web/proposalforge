/**
 * H16.8 — ActivityRepository port (Slice 8.5).
 *
 * One registered adapter. Default is the null repository. Never leaves the
 * slot empty. Boot may replace null with postgres when a DSN resolves.
 */

import { ValidationError } from '../../services/errors.js'
import {
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_IDS,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_REPOSITORY_MODES,
} from './types.js'
import { createNullActivityRepository } from './null.js'
import { resetMemoryActivityRepository } from './memory.js'
import { resetPostgresActivityRepository } from './postgres.js'

const UNCONFIRMED = 'Activity repository health has not been confirmed.'
const DISABLED = 'Activity persistence is not enabled.'

function redactHealthMessage(message, fallback) {
  const text = String(message ?? '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/(env|vault|secretref):[A-Za-z0-9_./:-]+/gi, '[ref]')
  if (/postgres(?:ql)?:\/\//i.test(text)) return fallback
  return text || fallback
}

function snapshotHealth(health, descriptor) {
  return Object.freeze({
    ok: health?.ok === true,
    durable: descriptor.durable === true,
    migrated:
      health?.migrated === true ? true : health?.migrated === false ? false : null,
    message: redactHealthMessage(health?.message, DISABLED),
  })
}

function unconfirmedHealth(descriptor) {
  return Object.freeze({
    ok: false,
    durable: descriptor.durable === true,
    migrated: descriptor.durable === true ? false : null,
    message: descriptor.durable === true ? UNCONFIRMED : DISABLED,
  })
}

/** @type {{ ok: boolean, durable: boolean, migrated: boolean | null, message: string }} */
let lastHealth = unconfirmedHealth({ durable: false })

const REQUIRED_METHODS = Object.freeze([
  'describe',
  'health',
  'create',
  'get',
  'list',
  'update',
  'archive',
])

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

/**
 * @param {object} adapter
 */
export function assertActivityRepositoryContract(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw invalid('ActivityRepository must be an object.', 'adapter')
  }

  const id = String(adapter.id ?? '').trim()
  if (!ACTIVITY_REPOSITORY_IDS.includes(id)) {
    throw invalid(`Unknown activity repository id: ${id || '(empty)'}.`, 'adapter.id')
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof adapter[method] !== 'function') {
      throw invalid(`ActivityRepository must implement ${method}().`, `adapter.${method}`)
    }
  }

  const descriptor = adapter.describe()
  if (!descriptor || typeof descriptor !== 'object') {
    throw invalid('ActivityRepository.describe() must return a descriptor.', 'adapter.describe')
  }

  if (descriptor.id !== id) {
    throw invalid(
      'ActivityRepository descriptor id must match adapter.id.',
      'adapter.describe.id',
    )
  }

  if (!ACTIVITY_REPOSITORY_MODES.includes(descriptor.mode)) {
    throw invalid(
      `ActivityRepository mode ${String(descriptor.mode)} is not supported.`,
      'adapter.describe.mode',
    )
  }

  if (typeof descriptor.durable !== 'boolean') {
    throw invalid(
      'ActivityRepository descriptor must declare durable as a boolean.',
      'adapter.describe.durable',
    )
  }

  if (
    (descriptor.mode === ACTIVITY_REPOSITORY_MODE.NULL ||
      descriptor.mode === ACTIVITY_REPOSITORY_MODE.MEMORY) &&
    descriptor.durable !== false
  ) {
    throw invalid(
      'A null or memory ActivityRepository cannot declare itself durable.',
      'adapter.describe.durable',
    )
  }

  if (descriptor.mode === ACTIVITY_REPOSITORY_MODE.POSTGRES && descriptor.durable !== true) {
    throw invalid(
      'A postgres ActivityRepository must declare itself durable.',
      'adapter.describe.durable',
    )
  }

  return Object.freeze({
    id,
    durable: descriptor.durable,
    mode: descriptor.mode,
  })
}

let registered = createNullActivityRepository()

/**
 * @param {object} adapter
 */
export function registerActivityRepository(adapter) {
  const descriptor = assertActivityRepositoryContract(adapter)
  registered = adapter
  lastHealth = unconfirmedHealth(descriptor)
  return descriptor
}

export function getActivityRepository() {
  return registered
}

export function describeActivityRepository() {
  return assertActivityRepositoryContract(registered)
}

export function resetActivityRepository() {
  resetMemoryActivityRepository()
  void resetPostgresActivityRepository()
  registered = createNullActivityRepository()
  lastHealth = unconfirmedHealth(registered.describe())
  return registered
}

export function getActivityRepositoryHealth() {
  return lastHealth
}

/**
 * Confirm adapter health. Cached so the sync authoring/capabilities gate can
 * include health().ok without awaiting the adapter on every read.
 */
export async function refreshActivityRepositoryHealth() {
  const descriptor = describeActivityRepository()
  try {
    const health = await registered.health()
    lastHealth = snapshotHealth(health, descriptor)
  } catch {
    lastHealth = unconfirmedHealth(descriptor)
  }
  return lastHealth
}

/**
 * Authoring and durablePersistence require a durable adapter whose last
 * confirmed health().ok is true.
 */
export function isDurableActivityRepositoryHealthy() {
  return describeActivityRepository().durable === true && lastHealth.ok === true
}

/**
 * Production boot: keep the slot filled, replace null with postgres when the
 * DSN resolves, never migrate, never throw. Tests that already registered
 * memory/postgres are left in place.
 */
export async function ensureActivityPersistence() {
  try {
    if (!registered) {
      registerActivityRepository(createNullActivityRepository())
    }
    if (registered.id === ACTIVITY_REPOSITORY_ID.NULL) {
      const { resolveActivityDatabaseUrl } = await import('../secrets.js')
      const resolved = resolveActivityDatabaseUrl()
      if (resolved.ok) {
        try {
          const { createPostgresActivityRepository } = await import('./postgres.js')
          registerActivityRepository(createPostgresActivityRepository())
        } catch {
          registerActivityRepository(createNullActivityRepository())
        }
      }
    }
  } catch {
    try {
      if (!registered || !registered.id) {
        registerActivityRepository(createNullActivityRepository())
      }
    } catch {
      // slot must stay filled; default module state already has null
    }
  }
  try {
    await refreshActivityRepositoryHealth()
  } catch {
    // unhealthy; capabilities stay closed
  }
  return describeActivityRepository()
}
