/**
 * H16.1 — Integration adapter registry (null/disabled defaults).
 *
 * Adapters never call vendors, never perform OAuth, and never open network I/O.
 * This registry is not the H15.6 CommercialClose provider registry.
 */

import { ValidationError } from '../../services/errors.js'
import {
  INTEGRATION_KIND,
  INTEGRATION_KINDS,
  INTEGRATION_REJECTION_REASON,
} from '../types.js'
import {
  NULL_INTEGRATION_ADAPTER_ID,
  makeIntegrationAdapterDescriptor,
} from './types.js'

const adapters = new Map()

function kindKey(kind) {
  return String(kind ?? '').trim()
}

function adapterKey(kind, adapterId) {
  return `${kindKey(kind)}::${String(adapterId ?? '').trim()}`
}

function assertAdapterShape(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new ValidationError('Integration adapter is required.', [
      { field: 'adapter', message: 'adapter is required.' },
    ])
  }
  const id = String(adapter.id ?? '').trim()
  if (!id) {
    throw new ValidationError('Integration adapter id is required.', [
      { field: 'id', message: 'id is required.' },
    ])
  }
  const kind = String(adapter.kind ?? '').trim()
  if (!INTEGRATION_KINDS.includes(kind)) {
    throw new ValidationError('Unsupported integration adapter kind.', [
      {
        field: 'kind',
        message: `kind must be one of: ${INTEGRATION_KINDS.join(', ')}.`,
      },
    ])
  }
  if (typeof adapter.isEnabled !== 'function') {
    throw new ValidationError('Integration adapter missing isEnabled().', [
      { field: 'isEnabled', message: 'isEnabled() is required.' },
    ])
  }
  if (typeof adapter.describe !== 'function') {
    throw new ValidationError('Integration adapter missing describe().', [
      { field: 'describe', message: 'describe() is required.' },
    ])
  }
  return { ...adapter, id, kind }
}

/**
 * @param {object} adapter
 */
export function registerIntegrationAdapter(adapter) {
  const next = assertAdapterShape(adapter)
  adapters.set(adapterKey(next.kind, next.id), next)
  return next
}

/**
 * @param {string} kind
 * @param {string} adapterId
 */
export function getIntegrationAdapter(kind, adapterId) {
  return adapters.get(adapterKey(kind, adapterId)) || null
}

/**
 * @param {string} [kind]
 */
export function listIntegrationAdapters(kind) {
  const filter = kindKey(kind)
  const list = [...adapters.values()]
  if (!filter) return list.slice()
  return list.filter((item) => item.kind === filter)
}

export function resetIntegrationAdapterRegistry() {
  adapters.clear()
  registerNullIntegrationAdapters()
}

function createNullAdapter(kind, id) {
  return Object.freeze({
    id,
    kind,
    isEnabled(_companyConfig) {
      return false
    },
    describe() {
      return makeIntegrationAdapterDescriptor({ id, kind })
    },
  })
}

export function createNullDeliveryAdapter() {
  return createNullAdapter(
    INTEGRATION_KIND.DELIVERY,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.DELIVERY],
  )
}

export function createNullCrmAdapter() {
  return createNullAdapter(
    INTEGRATION_KIND.CRM,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CRM],
  )
}

export function createNullCalendarAdapter() {
  return createNullAdapter(
    INTEGRATION_KIND.CALENDAR,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR],
  )
}

export function createNullMessagingAdapter() {
  return createNullAdapter(
    INTEGRATION_KIND.MESSAGING,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.MESSAGING],
  )
}

export function createNullOutboundWebhookAdapter() {
  return createNullAdapter(
    INTEGRATION_KIND.OUTBOUND_WEBHOOK,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.OUTBOUND_WEBHOOK],
  )
}

export function registerNullIntegrationAdapters() {
  registerIntegrationAdapter(createNullDeliveryAdapter())
  registerIntegrationAdapter(createNullCrmAdapter())
  registerIntegrationAdapter(createNullCalendarAdapter())
  registerIntegrationAdapter(createNullMessagingAdapter())
  registerIntegrationAdapter(createNullOutboundWebhookAdapter())
}

registerNullIntegrationAdapters()

/**
 * @param {string} kind
 * @param {string} adapterId
 * @param {object} [companyConfig]
 */
export function resolveEnabledIntegrationAdapter(kind, adapterId, companyConfig) {
  const adapter = getIntegrationAdapter(kind, adapterId)
  if (!adapter) {
    return {
      ok: false,
      reason: INTEGRATION_REJECTION_REASON.UNKNOWN_ADAPTER,
      adapter: null,
    }
  }
  if (!adapter.isEnabled(companyConfig)) {
    return {
      ok: false,
      reason: INTEGRATION_REJECTION_REASON.DISABLED_ADAPTER,
      adapter,
    }
  }
  return { ok: true, reason: null, adapter }
}
