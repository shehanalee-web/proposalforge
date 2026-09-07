import { createRecordId } from '../models/ids.js'
import {
  CLOSE_INVOICE_KIND,
  CLOSE_INVOICE_KINDS,
  CLOSE_INVOICE_METHOD,
  CLOSE_INVOICE_METHODS,
  CLOSE_INVOICE_STATUS,
  CLOSE_INVOICE_STATUSES,
} from './types.js'
import { resolveClosePaymentAmounts } from './paymentSchema.js'

/**
 * Provider-neutral CommercialClose invoice record (H15.5).
 * Internal architecture only. Not an accounting system.
 * Amounts remain bound to the immutable CommercialClose decision.
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
export function makeCloseInvoiceBinding(input = {}) {
  return Object.freeze({
    closeId: asString(input.closeId).trim(),
    sessionId: asString(input.sessionId).trim(),
    proposalId: asString(input.proposalId).trim(),
    companyId: asString(input.companyId).trim(),
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
export function makeCloseInvoiceRequest(input = {}) {
  const method = CLOSE_INVOICE_METHODS.includes(input.method)
    ? input.method
    : CLOSE_INVOICE_METHOD.INTERNAL
  const kind = CLOSE_INVOICE_KINDS.includes(input.kind)
    ? input.kind
    : CLOSE_INVOICE_KIND.FULL
  const binding = makeCloseInvoiceBinding(input.binding ?? input)
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cinvr'),
    status: CLOSE_INVOICE_STATUSES.includes(input.status)
      ? input.status
      : CLOSE_INVOICE_STATUS.DRAFT,
    method,
    kind,
    currency: asString(input.currency).trim() || 'USD',
    total: asMoney(input.total, 0),
    createdAt: asIso(input.createdAt, nowIso()),
    createdByActorId: asOptionalId(input.createdByActorId),
    binding,
  })
}

/**
 * Issued invoice record bound to the immutable close decision.
 *
 * @param {object} [input]
 */
export function makeCloseInvoiceRecord(input = {}) {
  const binding = makeCloseInvoiceBinding(input.binding ?? input)
  const kind = CLOSE_INVOICE_KINDS.includes(input.kind)
    ? input.kind
    : CLOSE_INVOICE_KIND.FULL
  const total = asMoney(input.total, 0)
  const amountPaid = asMoney(input.amountPaid, 0)
  const amountRemaining =
    input.amountRemaining == null
      ? Math.max(0, total - amountPaid)
      : asMoney(input.amountRemaining, Math.max(0, total - amountPaid))
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cinv'),
    number: asString(input.number).trim(),
    status: CLOSE_INVOICE_STATUSES.includes(input.status)
      ? input.status
      : CLOSE_INVOICE_STATUS.ISSUED,
    method: CLOSE_INVOICE_METHODS.includes(input.method)
      ? input.method
      : CLOSE_INVOICE_METHOD.INTERNAL,
    kind,
    currency: asString(input.currency).trim() || 'USD',
    total,
    amountPaid,
    amountRemaining,
    issuedAt: asIso(input.issuedAt, nowIso()),
    dueAt: asIso(input.dueAt, null),
    issuedByActorId: asOptionalId(input.issuedByActorId),
    binding,
  })
}

/**
 * Invoice aggregate owned by CommercialClose.
 *
 * @param {object} [input]
 */
export function makeCloseInvoice(input = {}) {
  const status = CLOSE_INVOICE_STATUSES.includes(input.status)
    ? input.status
    : CLOSE_INVOICE_STATUS.NOT_REQUESTED
  const method =
    input.method == null || input.method === ''
      ? null
      : CLOSE_INVOICE_METHODS.includes(input.method)
        ? input.method
        : CLOSE_INVOICE_METHOD.INTERNAL
  const kind = CLOSE_INVOICE_KINDS.includes(input.kind)
    ? input.kind
    : CLOSE_INVOICE_KIND.FULL
  const request =
    input.request && typeof input.request === 'object'
      ? makeCloseInvoiceRequest(input.request)
      : null
  const record =
    input.record && typeof input.record === 'object'
      ? makeCloseInvoiceRecord(input.record)
      : null

  const total = record?.total ?? asMoney(input.total, 0)
  const amountPaid = record?.amountPaid ?? asMoney(input.amountPaid, 0)
  const amountRemaining =
    record?.amountRemaining ??
    (input.amountRemaining == null
      ? Math.max(0, total - amountPaid)
      : asMoney(input.amountRemaining, Math.max(0, total - amountPaid)))

  return Object.freeze({
    required: Boolean(input.required),
    status,
    method,
    kind,
    currency: record?.currency || asString(input.currency).trim() || 'USD',
    total,
    amountPaid,
    amountRemaining,
    request,
    record,
    completedAt: asIso(input.completedAt, null),
  })
}

/**
 * Build invoice state anchored to the immutable close decision + payment evidence.
 *
 * @param {object} close
 * @param {object} [invoiceInput]
 */
export function makeCloseInvoiceFromDecision(close, invoiceInput = {}) {
  const amounts = resolveClosePaymentAmounts(close?.decision ?? {}, close?.payment ?? {})
  const kind = CLOSE_INVOICE_KINDS.includes(invoiceInput.kind)
    ? invoiceInput.kind
    : invoiceInput.record?.kind && CLOSE_INVOICE_KINDS.includes(invoiceInput.record.kind)
      ? invoiceInput.record.kind
      : CLOSE_INVOICE_KIND.FULL

  const record =
    invoiceInput.record && typeof invoiceInput.record === 'object'
      ? makeCloseInvoiceRecord({
          ...invoiceInput.record,
          kind,
          currency: amounts.currency,
          total: amounts.requiredAmount,
          amountPaid: amounts.recordedAmount,
          amountRemaining: amounts.remainingAmount,
        })
      : null

  return makeCloseInvoice({
    ...invoiceInput,
    kind,
    currency: amounts.currency,
    total: amounts.requiredAmount,
    amountPaid: amounts.recordedAmount,
    amountRemaining: amounts.remainingAmount,
    record,
  })
}

/**
 * Studio presentation.
 *
 * @param {object | null | undefined} invoice
 */
export function presentCloseInvoice(invoice) {
  if (!invoice) return null
  const next = makeCloseInvoice(invoice)
  return {
    required: next.required,
    status: next.status,
    method: next.method,
    kind: next.kind,
    currency: next.currency,
    total: next.total,
    amountPaid: next.amountPaid,
    amountRemaining: next.amountRemaining,
    request: next.request
      ? {
          id: next.request.id,
          status: next.request.status,
          method: next.request.method,
          kind: next.request.kind,
          currency: next.request.currency,
          total: next.request.total,
          createdAt: next.request.createdAt,
          createdByActorId: next.request.createdByActorId,
          binding: { ...next.request.binding },
        }
      : null,
    record: next.record
      ? {
          id: next.record.id,
          number: next.record.number,
          status: next.record.status,
          method: next.record.method,
          kind: next.record.kind,
          currency: next.record.currency,
          total: next.record.total,
          amountPaid: next.record.amountPaid,
          amountRemaining: next.record.amountRemaining,
          issuedAt: next.record.issuedAt,
          dueAt: next.record.dueAt,
          issuedByActorId: next.record.issuedByActorId,
          binding: { ...next.record.binding },
        }
      : null,
    completedAt: next.completedAt,
  }
}

/**
 * Client-safe invoice projection.
 *
 * @param {object | null | undefined} invoice
 */
export function presentClientCloseInvoice(invoice) {
  if (!invoice) return null
  const next = makeCloseInvoice(invoice)
  return {
    required: next.required,
    status: next.status,
    method: next.method === CLOSE_INVOICE_METHOD.INTERNAL ? next.method : null,
    kind: next.kind,
    currency: next.currency,
    total: next.total,
    amountPaid: next.amountPaid,
    amountRemaining: next.amountRemaining,
    completedAt: next.completedAt,
    record: next.record
      ? {
          number: next.record.number,
          status: next.record.status,
          currency: next.record.currency,
          total: next.record.total,
          amountPaid: next.record.amountPaid,
          amountRemaining: next.record.amountRemaining,
          issuedAt: next.record.issuedAt,
          dueAt: next.record.dueAt,
        }
      : null,
  }
}
