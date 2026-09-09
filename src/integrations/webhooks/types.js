/**
 * H16.5 — Outbound webhook contracts.
 *
 * Sync consumer boundary for recorded H16.4 intents.
 * Not an outbox, worker, retry scheduler, or inbound ingress.
 */

export const OUTBOUND_WEBHOOK_SCHEMA_VERSION = 1

export const OUTBOUND_WEBHOOK_ENVELOPE_TYPE = 'automation.outbound_webhook'

/** Live HTTPS is off unless this env var is exactly "1". */
export const OUTBOUND_WEBHOOK_NETWORK_ENV = 'OUTBOUND_WEBHOOK_NETWORK'

export const OUTBOUND_WEBHOOK_DESTINATION_STATUS = Object.freeze({
  DISABLED: 'disabled',
  CONFIGURED: 'configured',
  ENABLED: 'enabled',
})

export const OUTBOUND_WEBHOOK_DESTINATION_STATUSES = Object.freeze(
  Object.values(OUTBOUND_WEBHOOK_DESTINATION_STATUS),
)

export const OUTBOUND_WEBHOOK_OUTCOME_STATUS = Object.freeze({
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REJECTED: 'rejected',
})

export const OUTBOUND_WEBHOOK_OUTCOME_STATUSES = Object.freeze(
  Object.values(OUTBOUND_WEBHOOK_OUTCOME_STATUS),
)

export const OUTBOUND_WEBHOOK_FAILURE_CODE = Object.freeze({
  INVALID_CONFIGURATION: 'invalid_configuration',
  INVALID_DESTINATION: 'invalid_destination',
  DESTINATION_DISABLED: 'destination_disabled',
  INTENT_CANCELLED: 'intent_cancelled',
  CAPABILITY_DISABLED: 'capability_disabled',
  NETWORK_DISABLED: 'network_disabled',
  DNS_FAILURE: 'dns_failure',
  NETWORK_FAILURE: 'network_failure',
  TIMEOUT: 'timeout',
  TLS_FAILURE: 'tls_failure',
  REDIRECT_REJECTED: 'redirect_rejected',
  SSRF_REJECTED: 'ssrf_rejected',
  HTTP_3XX: 'http_3xx',
  HTTP_4XX: 'http_4xx',
  HTTP_5XX: 'http_5xx',
  AUTH_OR_SIGNATURE_FAILURE: 'auth_or_signature_failure',
  RESPONSE_TOO_LARGE: 'response_too_large',
})

export const OUTBOUND_WEBHOOK_FAILURE_CODES = Object.freeze(
  Object.values(OUTBOUND_WEBHOOK_FAILURE_CODE),
)

/** Strict allowlist for destination-configured custom headers (lowercase). */
export const OUTBOUND_WEBHOOK_ALLOWED_HEADERS = Object.freeze([
  'x-request-id',
  'x-correlation-id',
  'x-company-ref',
  'x-automation-source',
])

export const OUTBOUND_WEBHOOK_BLOCKED_HEADERS = Object.freeze([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'proxy-authenticate',
])

export const OUTBOUND_WEBHOOK_LIMITS = Object.freeze({
  MAX_NAME: 120,
  MAX_URL: 2048,
  MAX_HEADER_VALUE: 200,
  MAX_HEADERS: 8,
  MIN_TIMEOUT_MS: 1_000,
  MAX_TIMEOUT_MS: 10_000,
  DEFAULT_TIMEOUT_MS: 5_000,
  MAX_REQUEST_BODY_BYTES: 64 * 1024,
  MAX_RESPONSE_BODY_BYTES: 64 * 1024,
  MAX_ERROR: 200,
  MAX_ID: 128,
})

export const HTTP_OUTBOUND_WEBHOOK_ADAPTER_ID = 'http_outbound_webhook'
