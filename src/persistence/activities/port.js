/**
 * H16.8 — ActivityRepository port (Slice 8.2).
 *
 * One registered adapter. Default is the null repository. Never leaves the
 * slot empty. Postgres adapters are validated here but not implemented.
 */

import { ValidationError } from '../../services/errors.js'
import {
  ACTIVITY_REPOSITORY_IDS,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_REPOSITORY_MODES,
} from './types.js'
import { createNullActivityRepository } from './null.js'
import { resetMemoryActivityRepository } from './memory.js'
import { resetPostgresActivityRepository } from './postgres.js'

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
  return registered
}

/**
 * Authoring may enable only against a durable adapter. Slice 8.2 ships null
 * and memory, both durable: false, so this stays false.
 */
export function isDurableActivityRepositoryHealthy() {
  return describeActivityRepository().durable === true
}
