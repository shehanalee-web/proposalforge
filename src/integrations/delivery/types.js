/**
 * H16.16 — Vendor-neutral delivery execution contract.
 *
 * Slice 16.1: authorization shape over a recorded H16.4 delivery intent.
 * Slice 16.2: fail-closed execute outcomes. Does not send or enable delivery.
 * An agent-origin activity facade is not a delivery executor.
 */

export const DELIVERY_EXECUTION_SCHEMA_VERSION = 1

export const DELIVERY_EXECUTION_STATUS = Object.freeze({
  AUTHORIZED: 'authorized',
})

export const DELIVERY_EXECUTION_STATUSES = Object.freeze(
  Object.values(DELIVERY_EXECUTION_STATUS),
)

/**
 * H16.16 Slice 16.2 — Fail-closed execute outcomes only.
 * There is no succeeded/sent/delivered/executing status.
 */
export const DELIVERY_OUTCOME_STATUS = Object.freeze({
  REJECTED: 'rejected',
})

export const DELIVERY_OUTCOME_STATUSES = Object.freeze(
  Object.values(DELIVERY_OUTCOME_STATUS),
)

export const DELIVERY_FAILURE_CODE = Object.freeze({
  CAPABILITY_DISABLED: 'capability_disabled',
  ADAPTER_DISABLED: 'adapter_disabled',
  INTENT_CANCELLED: 'intent_cancelled',
  INVALID_CONFIGURATION: 'invalid_configuration',
})

export const DELIVERY_FAILURE_CODES = Object.freeze(
  Object.values(DELIVERY_FAILURE_CODE),
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
