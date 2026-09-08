/**
 * H15.6 — Provider adapter registry (signature + payment).
 *
 * Adapters never own CommercialClose state and never call vendor SDKs here.
 * Null adapters are architectural placeholders with isEnabled() === false.
 */

import { ValidationError } from '../../services/errors.js'
import {
  NULL_PROVIDER_ID,
  PROVIDER_KIND,
  PROVIDER_REJECTION_REASON,
  makeProviderEventEnvelope,
  makeProviderSignal,
  PROVIDER_SIGNAL_OUTCOME,
} from './types.js'

const adapters = new Map()

function kindKey(kind) {
  return String(kind ?? '').trim()
}

function adapterKey(kind, providerId) {
  return `${kindKey(kind)}::${String(providerId ?? '').trim()}`
}

function assertAdapterShape(adapter, expectedKind) {
  if (!adapter || typeof adapter !== 'object') {
    throw new ValidationError('Provider adapter is required.', [
      { field: 'adapter', message: 'adapter is required.' },
    ])
  }
  const id = String(adapter.id ?? '').trim()
  if (!id) {
    throw new ValidationError('Provider adapter id is required.', [
      { field: 'id', message: 'id is required.' },
    ])
  }
  if (adapter.kind !== expectedKind) {
    throw new ValidationError('Provider adapter kind mismatch.', [
      {
        field: 'kind',
        message: `Expected kind ${expectedKind}, got ${adapter.kind || 'unknown'}.`,
      },
    ])
  }
  const required =
    expectedKind === PROVIDER_KIND.SIGNATURE
      ? [
          'isEnabled',
          'createSignatureRequest',
          'cancelSignatureRequest',
          'mapProviderEvent',
          'toCloseEvidence',
          'verifyWebhook',
        ]
      : [
          'isEnabled',
          'createPaymentRequest',
          'cancelPaymentRequest',
          'mapProviderEvent',
          'toCloseEvidence',
          'verifyWebhook',
        ]
  for (const name of required) {
    if (typeof adapter[name] !== 'function') {
      throw new ValidationError(`Provider adapter missing ${name}().`, [
        { field: name, message: `${name}() is required.` },
      ])
    }
  }
  return { ...adapter, id, kind: expectedKind }
}

/**
 * @param {object} adapter
 */
export function registerProviderAdapter(adapter) {
  const kind = adapter?.kind
  if (kind !== PROVIDER_KIND.SIGNATURE && kind !== PROVIDER_KIND.PAYMENT) {
    throw new ValidationError('Unsupported provider kind.', [
      { field: 'kind', message: 'kind must be signature or payment.' },
    ])
  }
  const next = assertAdapterShape(adapter, kind)
  adapters.set(adapterKey(next.kind, next.id), next)
  return next
}

/**
 * @param {string} providerKind
 * @param {string} providerId
 */
export function getProviderAdapter(providerKind, providerId) {
  const key = adapterKey(providerKind, providerId)
  return adapters.get(key) || null
}

/**
 * @param {string} [providerKind]
 */
export function listProviderAdapters(providerKind) {
  const kind = kindKey(providerKind)
  const list = [...adapters.values()]
  if (!kind) return list.slice()
  return list.filter((item) => item.kind === kind)
}

export function resetProviderAdapterRegistry() {
  adapters.clear()
  registerNullProviderAdapters()
}

function disabledResult(reason = PROVIDER_REJECTION_REASON.DISABLED_ADAPTER) {
  return Object.freeze({
    ok: false,
    rejected: true,
    reason,
    providerRef: null,
    externalUrls: null,
  })
}

function rejectEnvelope(reason) {
  return Object.freeze({
    ok: false,
    rejected: true,
    reason,
    envelope: null,
  })
}

/**
 * Null signature adapter — placeholder only.
 */
export function createNullSignatureAdapter() {
  return Object.freeze({
    id: NULL_PROVIDER_ID.SIGNATURE,
    kind: PROVIDER_KIND.SIGNATURE,
    isEnabled(_companyConfig) {
      return false
    },
    createSignatureRequest() {
      return disabledResult()
    },
    cancelSignatureRequest() {
      return disabledResult()
    },
    mapProviderEvent(envelope) {
      const next = makeProviderEventEnvelope(envelope ?? {})
      return makeProviderSignal({
        providerId: next.providerId || NULL_PROVIDER_ID.SIGNATURE,
        providerKind: PROVIDER_KIND.SIGNATURE,
        outcome: PROVIDER_SIGNAL_OUTCOME.IGNORED,
        companyId: next.companyId,
        closeId: next.closeId,
        requestId: next.requestId,
        providerEventId: next.providerEventId,
        providerEventType: next.providerEventType,
        providerOccurredAt: next.providerOccurredAt,
        providerRef: next.providerRef,
        metadata: { reason: PROVIDER_REJECTION_REASON.DISABLED_ADAPTER },
      })
    },
    toCloseEvidence() {
      return null
    },
    verifyWebhook() {
      return rejectEnvelope(PROVIDER_REJECTION_REASON.DISABLED_ADAPTER)
    },
  })
}

/**
 * Null payment adapter — placeholder only.
 */
export function createNullPaymentAdapter() {
  return Object.freeze({
    id: NULL_PROVIDER_ID.PAYMENT,
    kind: PROVIDER_KIND.PAYMENT,
    isEnabled(_companyConfig) {
      return false
    },
    createPaymentRequest() {
      return disabledResult()
    },
    cancelPaymentRequest() {
      return disabledResult()
    },
    mapProviderEvent(envelope) {
      const next = makeProviderEventEnvelope(envelope ?? {})
      return makeProviderSignal({
        providerId: next.providerId || NULL_PROVIDER_ID.PAYMENT,
        providerKind: PROVIDER_KIND.PAYMENT,
        outcome: PROVIDER_SIGNAL_OUTCOME.IGNORED,
        companyId: next.companyId,
        closeId: next.closeId,
        requestId: next.requestId,
        providerEventId: next.providerEventId,
        providerEventType: next.providerEventType,
        providerOccurredAt: next.providerOccurredAt,
        providerRef: next.providerRef,
        metadata: { reason: PROVIDER_REJECTION_REASON.DISABLED_ADAPTER },
      })
    },
    toCloseEvidence() {
      return null
    },
    verifyWebhook() {
      return rejectEnvelope(PROVIDER_REJECTION_REASON.DISABLED_ADAPTER)
    },
  })
}

export function registerNullProviderAdapters() {
  registerProviderAdapter(createNullSignatureAdapter())
  registerProviderAdapter(createNullPaymentAdapter())
}

// Default registry bootstraps null adapters.
registerNullProviderAdapters()

/**
 * Resolve adapter or return rejection reason.
 *
 * @param {string} providerKind
 * @param {string} providerId
 * @param {object} [companyConfig]
 */
export function resolveEnabledProviderAdapter(
  providerKind,
  providerId,
  companyConfig,
) {
  const adapter = getProviderAdapter(providerKind, providerId)
  if (!adapter) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_PROVIDER,
      adapter: null,
    }
  }
  if (!adapter.isEnabled(companyConfig)) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.DISABLED_ADAPTER,
      adapter,
    }
  }
  return { ok: true, reason: null, adapter }
}
