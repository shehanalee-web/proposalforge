import { createRecordId, EMAIL_PATTERN } from './ids.js'

/**
 * Outbound proposal email. Delivery is owned by the mail provider; this record
 * is the studio's copy so Activity, retries, and future reminders share one id.
 *
 * Scheduled send, CC/BCC, and bulk remain fields on the payload — the UI can
 * grow without changing the provider contract.
 */

export const EMAIL_PROVIDER = Object.freeze({
  MOCK: 'mock',
  RESEND: 'resend',
  POSTMARK: 'postmark',
  SENDGRID: 'sendgrid',
  SES: 'ses',
})

export const EMAIL_PROVIDERS = Object.freeze(Object.values(EMAIL_PROVIDER))

export const EMAIL_DELIVERY_STATUS = Object.freeze({
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  OPENED: 'opened',
  FAILED: 'failed',
  BOUNCED: 'bounced',
})

export const EMAIL_DELIVERY_STATUSES = Object.freeze(
  Object.values(EMAIL_DELIVERY_STATUS),
)

export const EMAIL_DELIVERY_STATUS_LABELS = Object.freeze({
  [EMAIL_DELIVERY_STATUS.QUEUED]: 'Queued',
  [EMAIL_DELIVERY_STATUS.SENDING]: 'Sending…',
  [EMAIL_DELIVERY_STATUS.SENT]: 'Sent',
  [EMAIL_DELIVERY_STATUS.DELIVERED]: 'Delivered',
  [EMAIL_DELIVERY_STATUS.OPENED]: 'Opened',
  [EMAIL_DELIVERY_STATUS.FAILED]: 'Failed',
  [EMAIL_DELIVERY_STATUS.BOUNCED]: 'Bounced',
})

export const MAIL_ERROR_CODE = Object.freeze({
  INVALID_EMAIL: 'invalid_email',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  RATE_LIMIT: 'rate_limit',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  REJECTED: 'rejected',
})

const TERMINAL_FAILURE = new Set([
  EMAIL_DELIVERY_STATUS.FAILED,
  EMAIL_DELIVERY_STATUS.BOUNCED,
])

const STATUS_RANK = {
  [EMAIL_DELIVERY_STATUS.QUEUED]: 0,
  [EMAIL_DELIVERY_STATUS.SENDING]: 1,
  [EMAIL_DELIVERY_STATUS.SENT]: 2,
  [EMAIL_DELIVERY_STATUS.DELIVERED]: 3,
  [EMAIL_DELIVERY_STATUS.OPENED]: 4,
  [EMAIL_DELIVERY_STATUS.FAILED]: 50,
  [EMAIL_DELIVERY_STATUS.BOUNCED]: 51,
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export function isValidEmailAddress(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim())
}

export function normalizeEmailAddress(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * @typedef {object} EmailMessage
 * @property {string} id
 * @property {string} proposalId
 * @property {string} provider
 * @property {string | null} providerMessageId
 * @property {string} status
 * @property {string} fromName
 * @property {string} fromEmail
 * @property {string[]} to
 * @property {string[]} cc
 * @property {string[]} bcc
 * @property {string} subject
 * @property {string} message
 * @property {string} proposalUrl
 * @property {string} trackingUrl
 * @property {string | null} expiresAt
 * @property {string | null} scheduledAt
 * @property {string | null} sentAt
 * @property {string | null} errorCode
 * @property {string} error
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<EmailMessage> & object} [input]
 * @returns {EmailMessage}
 */
export function makeEmailMessage(input = {}) {
  const timestamp = new Date().toISOString()
  const status = EMAIL_DELIVERY_STATUSES.includes(input.status)
    ? input.status
    : EMAIL_DELIVERY_STATUS.QUEUED
  const provider = EMAIL_PROVIDERS.includes(input.provider)
    ? input.provider
    : EMAIL_PROVIDER.RESEND

  return {
    id: input.id ?? createRecordId('eml'),
    proposalId: input.proposalId ?? '',
    provider,
    providerMessageId: input.providerMessageId ?? null,
    status,
    fromName: String(input.fromName ?? '').trim(),
    fromEmail: String(input.fromEmail ?? '').trim(),
    to: asList(input.to),
    cc: asList(input.cc),
    bcc: asList(input.bcc),
    subject: String(input.subject ?? '').trim(),
    message: String(input.message ?? '').trim(),
    proposalUrl: String(input.proposalUrl ?? '').trim(),
    trackingUrl: String(input.trackingUrl ?? '').trim(),
    expiresAt: input.expiresAt || null,
    scheduledAt: input.scheduledAt || null,
    sentAt: input.sentAt ?? null,
    errorCode: input.errorCode ?? null,
    error: String(input.error ?? '').trim(),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * Compact summary stored on the proposal for status chips. Full history lives
 * in the email message table.
 *
 * @param {Partial<EmailMessage> | null | undefined} input
 */
export function makeEmailDeliverySummary(input = null) {
  if (!input) return null
  const message = makeEmailMessage(input)
  return {
    id: message.id,
    status: message.status,
    to: message.to[0] ?? '',
    subject: message.subject,
    sentAt: message.sentAt,
    error: message.error,
    providerMessageId: message.providerMessageId,
  }
}

export function advanceEmailStatus(current, next) {
  if (!EMAIL_DELIVERY_STATUSES.includes(next)) return current
  if (TERMINAL_FAILURE.has(next)) return next
  if (TERMINAL_FAILURE.has(current)) return current
  const currentRank = STATUS_RANK[current] ?? 0
  const nextRank = STATUS_RANK[next] ?? 0
  return nextRank >= currentRank ? next : current
}

export function emailActivityKey(messageId, eventType) {
  return `${messageId}:${eventType}`
}
