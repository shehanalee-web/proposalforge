/**
 * H16.6 — CRM adapter contract + registry.
 *
 * This is an H16 CRM-specific registry. It is NOT the H15.6 CommercialClose
 * provider registry and never imports from src/commercialClose/**.
 *
 * Contract:
 *   isEnabled(connection) -> boolean
 *   describe()            -> bounded descriptor
 *   applyMutation(mutation, context) -> { ok, externalId, failureCode, retryable, result }
 */

import { ValidationError } from '../../services/errors.js'
import { CRM_FAILURE_CODES, CRM_PROVIDER_IDS } from './types.js'

const adapters = new Map()

function assertCrmAdapterShape(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new ValidationError('CRM adapter is required.', [
      { field: 'adapter', message: 'adapter is required.' },
    ])
  }
  const providerId = String(adapter.providerId ?? '').trim()
  if (!CRM_PROVIDER_IDS.includes(providerId)) {
    throw new ValidationError('Unsupported CRM adapter providerId.', [
      {
        field: 'providerId',
        message: `providerId must be one of: ${CRM_PROVIDER_IDS.join(', ')}.`,
      },
    ])
  }
  for (const method of ['isEnabled', 'describe', 'applyMutation']) {
    if (typeof adapter[method] !== 'function') {
      throw new ValidationError(`CRM adapter missing ${method}().`, [
        { field: method, message: `${method}() is required.` },
      ])
    }
  }
  return { ...adapter, providerId }
}

/**
 * @param {object} adapter
 */
export function registerCrmAdapter(adapter) {
  const next = assertCrmAdapterShape(adapter)
  adapters.set(next.providerId, next)
  return next
}

/**
 * @param {string} providerId
 */
export function getCrmAdapter(providerId) {
  return adapters.get(String(providerId ?? '').trim()) || null
}

export function listCrmAdapters() {
  return [...adapters.values()]
}

export function clearCrmAdapterRegistry() {
  adapters.clear()
}

/**
 * Normalize whatever an adapter returned into the bounded outcome shape.
 *
 * @param {unknown} raw
 */
export function normalizeCrmAdapterResult(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const ok = source.ok === true
  const failureCode =
    !ok && CRM_FAILURE_CODES.includes(source.failureCode) ? source.failureCode : null
  return Object.freeze({
    ok,
    externalId: source.externalId == null ? null : String(source.externalId).trim() || null,
    failureCode,
    retryable: typeof source.retryable === 'boolean' ? source.retryable : false,
    result: source.result && typeof source.result === 'object' ? source.result : {},
    message: source.message == null ? null : String(source.message),
  })
}
