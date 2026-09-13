/**
 * H16.16 Slice 16.1 — Vendor-neutral delivery execution contract.
 *
 * Authorization shape over a recorded H16.4 delivery AutomationActionIntent.
 * Does not send, persist, execute, or enable delivery. An agent-origin
 * activity facade is not a delivery executor.
 */

export const DELIVERY_EXECUTION_SCHEMA_VERSION = 1

export const DELIVERY_EXECUTION_STATUS = Object.freeze({
  AUTHORIZED: 'authorized',
})

export const DELIVERY_EXECUTION_STATUSES = Object.freeze(
  Object.values(DELIVERY_EXECUTION_STATUS),
)

/**
 * Secrets, OAuth, vendor transports, and execution infrastructure.
 * Presence of a non-empty value is a hard reject. No channel vocabulary
 * is invented here — emailDelivery remains a capability flag, not a sender.
 */
export const DELIVERY_EXECUTION_FORBIDDEN_FIELDS = Object.freeze([
  'oauth',
  'accessToken',
  'refreshToken',
  'idToken',
  'authorizationCode',
  'apiKey',
  'apiSecret',
  'clientSecret',
  'webhookSecret',
  'password',
  'token',
  'jwt',
  'smtp',
  'vendor',
  'vendorSdk',
  'providerPayload',
  'rawBody',
])
