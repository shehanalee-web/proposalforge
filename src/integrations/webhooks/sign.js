/**
 * H16.5 — Vendor-neutral outbound webhook HMAC signing.
 *
 * Message: timestamp + "." + rawBody
 * Headers: X-Webhook-Timestamp, X-Webhook-Signature, X-Webhook-Idempotency-Key
 * No inbound verification in this milestone.
 */

import { createHmac } from 'node:crypto'

/**
 * @param {string} timestamp
 * @param {string} rawBody
 * @param {string} secret
 */
export function signOutboundWebhookBody(timestamp, rawBody, secret) {
  const message = `${String(timestamp)}.${String(rawBody)}`
  const digest = createHmac('sha256', String(secret)).update(message, 'utf8').digest('hex')
  return `v1=${digest}`
}

/**
 * @param {{
 *   rawBody: string,
 *   secret: string,
 *   idempotencyKey: string,
 *   timestamp?: string | number,
 * }} input
 */
export function buildOutboundWebhookSignatureHeaders(input) {
  const timestamp = String(
    input.timestamp != null ? input.timestamp : Math.floor(Date.now() / 1000),
  )
  const signature = signOutboundWebhookBody(timestamp, input.rawBody, input.secret)
  return Object.freeze({
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': signature,
    'X-Webhook-Idempotency-Key': String(input.idempotencyKey ?? '').trim(),
  })
}
