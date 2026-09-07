import { createRecordId } from '../models/ids.js'
import {
  CLOSE_PAYMENT_KIND,
  CLOSE_PAYMENT_KINDS,
  CLOSE_PAYMENT_METHOD,
  CLOSE_PAYMENT_METHODS,
  CLOSE_PAYMENT_STATUS,
  CLOSE_PAYMENT_STATUSES,
} from './types.js'

/**
 * Provider-neutral CommercialClose payment request + evidence (H15.4).
 * Internal/manual is the only supported method. No vendor SDKs.
 */

function asString(value) {
  return value == null ? '' : String(value)
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

function asOptionalId(value) {
  const id = asString(value).trim()
  return id || null
}

function asMoney(value, fallback = 0) {
  if (value == null || value === '') return fallback
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

/**
 * Binding anchors — does not duplicate the H14 decision payload.
 *
 * @param {object} [input]
 */
export function makeClosePaymentBinding(input = {}) {
  return Object.freeze({
    closeId: asString(input.closeId).trim(),
    sessionId: asString(input.sessionId).trim(),
    proposalId: asString(input.proposalId).trim(),
    acceptedAt: asString(input.acceptedAt).trim() || null,
    publicationId: asOptionalId(input.publicationId),
    snapshotNumber:
      input.snapshotNumber == null || input.snapshotNumber === ''
        ? null
        : Number(input.snapshotNumber),
    proposalVersion:
      input.proposalVersion == null || input.proposalVersion === ''
        ? null
        : Number(input.proposalVersion),
  })
}

/**
 * @param {object} [input]
 */
export function makeClosePaymentRequest(input = {}) {
  const method = CLOSE_PAYMENT_METHODS.includes(input.method)
    ? input.method
    : CLOSE_PAYMENT_METHOD.INTERNAL
  const kind = CLOSE_PAYMENT_KINDS.includes(input.kind)
    ? input.kind
    : CLOSE_PAYMENT_KIND.FULL
  const binding = makeClosePaymentBinding(input.binding ?? input)
  const requiredAmount = asMoney(input.requiredAmount, 0)
  const remainingAmount =
    input.remainingAmount == null
      ? requiredAmount
      : asMoney(input.remainingAmount, requiredAmount)
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cpayr'),
    status: CLOSE_PAYMENT_STATUSES.includes(input.status)
      ? input.status
      : CLOSE_PAYMENT_STATUS.PENDING,
    method,
    kind,
    currency: asString(input.currency).trim() || 'USD',
    requiredAmount,
    remainingAmount,
    createdAt: asIso(input.createdAt, nowIso()),
    createdByActorId: asOptionalId(input.createdByActorId),
    binding,
  })
}

/**
 * Provider-neutral payment evidence bound immutably to a close.
 *
 * @param {object} [input]
 */
export function makeClosePaymentEvidence(input = {}) {
  const method = CLOSE_PAYMENT_METHODS.includes(input.method)
    ? input.method
    : CLOSE_PAYMENT_METHOD.INTERNAL
  const kind = CLOSE_PAYMENT_KINDS.includes(input.kind)
    ? input.kind
    : CLOSE_PAYMENT_KIND.FULL
  const binding = makeClosePaymentBinding(input.binding ?? input)
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cpaye'),
    payerActorId: asOptionalId(input.payerActorId),
    payerDisplayName: asString(input.payerDisplayName).trim(),
    payerReference: asString(input.payerReference).trim(),
    amount: asMoney(input.amount, 0),
    currency: asString(input.currency).trim() || 'USD',
    paidAt: asIso(input.paidAt, nowIso()),
    method,
    kind,
    transactionReference: asString(input.transactionReference).trim(),
    evidenceRef: asOptionalId(input.evidenceRef),
    legacyProposalPaymentId: asOptionalId(input.legacyProposalPaymentId),
    valid: input.valid !== false,
    binding,
  })
}

function asEvidenceList(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => makeClosePaymentEvidence(item))
}

/**
 * Amounts always derive from the immutable CommercialClose decision when available.
 *
 * @param {object} [decision]
 * @param {object} [payment]
 */
export function resolveClosePaymentAmounts(decision = {}, payment = {}) {
  const requiredAmount =
    decision?.selectedTotal != null && Number.isFinite(Number(decision.selectedTotal))
      ? Number(decision.selectedTotal)
      : asMoney(payment.requiredAmount, 0)
  const currency =
    asString(decision?.currency).trim() ||
    asString(payment.currency).trim() ||
    'USD'
  const recordedAmount = Array.isArray(payment.evidence)
    ? payment.evidence
        .filter((item) => item && item.valid !== false)
        .reduce((sum, item) => sum + asMoney(item.amount, 0), 0)
    : asMoney(payment.recordedAmount, 0)
  const remainingAmount = Math.max(0, requiredAmount - recordedAmount)
  return {
    requiredAmount,
    recordedAmount,
    remainingAmount,
    currency,
  }
}

/**
 * Payment aggregate owned by CommercialClose.
 *
 * @param {object} [input]
 */
export function makeClosePayment(input = {}) {
  const status = CLOSE_PAYMENT_STATUSES.includes(input.status)
    ? input.status
    : CLOSE_PAYMENT_STATUS.NOT_REQUESTED
  const method =
    input.method == null || input.method === ''
      ? null
      : CLOSE_PAYMENT_METHODS.includes(input.method)
        ? input.method
        : CLOSE_PAYMENT_METHOD.INTERNAL
  const kind = CLOSE_PAYMENT_KINDS.includes(input.kind)
    ? input.kind
    : CLOSE_PAYMENT_KIND.FULL

  const request =
    input.request && typeof input.request === 'object'
      ? makeClosePaymentRequest(input.request)
      : null

  const evidence = asEvidenceList(input.evidence)
  const amounts = resolveClosePaymentAmounts(
    {
      selectedTotal: input.requiredAmount,
      currency: input.currency,
    },
    { ...input, evidence },
  )

  return Object.freeze({
    required: Boolean(input.required),
    status,
    method,
    kind,
    currency: amounts.currency,
    requiredAmount: amounts.requiredAmount,
    recordedAmount: amounts.recordedAmount,
    remainingAmount: amounts.remainingAmount,
    request,
    evidence,
    completedAt: asIso(input.completedAt, null),
  })
}

/**
 * Build payment state anchored to the immutable close decision.
 *
 * @param {object} close
 * @param {object} [paymentInput]
 */
export function makeClosePaymentFromDecision(close, paymentInput = {}) {
  const amounts = resolveClosePaymentAmounts(close?.decision ?? {}, {
    ...paymentInput,
    evidence: paymentInput.evidence,
  })
  return makeClosePayment({
    ...paymentInput,
    currency: amounts.currency,
    requiredAmount: amounts.requiredAmount,
    recordedAmount: amounts.recordedAmount,
    remainingAmount: amounts.remainingAmount,
  })
}

/**
 * True when evidence is present, bound to this close, internal, and covers required amount.
 *
 * @param {object} close
 */
export function hasValidPaymentEvidence(close) {
  if (!close?.payment) return false
  const payment = makeClosePaymentFromDecision(close, close.payment)
  if (payment.status !== CLOSE_PAYMENT_STATUS.COMPLETED) return false
  if (!payment.evidence.length) return false
  const closeId = asString(close.id).trim()
  const acceptedAt = asString(close.decision?.acceptedAt).trim()
  const decisionCurrency = asString(close.decision?.currency).trim()
  const requiredAmount =
    close.decision?.selectedTotal != null &&
    Number.isFinite(Number(close.decision.selectedTotal))
      ? Number(close.decision.selectedTotal)
      : payment.requiredAmount

  let recorded = 0
  let hasValidItem = false
  for (const item of payment.evidence) {
    if (item.valid === false) continue
    if (item.method !== CLOSE_PAYMENT_METHOD.INTERNAL) continue
    if (!item.paidAt) continue
    if (!(item.amount > 0)) continue
    if (decisionCurrency && item.currency && item.currency !== decisionCurrency) continue
    if (closeId && item.binding.closeId && item.binding.closeId !== closeId) continue
    if (
      acceptedAt &&
      item.binding.acceptedAt &&
      item.binding.acceptedAt !== acceptedAt
    ) {
      continue
    }
    recorded += item.amount
    hasValidItem = true
  }

  if (!hasValidItem) return false
  // Full settlement for H15.4; remaining stays for future partials.
  return recorded + 1e-9 >= requiredAmount
}

/**
 * Studio presentation of payment state.
 *
 * @param {object | null | undefined} payment
 */
export function presentClosePayment(payment) {
  if (!payment) return null
  const next = makeClosePayment(payment)
  return {
    required: next.required,
    status: next.status,
    method: next.method,
    kind: next.kind,
    currency: next.currency,
    requiredAmount: next.requiredAmount,
    recordedAmount: next.recordedAmount,
    remainingAmount: next.remainingAmount,
    request: next.request
      ? {
          id: next.request.id,
          status: next.request.status,
          method: next.request.method,
          kind: next.request.kind,
          currency: next.request.currency,
          requiredAmount: next.request.requiredAmount,
          remainingAmount: next.request.remainingAmount,
          createdAt: next.request.createdAt,
          createdByActorId: next.request.createdByActorId,
          binding: { ...next.request.binding },
        }
      : null,
    evidence: next.evidence.map((item) => ({
      id: item.id,
      payerActorId: item.payerActorId,
      payerDisplayName: item.payerDisplayName,
      payerReference: item.payerReference,
      amount: item.amount,
      currency: item.currency,
      paidAt: item.paidAt,
      method: item.method,
      kind: item.kind,
      transactionReference: item.transactionReference,
      evidenceRef: item.evidenceRef,
      legacyProposalPaymentId: item.legacyProposalPaymentId,
      valid: item.valid,
      binding: { ...item.binding },
    })),
    completedAt: next.completedAt,
  }
}

/**
 * Client-safe payment projection — no actor ids, no request internals.
 *
 * @param {object | null | undefined} payment
 */
export function presentClientClosePayment(payment) {
  if (!payment) return null
  const next = makeClosePayment(payment)
  return {
    required: next.required,
    status: next.status,
    method: next.method === CLOSE_PAYMENT_METHOD.INTERNAL ? next.method : null,
    kind: next.kind,
    currency: next.currency,
    requiredAmount: next.requiredAmount,
    recordedAmount: next.recordedAmount,
    remainingAmount: next.remainingAmount,
    completedAt: next.completedAt,
    payments: next.evidence
      .filter((item) => item.valid !== false)
      .map((item) => ({
        amount: item.amount,
        currency: item.currency,
        paidAt: item.paidAt,
        method: item.method,
        kind: item.kind,
      })),
  }
}
