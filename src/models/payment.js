import { createRecordId } from './ids.js'

/**
 * Payment architecture. No Stripe (or other gateway) is wired.
 */

export const PAYMENT_PROVIDER = Object.freeze({
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  SQUARE: 'square',
  INVOICE: 'invoice',
  BANK: 'bank_transfer',
})

export const PAYMENT_PROVIDERS = Object.freeze(Object.values(PAYMENT_PROVIDER))

export const PAYMENT_PROVIDER_LABELS = Object.freeze({
  [PAYMENT_PROVIDER.STRIPE]: 'Stripe',
  [PAYMENT_PROVIDER.PAYPAL]: 'PayPal',
  [PAYMENT_PROVIDER.SQUARE]: 'Square',
  [PAYMENT_PROVIDER.INVOICE]: 'Manual invoice',
  [PAYMENT_PROVIDER.BANK]: 'Bank transfer',
})

export const PAYMENT_STATUS = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  OUTSTANDING: 'outstanding',
  DEPOSIT_DUE: 'deposit_due',
  PAID: 'paid',
  OVERDUE: 'overdue',
  FAILED: 'failed',
  REFUNDED: 'refunded',
})

export const PAYMENT_STATUSES = Object.freeze(Object.values(PAYMENT_STATUS))

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.NOT_REQUESTED]: 'Not requested',
  [PAYMENT_STATUS.OUTSTANDING]: 'Outstanding',
  [PAYMENT_STATUS.DEPOSIT_DUE]: 'Deposit due',
  [PAYMENT_STATUS.PAID]: 'Paid',
  [PAYMENT_STATUS.OVERDUE]: 'Overdue',
  [PAYMENT_STATUS.FAILED]: 'Failed',
  [PAYMENT_STATUS.REFUNDED]: 'Refunded',
})

/**
 * @typedef {object} ProposalPayment
 * @property {string} id
 * @property {string} proposalId
 * @property {string} status
 * @property {string} provider
 * @property {string} currency
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} discount
 * @property {number} deposit
 * @property {number} remainingBalance
 * @property {number} paidAmount
 * @property {number} balance
 * @property {string | null} dueAt
 * @property {object[]} schedule
 * @property {{ number: string, issuedAt: string | null, dueAt: string | null, status: string }} invoice
 * @property {string} transactionReference
 */

function money(value) {
  const next = Number(value ?? 0)
  return Number.isFinite(next) ? next : 0
}

function isPastDue(iso) {
  if (!iso) return false
  const end = Date.parse(iso)
  return Number.isFinite(end) && Date.now() > end
}

/**
 * @param {Partial<{ id: string, label: string, amount: number, dueAt: string | null, status: string }>} [input]
 */
export function makePaymentScheduleItem(input = {}) {
  return {
    id: input.id ?? createRecordId('sch'),
    label: String(input.label ?? '').trim() || 'Payment',
    amount: money(input.amount),
    dueAt: input.dueAt ?? null,
    status: PAYMENT_STATUSES.includes(input.status)
      ? input.status
      : PAYMENT_STATUS.OUTSTANDING,
  }
}

export function makeProposalPayment(input = {}) {
  const subtotal = money(input.subtotal)
  const tax = money(input.tax)
  const discount = money(input.discount)
  const deposit = money(input.deposit)
  const paidAmount = money(input.paidAmount)
  const total = Math.max(0, subtotal + tax - discount)
  const remainingBalance =
    input.remainingBalance == null ? Math.max(0, total - paidAmount) : money(input.remainingBalance)
  const dueAt = input.dueAt ?? input.invoice?.dueAt ?? null
  let status = PAYMENT_STATUSES.includes(input.status)
    ? input.status
    : paidAmount >= total && total > 0
      ? PAYMENT_STATUS.PAID
      : deposit > 0 && paidAmount < deposit
        ? PAYMENT_STATUS.DEPOSIT_DUE
        : total > 0
          ? PAYMENT_STATUS.OUTSTANDING
          : PAYMENT_STATUS.NOT_REQUESTED
  if (
    remainingBalance > 0 &&
    isPastDue(dueAt) &&
    status !== PAYMENT_STATUS.PAID &&
    status !== PAYMENT_STATUS.REFUNDED &&
    status !== PAYMENT_STATUS.NOT_REQUESTED
  ) {
    status = PAYMENT_STATUS.OVERDUE
  }
  const provider = PAYMENT_PROVIDERS.includes(input.provider)
    ? input.provider
    : PAYMENT_PROVIDER.INVOICE
  const schedule = Array.isArray(input.schedule) && input.schedule.length
    ? input.schedule.map((item) => makePaymentScheduleItem(item))
    : deposit > 0 || remainingBalance > 0
      ? [
          ...(deposit > 0
            ? [
                makePaymentScheduleItem({
                  label: 'Deposit',
                  amount: deposit,
                  status:
                    paidAmount >= deposit
                      ? PAYMENT_STATUS.PAID
                      : PAYMENT_STATUS.DEPOSIT_DUE,
                }),
              ]
            : []),
          ...(remainingBalance > 0
            ? [
                makePaymentScheduleItem({
                  label: 'Balance',
                  amount: remainingBalance,
                  dueAt,
                  status:
                    status === PAYMENT_STATUS.PAID
                      ? PAYMENT_STATUS.PAID
                      : status,
                }),
              ]
            : []),
        ]
      : []

  return {
    id: input.id ?? createRecordId('pay'),
    proposalId: input.proposalId ?? '',
    status,
    provider,
    currency: input.currency ?? 'USD',
    subtotal,
    tax,
    discount,
    deposit,
    remainingBalance,
    balance: remainingBalance,
    paidAmount,
    dueAt,
    schedule,
    invoice: {
      number: String(input.invoice?.number ?? '').trim(),
      issuedAt: input.invoice?.issuedAt ?? null,
      dueAt: input.invoice?.dueAt ?? dueAt,
      status: String(input.invoice?.status ?? 'placeholder').trim() || 'placeholder',
    },
    transactionReference: String(input.transactionReference ?? '').trim(),
  }
}

/**
 * Resolve how much a client Pay Now action should collect.
 *
 * @param {ProposalPayment | null | undefined} payment
 * @param {'deposit' | 'balance'} [kind]
 * @returns {number}
 */
export function clientPaymentAmount(payment, kind = 'balance') {
  const current = makeProposalPayment(payment ?? {})
  const total = Math.max(0, current.subtotal + current.tax - current.discount)
  const remaining = Math.max(0, total - current.paidAmount)
  if (remaining <= 0) return 0
  if (kind === 'deposit' && current.deposit > 0) {
    const due = Math.max(0, current.deposit - current.paidAmount)
    return due > 0 ? Math.min(due, remaining) : remaining
  }
  return remaining
}
