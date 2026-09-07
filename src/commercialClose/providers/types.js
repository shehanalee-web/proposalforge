/**
 * H15.6 — Provider-neutral CommercialClose adapter contracts.
 *
 * Vendors never own CommercialClose, proposal content, or pricing.
 * Real SDKs / OAuth / live webhooks are out of scope for H15.6.
 */

export const PROVIDER_KIND = Object.freeze({
  SIGNATURE: 'signature',
  PAYMENT: 'payment',
})

export const PROVIDER_KINDS = Object.freeze(Object.values(PROVIDER_KIND))

/** Architectural null adapters — never enabled, never call externals. */
export const NULL_PROVIDER_ID = Object.freeze({
  SIGNATURE: 'null_signature',
  PAYMENT: 'null_payment',
})

export const PROVIDER_SIGNAL_OUTCOME = Object.freeze({
  COMPLETED: 'completed',
  DECLINED: 'declined',
  VOIDED: 'voided',
  EXPIRED: 'expired',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  IGNORED: 'ignored',
})

export const PROVIDER_SIGNAL_OUTCOMES = Object.freeze(
  Object.values(PROVIDER_SIGNAL_OUTCOME),
)

export const PROVIDER_APPLY_RESULT = Object.freeze({
  APPLIED: 'applied',
  DUPLICATE: 'duplicate',
  IGNORED: 'ignored',
  REJECTED: 'rejected',
})

export const PROVIDER_APPLY_RESULTS = Object.freeze(
  Object.values(PROVIDER_APPLY_RESULT),
)

export const PROVIDER_REJECTION_REASON = Object.freeze({
  UNKNOWN_PROVIDER: 'unknown_provider',
  DISABLED_ADAPTER: 'disabled_adapter',
  INVALID_ENVELOPE: 'invalid_envelope',
  INVALID_AUTH: 'invalid_auth',
  COMPANY_MISMATCH: 'company_mismatch',
  UNBOUND_REFERENCE: 'unbound_reference',
  TERMINAL_CLOSE: 'terminal_close',
  STALE_SIGNAL: 'stale_signal',
  BINDING_MISMATCH: 'binding_mismatch',
  AMOUNT_MISMATCH: 'amount_mismatch',
  CURRENCY_MISMATCH: 'currency_mismatch',
  VENDORS_DISABLED: 'vendors_disabled',
  UNKNOWN_EVENT: 'unknown_event',
  INVALID_SIGNAL: 'invalid_signal',
})

function asString(value) {
  return value == null ? '' : String(value)
}

function asOptionalId(value) {
  const id = asString(value).trim()
  return id || null
}

function asIso(value, fallback = null) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * @param {object} [input]
 */
export function makeProviderRef(input = {}) {
  const providerKind = PROVIDER_KINDS.includes(input.providerKind)
    ? input.providerKind
    : null
  return Object.freeze({
    providerId: asString(input.providerId).trim(),
    providerKind,
    externalId: asString(input.externalId).trim(),
    externalStatus: asString(input.externalStatus).trim() || null,
    externalCreatedAt: asIso(input.externalCreatedAt, null),
    externalUpdatedAt: asIso(input.externalUpdatedAt, null),
  })
}

/**
 * Authenticated provider event envelope (after verifyWebhook).
 * companyId / closeId must be resolved server-side — never trusted from clients.
 *
 * @param {object} [input]
 */
export function makeProviderEventEnvelope(input = {}) {
  const providerKind = PROVIDER_KINDS.includes(input.providerKind)
    ? input.providerKind
    : null
  const providerRef =
    input.providerRef && typeof input.providerRef === 'object'
      ? makeProviderRef(input.providerRef)
      : null

  return Object.freeze({
    providerId: asString(input.providerId).trim(),
    providerKind,
    providerEventId: asString(input.providerEventId).trim(),
    providerEventType: asString(input.providerEventType).trim(),
    providerOccurredAt: asIso(input.providerOccurredAt, null),
    receivedAt: asIso(input.receivedAt, nowIso()),
    companyId: asString(input.companyId).trim(),
    closeId: asOptionalId(input.closeId),
    requestId: asOptionalId(input.requestId),
    providerRef,
    payloadDigest: asString(input.payloadDigest).trim() || null,
    rawVerified: input.rawVerified === true,
  })
}

/**
 * Domain signal produced by an adapter mapProviderEvent().
 *
 * @param {object} [input]
 */
export function makeProviderSignal(input = {}) {
  const providerKind = PROVIDER_KINDS.includes(input.providerKind)
    ? input.providerKind
    : null
  const outcome = PROVIDER_SIGNAL_OUTCOMES.includes(input.outcome)
    ? input.outcome
    : PROVIDER_SIGNAL_OUTCOME.IGNORED
  const providerRef =
    input.providerRef && typeof input.providerRef === 'object'
      ? makeProviderRef(input.providerRef)
      : null

  return Object.freeze({
    providerId: asString(input.providerId).trim(),
    providerKind,
    outcome,
    companyId: asString(input.companyId).trim(),
    closeId: asOptionalId(input.closeId),
    requestId: asOptionalId(input.requestId),
    providerEventId: asOptionalId(input.providerEventId),
    providerEventType: asString(input.providerEventType).trim() || null,
    providerOccurredAt: asIso(input.providerOccurredAt, null),
    providerRef,
    signerDisplayName: asString(input.signerDisplayName).trim() || null,
    payerDisplayName: asString(input.payerDisplayName).trim() || null,
    amount:
      input.amount == null || input.amount === ''
        ? null
        : Number(input.amount),
    currency: asString(input.currency).trim() || null,
    evidenceRef: asOptionalId(input.evidenceRef),
    metadata:
      input.metadata && typeof input.metadata === 'object'
        ? Object.freeze({ ...input.metadata })
        : Object.freeze({}),
  })
}

/**
 * @param {object | null | undefined} ref
 */
export function isValidProviderRef(ref) {
  if (!ref || typeof ref !== 'object') return false
  const next = makeProviderRef(ref)
  return Boolean(
    next.providerId &&
      next.providerKind &&
      PROVIDER_KINDS.includes(next.providerKind) &&
      next.externalId,
  )
}

/**
 * @param {object | null | undefined} envelope
 */
export function isValidProviderEventEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return false
  const next = makeProviderEventEnvelope(envelope)
  if (!next.providerId) return false
  if (!next.providerKind || !PROVIDER_KINDS.includes(next.providerKind)) {
    return false
  }
  if (!next.providerEventId) return false
  if (!next.companyId) return false
  if (next.rawVerified !== true) return false
  return true
}
