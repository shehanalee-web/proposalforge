import { makeService, validateService } from '../models/service.js'
import { NotFoundError, ValidationError } from './errors.js'
import * as store from './serviceStore.js'

/**
 * Public data access layer for the Service Library.
 *
 * Async and returning plain data so a future services API is a change inside
 * this file only.
 */

const MOCK_LATENCY_MS = 200

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function compareName(a, b) {
  return String(a.name).localeCompare(String(b.name))
}

/**
 * @returns {Promise<import('../models/service.js').Service[]>}
 */
export async function fetchServices() {
  await delay()

  return store.all().sort(compareName)
}

/**
 * @param {string} id
 * @returns {Promise<import('../models/service.js').Service>}
 * @throws {NotFoundError}
 */
export async function fetchServiceById(id) {
  await delay()

  const service = store.findById(id)

  if (!service) {
    throw new NotFoundError(`No service found with id "${id}".`)
  }

  return service
}

/**
 * @param {Partial<import('../models/service.js').Service>} input
 * @returns {Promise<import('../models/service.js').Service>}
 * @throws {ValidationError}
 */
export async function createService(input) {
  const service = makeService(input)
  const errors = validateService(service)

  if (errors.length > 0) {
    throw new ValidationError('Service is not valid.', errors)
  }

  await delay()

  return store.insert(service)
}

/**
 * @param {string} id
 * @param {Partial<import('../models/service.js').Service>} changes
 * @returns {Promise<import('../models/service.js').Service>}
 * @throws {NotFoundError|ValidationError}
 */
export async function updateService(id, changes = {}) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No service found with id "${id}".`)
  }

  const updated = makeService({
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  })

  const errors = validateService(updated)

  if (errors.length > 0) {
    throw new ValidationError('Service is not valid.', errors)
  }

  await delay()

  return store.replace(id, updated)
}

/**
 * @param {string} id
 * @returns {Promise<{ id: string }>}
 * @throws {NotFoundError}
 */
export async function deleteService(id) {
  await delay()

  const deleted = store.remove(id)

  if (!deleted) {
    throw new NotFoundError(`No service found with id "${id}".`)
  }

  return { id }
}

/** Restore seed data. Intended for tests and development tooling. */
export async function resetServices() {
  store.reset()
}
