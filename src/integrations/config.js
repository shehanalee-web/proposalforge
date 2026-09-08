/**
 * H16.1 — Company-scoped integration configuration store.
 *
 * Smallest persistence surface for foundation configs. No event intake,
 * rules, outbox, or delivery execution.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import {
  cloneIntegrationConfig,
  makeIntegrationConfig,
  presentClientIntegrationConfig,
  presentStudioIntegrationConfig,
  serializeIntegrationConfig,
} from './schema.js'
import { INTEGRATION_REJECTION_REASON } from './types.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneIntegrationConfig(item))
}

export function configureIntegrationConfigStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allIntegrationConfigs())
}

export function allIntegrationConfigs() {
  return cloneList(records)
}

export function replaceIntegrationConfigs(next) {
  records = (Array.isArray(next) ? next : []).map((item) =>
    makeIntegrationConfig(item),
  )
  return allIntegrationConfigs()
}

export function resetIntegrationConfigStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) =>
    makeIntegrationConfig(item),
  )
  return allIntegrationConfigs()
}

/**
 * @param {string} companyId
 * @param {string} [otherCompanyId]
 */
export function assertIntegrationCompanyScope(companyId, otherCompanyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('Integration config requires companyId.', [
      {
        field: 'companyId',
        message: 'companyId is required.',
      },
    ])
  }
  if (otherCompanyId == null || otherCompanyId === '') return company
  const other = String(otherCompanyId).trim()
  if (other && other !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return company
}

/**
 * Result-style company check for adapter/resolution paths.
 *
 * @param {string} companyId
 * @param {string} [expectedCompanyId]
 */
export function evaluateIntegrationCompanyScope(companyId, expectedCompanyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    return {
      ok: false,
      reason: INTEGRATION_REJECTION_REASON.COMPANY_REQUIRED,
    }
  }
  const expected = String(expectedCompanyId ?? '').trim()
  if (expected && expected !== company) {
    return {
      ok: false,
      reason: INTEGRATION_REJECTION_REASON.COMPANY_MISMATCH,
    }
  }
  return { ok: true, reason: null, companyId: company }
}

/**
 * @param {string} companyId
 * @param {string} [kind]
 */
export function listIntegrationConfigsForCompany(companyId, kind) {
  const company = assertIntegrationCompanyScope(companyId)
  const kindFilter = String(kind ?? '').trim()
  return allIntegrationConfigs().filter((item) => {
    if (item.companyId !== company) return false
    if (kindFilter && item.kind !== kindFilter) return false
    return true
  })
}

/**
 * @param {string} companyId
 * @param {string} configId
 */
export function getIntegrationConfigForCompany(companyId, configId) {
  const company = assertIntegrationCompanyScope(companyId)
  const id = String(configId ?? '').trim()
  if (!id) {
    throw new ValidationError('Integration config id is required.', [
      { field: 'id', message: 'id is required.' },
    ])
  }
  const found = records.find((entry) => entry.id === id)
  if (!found) {
    throw new NotFoundError('Integration config not found.')
  }
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return cloneIntegrationConfig(found)
}

/**
 * @param {string} companyId
 * @param {object} input
 */
export function upsertIntegrationConfigForCompany(companyId, input = {}) {
  const company = assertIntegrationCompanyScope(companyId, input.companyId)
  const now = new Date().toISOString()
  const existingId = String(input.id ?? '').trim()

  if (existingId) {
    const existing = records.find((entry) => entry.id === existingId)
    if (!existing) {
      throw new NotFoundError('Integration config not found.')
    }
    if (existing.companyId !== company) {
      throw new ForbiddenError('You cannot access another company workspace.')
    }
    const next = makeIntegrationConfig({
      ...existing,
      ...input,
      id: existing.id,
      companyId: company,
      createdAt: existing.createdAt,
      updatedAt: now,
    })
    const index = records.findIndex((entry) => entry.id === existingId)
    const copy = [...records]
    copy[index] = next
    records = copy
    notify()
    return cloneIntegrationConfig(next)
  }

  const created = makeIntegrationConfig({
    ...input,
    companyId: company,
    createdAt: now,
    updatedAt: now,
  })
  records = [...records, created]
  notify()
  return cloneIntegrationConfig(created)
}

/**
 * @param {string} companyId
 * @param {string} configId
 */
export function deleteIntegrationConfigForCompany(companyId, configId) {
  const company = assertIntegrationCompanyScope(companyId)
  const id = String(configId ?? '').trim()
  const existing = records.find((entry) => entry.id === id)
  if (!existing) {
    throw new NotFoundError('Integration config not found.')
  }
  if (existing.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  records = records.filter((entry) => entry.id !== id)
  notify()
  return true
}

export {
  presentClientIntegrationConfig,
  presentStudioIntegrationConfig,
  serializeIntegrationConfig,
}
