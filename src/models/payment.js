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
  FAILED: 'failed',
  REFUNDED: 'refunded',
})

export const PAYMENT_STATUSES = Object.freeze(Object.values(PAYMENT_STATUS))

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.NOT_REQUESTED]: 'Not requested',
  [PAYMENT_STATUS.OUTSTANDING]: 'Outstanding',
  [PAYMENT_STATUS.DEPOSIT_DUE]: 'Deposit due',
  [PAYMENT_STATUS.PAID]: 'Paid',
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
 * @property {string} transactionReference
 */

function money(value) {
  const next = Number(value ?? 0)
  return Number.isFinite(next) ? next : 0
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
  const status = PAYMENT_STATUSES.includes(input.status)
    ? input.status
    : paidAmount >= total && total > 0
      ? PAYMENT_STATUS.PAID
      : deposit > 0 && paidAmount < deposit
        ? PAYMENT_STATUS.DEPOSIT_DUE
        : total > 0
          ? PAYMENT_STATUS.OUTSTANDING
          : PAYMENT_STATUS.NOT_REQUESTED
  const provider = PAYMENT_PROVIDERS.includes(input.provider)
    ? input.provider
    : PAYMENT_PROVIDER.INVOICE

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
    paidAmount,
    transactionReference: String(input.transactionReference ?? '').trim(),
  }
}
