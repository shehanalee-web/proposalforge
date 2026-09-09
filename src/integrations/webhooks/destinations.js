/**
 * H16.5 — Company-scoped outbound webhook destination store.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import {
  cloneOutboundWebhookDestination,
  makeOutboundWebhookDestination,
} from './schema.js'

let destinations = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneOutboundWebhookDestination(item))
}

export function configureOutboundWebhookDestinationStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (!persistHandler) return
  persistHandler({ destinations: allOutboundWebhookDestinations() })
}

export function allOutboundWebhookDestinations() {
  return cloneList(destinations)
}

export function replaceOutboundWebhookDestinations(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.destinations)
      ? snapshot.destinations
      : []
  destinations = list.map((item) => makeOutboundWebhookDestination(item))
  return { destinations: allOutboundWebhookDestinations() }
}

export function resetOutboundWebhookDestinationStore(seed = {}) {
  return replaceOutboundWebhookDestinations(seed)
}

export function serializeOutboundWebhookDestinations() {
  return Object.freeze({ destinations: allOutboundWebhookDestinations() })
}

function assertCompany(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('Outbound webhook destination requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return company
}

/**
 * @param {string} companyId
 */
export function listOutboundWebhookDestinationsForCompany(companyId) {
  const company = assertCompany(companyId)
  return allOutboundWebhookDestinations().filter((item) => item.companyId === company)
}

/**
 * @param {string} companyId
 * @param {string} destinationId
 */
export function getOutboundWebhookDestinationForCompany(companyId, destinationId) {
  const company = assertCompany(companyId)
  const id = String(destinationId ?? '').trim()
  if (!id) {
    throw new ValidationError('destinationId is required.', [
      { field: 'destinationId', message: 'destinationId is required.' },
    ])
  }
  const found = destinations.find((item) => item.id === id)
  if (!found) throw new NotFoundError('Outbound webhook destination not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return cloneOutboundWebhookDestination(found)
}

/**
 * @param {string} companyId
 * @param {object} input
 */
export function upsertOutboundWebhookDestinationForCompany(companyId, input = {}) {
  const company = assertCompany(companyId)
  if (input.companyId != null && String(input.companyId).trim() && String(input.companyId).trim() !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  const now = new Date().toISOString()
  const existingId = String(input.id ?? '').trim()

  if (existingId) {
    const existing = destinations.find((item) => item.id === existingId)
    if (!existing) throw new NotFoundError('Outbound webhook destination not found.')
    if (existing.companyId !== company) {
      throw new ForbiddenError('You cannot access another company workspace.')
    }
    const next = makeOutboundWebhookDestination({
      ...existing,
      ...input,
      id: existing.id,
      companyId: company,
      createdAt: existing.createdAt,
      updatedAt: now,
    })
    const index = destinations.findIndex((item) => item.id === existingId)
    const copy = [...destinations]
    copy[index] = next
    destinations = copy
    notify()
    return cloneOutboundWebhookDestination(next)
  }

  const created = makeOutboundWebhookDestination({
    ...input,
    companyId: company,
    createdAt: now,
    updatedAt: now,
  })
  destinations = [...destinations, created]
  notify()
  return cloneOutboundWebhookDestination(created)
}

/**
 * @param {string} companyId
 * @param {string} destinationId
 * @param {boolean} enabled
 */
export function setOutboundWebhookDestinationEnabled(companyId, destinationId, enabled) {
  const existing = getOutboundWebhookDestinationForCompany(companyId, destinationId)
  return upsertOutboundWebhookDestinationForCompany(companyId, {
    ...existing,
    enabled: Boolean(enabled),
    status: enabled ? 'enabled' : 'configured',
  })
}

/**
 * @param {string} companyId
 * @param {string} destinationId
 */
export function deleteOutboundWebhookDestinationForCompany(companyId, destinationId) {
  getOutboundWebhookDestinationForCompany(companyId, destinationId)
  const id = String(destinationId).trim()
  destinations = destinations.filter((item) => item.id !== id)
  notify()
  return true
}
