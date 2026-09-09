/**
 * H16.6 — Company-scoped CRM connection store.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { cloneCrmConnection, makeCrmConnection } from './schema.js'
import { CRM_CONNECTION_STATUS } from './types.js'

let connections = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneCrmConnection(item))
}

export function configureCrmConnectionStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (!persistHandler) return
  persistHandler({ connections: allCrmConnections() })
}

export function allCrmConnections() {
  return cloneList(connections)
}

export function replaceCrmConnections(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.connections)
      ? snapshot.connections
      : []
  connections = list.map((item) => makeCrmConnection(item))
  return { connections: allCrmConnections() }
}

export function resetCrmConnectionStore(seed = {}) {
  return replaceCrmConnections(seed)
}

export function serializeCrmConnections() {
  return Object.freeze({ connections: allCrmConnections() })
}

function assertCompany(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('CRM connection requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return company
}

/**
 * @param {string} companyId
 */
export function listCrmConnectionsForCompany(companyId) {
  const company = assertCompany(companyId)
  return allCrmConnections().filter((item) => item.companyId === company)
}

/**
 * @param {string} companyId
 * @param {string} connectionId
 */
export function getCrmConnectionForCompany(companyId, connectionId) {
  const company = assertCompany(companyId)
  const id = String(connectionId ?? '').trim()
  if (!id) {
    throw new ValidationError('connectionId is required.', [
      { field: 'connectionId', message: 'connectionId is required.' },
    ])
  }
  const found = connections.find((item) => item.id === id)
  if (!found) throw new NotFoundError('CRM connection not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return cloneCrmConnection(found)
}

/**
 * @param {string} companyId
 * @param {object} input
 */
export function upsertCrmConnectionForCompany(companyId, input = {}) {
  const company = assertCompany(companyId)
  const requested = String(input.companyId ?? '').trim()
  if (requested && requested !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  const now = new Date().toISOString()
  const existingId = String(input.id ?? '').trim()

  if (existingId) {
    const existing = connections.find((item) => item.id === existingId)
    if (!existing) throw new NotFoundError('CRM connection not found.')
    if (existing.companyId !== company) {
      throw new ForbiddenError('You cannot access another company workspace.')
    }
    const next = makeCrmConnection({
      ...existing,
      ...input,
      id: existing.id,
      companyId: company,
      createdAt: existing.createdAt,
      updatedAt: now,
    })
    connections = connections.map((item) => (item.id === existingId ? next : item))
    notify()
    return cloneCrmConnection(next)
  }

  const created = makeCrmConnection({
    ...input,
    companyId: company,
    createdAt: now,
    updatedAt: now,
  })
  connections = [...connections, created]
  notify()
  return cloneCrmConnection(created)
}

/**
 * @param {string} companyId
 * @param {string} connectionId
 * @param {boolean} enabled
 */
export function setCrmConnectionEnabled(companyId, connectionId, enabled) {
  const existing = getCrmConnectionForCompany(companyId, connectionId)
  return upsertCrmConnectionForCompany(companyId, {
    ...existing,
    enabled: Boolean(enabled),
    status: enabled ? CRM_CONNECTION_STATUS.ENABLED : CRM_CONNECTION_STATUS.CONFIGURED,
  })
}

/**
 * @param {string} companyId
 * @param {string} connectionId
 */
export function deleteCrmConnectionForCompany(companyId, connectionId) {
  getCrmConnectionForCompany(companyId, connectionId)
  const id = String(connectionId).trim()
  connections = connections.filter((item) => item.id !== id)
  notify()
  return true
}
