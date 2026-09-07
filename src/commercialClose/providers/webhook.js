/**
 * H15.6 — Provider-neutral webhook / event infrastructure (pure).
 *
 * No live HTTP ingress. externalWebhooks remains false.
 * Idempotency identity: (companyId, providerId, providerEventId).
 */

import { createHash } from 'node:crypto'
import {
  getProviderAdapter,
  resolveEnabledProviderAdapter,
} from './adapter.js'
import {
  PROVIDER_KINDS,
  PROVIDER_REJECTION_REASON,
  isValidProviderEventEnvelope,
  isValidProviderRef,
  makeProviderEventEnvelope,
} from './types.js'
import { getCommercialCloseProviderConfig } from '../providerConfig.js'
import {
  canTransitionCommercialCloseStatus,
} from '../transitions.js'
import {
  COMMERCIAL_CLOSE_STATUS,
  isTerminalCommercialCloseStatus,
} from '../types.js'

/** In-process receipt ledger for architecture/contract tests. */
let receipts = new Map()

function receiptKey(companyId, providerId, providerEventId) {
  return [
    String(companyId ?? '').trim(),
    String(providerId ?? '').trim(),
    String(providerEventId ?? '').trim(),
  ].join('|')
}

/**
 * @param {string} companyId
 * @param {string} providerId
 * @param {string} providerEventId
 */
export function makeProviderIdempotencyKey(
  companyId,
  providerId,
  providerEventId,
) {
  const company = String(companyId ?? '').trim()
  const provider = String(providerId ?? '').trim()
  const eventId = String(providerEventId ?? '').trim()
  if (!company || !provider || !eventId) return null
  return receiptKey(company, provider, eventId)
}

/**
 * @param {string | Buffer | object | null | undefined} payload
 */
export function digestProviderPayload(payload) {
  let raw = ''
  if (payload == null) raw = ''
  else if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
    raw = String(payload)
  } else {
    try {
      raw = JSON.stringify(payload)
    } catch {
      raw = String(payload)
    }
  }
  return createHash('sha256').update(raw).digest('hex')
}

export function resetProviderWebhookReceipts() {
  receipts = new Map()
}

/**
 * @param {string} companyId
 * @param {string} providerId
 * @param {string} providerEventId
 */
export function hasProviderEventReceipt(
  companyId,
  providerId,
  providerEventId,
) {
  const key = makeProviderIdempotencyKey(companyId, providerId, providerEventId)
  if (!key) return false
  return receipts.has(key)
}

/**
 * @param {object} envelope
 * @param {object} [extra]
 */
export function recordProviderEventReceipt(envelope, extra = {}) {
  const next = makeProviderEventEnvelope(envelope)
  const key = makeProviderIdempotencyKey(
    next.companyId,
    next.providerId,
    next.providerEventId,
  )
  if (!key) {
    return {
      ok: false,
      duplicate: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_ENVELOPE,
      receipt: null,
    }
  }
  if (receipts.has(key)) {
    return {
      ok: true,
      duplicate: true,
      reason: null,
      receipt: receipts.get(key),
    }
  }
  const receipt = Object.freeze({
    key,
    companyId: next.companyId,
    providerId: next.providerId,
    providerEventId: next.providerEventId,
    providerKind: next.providerKind,
    closeId: next.closeId,
    receivedAt: next.receivedAt,
    payloadDigest: next.payloadDigest,
    ...extra,
  })
  receipts.set(key, receipt)
  return { ok: true, duplicate: false, reason: null, receipt }
}

/**
 * Normalize a verified provider event into an envelope.
 * Does not trust client-supplied company/close without server resolution context.
 *
 * @param {object} input
 * @param {{
 *   companyId: string,
 *   closeId?: string | null,
 *   requestId?: string | null,
 *   providerRef?: object | null,
 *   rawVerified?: boolean,
 * }} resolved
 */
export function normalizeProviderEvent(input = {}, resolved = {}) {
  const companyId = String(resolved.companyId ?? '').trim()
  if (!companyId) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_ENVELOPE,
      envelope: null,
    }
  }
  const envelope = makeProviderEventEnvelope({
    ...input,
    companyId,
    closeId: resolved.closeId ?? input.closeId ?? null,
    requestId: resolved.requestId ?? input.requestId ?? null,
    providerRef: resolved.providerRef ?? input.providerRef ?? null,
    payloadDigest:
      input.payloadDigest ||
      digestProviderPayload(input.rawBody ?? input.payload ?? input),
    rawVerified: resolved.rawVerified === true || input.rawVerified === true,
  })
  if (!isValidProviderEventEnvelope(envelope)) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_ENVELOPE,
      envelope: null,
    }
  }
  return { ok: true, reason: null, envelope }
}

/**
 * Pure webhook handling foundation (no HTTP).
 *
 * @param {{
 *   providerKind: string,
 *   providerId: string,
 *   companyId: string,
 *   close?: object | null,
 *   storedProviderRef?: object | null,
 *   request?: object,
 *   rawBody?: string | Buffer,
 *   headers?: object,
 * }} input
 */
export function processProviderWebhookFoundation(input = {}) {
  const providerKind = String(input.providerKind ?? '').trim()
  const providerId = String(input.providerId ?? '').trim()
  const companyId = String(input.companyId ?? '').trim()

  if (!PROVIDER_KINDS.includes(providerKind) || !providerId) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_PROVIDER,
      envelope: null,
      signal: null,
    }
  }

  if (!companyId) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason: PROVIDER_REJECTION_REASON.INVALID_ENVELOPE,
      envelope: null,
      signal: null,
    }
  }

  const config = getCommercialCloseProviderConfig(companyId, providerId)
  const resolved = resolveEnabledProviderAdapter(
    providerKind,
    providerId,
    config,
  )
  if (!resolved.ok) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason: resolved.reason,
      envelope: null,
      signal: null,
    }
  }

  const adapter = resolved.adapter
  const verified = adapter.verifyWebhook({
    rawBody: input.rawBody,
    headers: input.headers ?? {},
    request: input.request ?? {},
    config,
  })
  if (!verified || verified.ok === false || verified.rejected) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason:
        verified?.reason || PROVIDER_REJECTION_REASON.INVALID_AUTH,
      envelope: null,
      signal: null,
    }
  }

  const close = input.close && typeof input.close === 'object' ? input.close : null
  if (close && String(close.companyId ?? '').trim() !== companyId) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason: PROVIDER_REJECTION_REASON.COMPANY_MISMATCH,
      envelope: null,
      signal: null,
    }
  }

  const storedRef = input.storedProviderRef
  if (storedRef != null) {
    if (!isValidProviderRef(storedRef)) {
      return {
        ok: false,
        duplicate: false,
        ignored: false,
        reason: PROVIDER_REJECTION_REASON.UNBOUND_REFERENCE,
        envelope: null,
        signal: null,
      }
    }
    if (
      String(storedRef.providerId).trim() !== providerId ||
      String(storedRef.providerKind).trim() !== providerKind
    ) {
      return {
        ok: false,
        duplicate: false,
        ignored: false,
        reason: PROVIDER_REJECTION_REASON.UNBOUND_REFERENCE,
        envelope: null,
        signal: null,
      }
    }
  } else if (!close?.id) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason: PROVIDER_REJECTION_REASON.UNBOUND_REFERENCE,
      envelope: null,
      signal: null,
    }
  }

  const normalized = normalizeProviderEvent(verified.envelope ?? input.request, {
    companyId,
    closeId: close?.id ?? null,
    requestId:
      close?.signature?.request?.id ||
      close?.payment?.request?.id ||
      null,
    providerRef: storedRef ?? verified.envelope?.providerRef ?? null,
    rawVerified: true,
  })
  if (!normalized.ok) {
    return {
      ok: false,
      duplicate: false,
      ignored: false,
      reason: normalized.reason,
      envelope: null,
      signal: null,
    }
  }

  const envelope = normalized.envelope
  if (hasProviderEventReceipt(
    envelope.companyId,
    envelope.providerId,
    envelope.providerEventId,
  )) {
    return {
      ok: true,
      duplicate: true,
      ignored: false,
      reason: null,
      envelope,
      signal: null,
      receipt: receipts.get(
        makeProviderIdempotencyKey(
          envelope.companyId,
          envelope.providerId,
          envelope.providerEventId,
        ),
      ),
    }
  }

  if (close && isTerminalCommercialCloseStatus(close.status)) {
    recordProviderEventReceipt(envelope, { ignored: true, terminal: true })
    return {
      ok: true,
      duplicate: false,
      ignored: true,
      reason: PROVIDER_REJECTION_REASON.TERMINAL_CLOSE,
      envelope,
      signal: null,
    }
  }

  const signal = adapter.mapProviderEvent(envelope)
  if (!signal || signal.outcome === 'ignored') {
    const reason =
      signal?.metadata?.reason || PROVIDER_REJECTION_REASON.UNKNOWN_EVENT
    recordProviderEventReceipt(envelope, { ignored: true, reason })
    return {
      ok: true,
      duplicate: false,
      ignored: true,
      reason,
      envelope,
      signal,
    }
  }

  const order = evaluateProviderSignalOrdering(close, signal)
  if (order.ignore) {
    recordProviderEventReceipt(envelope, {
      ignored: true,
      reason: order.reason,
    })
    return {
      ok: true,
      duplicate: false,
      ignored: true,
      reason: order.reason,
      envelope,
      signal,
    }
  }

  recordProviderEventReceipt(envelope)
  return {
    ok: true,
    duplicate: false,
    ignored: false,
    reason: null,
    envelope,
    signal,
  }
}

/**
 * Domain ordering policy: vendor timestamps never override internal state.
 * Never regress signed/paid/closed. Stale pending after completion → ignore.
 *
 * @param {object | null | undefined} close
 * @param {object} signal
 */
export function evaluateProviderSignalOrdering(close, signal) {
  if (!close) {
    return { ignore: false, reason: null }
  }
  if (isTerminalCommercialCloseStatus(close.status)) {
    return { ignore: true, reason: PROVIDER_REJECTION_REASON.TERMINAL_CLOSE }
  }

  const outcome = String(signal?.outcome ?? '')
  const status = close.status

  if (
    outcome === 'completed' &&
    signal?.providerKind === 'signature' &&
    status === COMMERCIAL_CLOSE_STATUS.SIGNED
  ) {
    return { ignore: true, reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL }
  }
  if (
    outcome === 'completed' &&
    signal?.providerKind === 'payment' &&
    (status === COMMERCIAL_CLOSE_STATUS.PAID ||
      status === COMMERCIAL_CLOSE_STATUS.CLOSED)
  ) {
    return { ignore: true, reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL }
  }

  // Pending / failed after completion is stale.
  if (
    (outcome === 'failed' ||
      outcome === 'ignored' ||
      outcome === 'declined' ||
      outcome === 'cancelled') &&
    (status === COMMERCIAL_CLOSE_STATUS.SIGNED ||
      status === COMMERCIAL_CLOSE_STATUS.PAID ||
      status === COMMERCIAL_CLOSE_STATUS.CLOSED)
  ) {
    return { ignore: true, reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL }
  }

  // Cancel/expire only if H15.2 allows from current status.
  if (outcome === 'expired') {
    const allowed = canTransitionCommercialCloseStatus(
      status,
      COMMERCIAL_CLOSE_STATUS.EXPIRED,
    )
    if (!allowed) {
      return { ignore: true, reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL }
    }
  }
  if (outcome === 'cancelled' || outcome === 'declined' || outcome === 'voided') {
    const allowed = canTransitionCommercialCloseStatus(
      status,
      COMMERCIAL_CLOSE_STATUS.CANCELLED,
    )
    if (!allowed && status !== COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING &&
      status !== COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
      return { ignore: true, reason: PROVIDER_REJECTION_REASON.STALE_SIGNAL }
    }
  }

  return { ignore: false, reason: null }
}

/**
 * Reject unknown providers without consulting a disabled null adapter as "enabled".
 *
 * @param {string} providerKind
 * @param {string} providerId
 */
export function rejectUnknownProvider(providerKind, providerId) {
  const adapter = getProviderAdapter(providerKind, providerId)
  if (!adapter) {
    return {
      ok: false,
      reason: PROVIDER_REJECTION_REASON.UNKNOWN_PROVIDER,
    }
  }
  return { ok: true, reason: null, adapter }
}
