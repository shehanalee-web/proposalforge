/**
 * H16.5 — Outbound webhook destination + outcome schemas.
 *
 * Secret references only. Never stores resolved credentials.
 */

import { createRecordId } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import { normalizeSecretRef, assertNoSecretValues } from '../schema.js'
import { sanitizeAutomationPayload } from '../events/schema.js'
import {
  OUTBOUND_WEBHOOK_ALLOWED_HEADERS,
  OUTBOUND_WEBHOOK_BLOCKED_HEADERS,
  OUTBOUND_WEBHOOK_DESTINATION_STATUS,
  OUTBOUND_WEBHOOK_DESTINATION_STATUSES,
  OUTBOUND_WEBHOOK_FAILURE_CODES,
  OUTBOUND_WEBHOOK_LIMITS,
  OUTBOUND_WEBHOOK_OUTCOME_STATUS,
  OUTBOUND_WEBHOOK_OUTCOME_STATUSES,
  OUTBOUND_WEBHOOK_SCHEMA_VERSION,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asOptionalId(value) {
  const id = asString(value).trim()
  if (!id) return null
  return id.slice(0, OUTBOUND_WEBHOOK_LIMITS.MAX_ID)
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

function asRequiredCompanyId(value) {
  const companyId = asOptionalId(value)
  if (!companyId) {
    throw new ValidationError('Outbound webhook destination requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return companyId
}

/**
 * Normalize and validate destination custom headers.
 *
 * @param {unknown} input
 */
export function normalizeOutboundWebhookHeaders(input) {
  if (input == null) return Object.freeze({})
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Webhook headers must be an object.', [
      { field: 'headers', message: 'headers must be a plain object.' },
    ])
  }

  const next = {}
  let count = 0
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = asString(rawKey).trim().toLowerCase()
    if (!key) continue
    if (OUTBOUND_WEBHOOK_BLOCKED_HEADERS.includes(key)) {
      throw new ValidationError('Blocked webhook header.', [
        {
          field: 'headers',
          message: `Header "${key}" is not allowed.`,
        },
      ])
    }
    if (!OUTBOUND_WEBHOOK_ALLOWED_HEADERS.includes(key)) {
      throw new ValidationError('Webhook header is not allowlisted.', [
        {
          field: 'headers',
          message: `Header "${key}" is not on the allowlist.`,
        },
      ])
    }
    if (/authorization|secret|token|password|api[_-]?key/i.test(key)) {
      throw new ValidationError('Sensitive webhook headers are forbidden.', [
        { field: 'headers', message: `Header "${key}" is forbidden.` },
      ])
    }
    const value = asString(rawValue).trim()
    if (!value) continue
    if (/^(bearer|basic)\s+/i.test(value) || /secret|password|token/i.test(value)) {
      throw new ValidationError('Raw credentials in headers are forbidden.', [
        {
          field: 'headers',
          message: 'Authorization-style or secret-like header values are not allowed.',
        },
      ])
    }
    if (value.length > OUTBOUND_WEBHOOK_LIMITS.MAX_HEADER_VALUE) {
      throw new ValidationError('Webhook header value is too long.', [
        {
          field: 'headers',
          message: `Header "${key}" exceeds ${OUTBOUND_WEBHOOK_LIMITS.MAX_HEADER_VALUE} characters.`,
        },
      ])
    }
    count += 1
    if (count > OUTBOUND_WEBHOOK_LIMITS.MAX_HEADERS) {
      throw new ValidationError('Too many webhook headers.', [
        {
          field: 'headers',
          message: `At most ${OUTBOUND_WEBHOOK_LIMITS.MAX_HEADERS} headers are allowed.`,
        },
      ])
    }
    next[key] = value
  }
  return Object.freeze(next)
}

function normalizeEndpointUrl(value) {
  const url = asString(value).trim()
  if (!url) {
    throw new ValidationError('Outbound webhook destination requires endpointUrl.', [
      { field: 'endpointUrl', message: 'endpointUrl is required.' },
    ])
  }
  if (url.length > OUTBOUND_WEBHOOK_LIMITS.MAX_URL) {
    throw new ValidationError('endpointUrl is too long.', [
      { field: 'endpointUrl', message: 'endpointUrl exceeds maximum length.' },
    ])
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new ValidationError('endpointUrl is not a valid URL.', [
      { field: 'endpointUrl', message: 'endpointUrl must be a valid absolute URL.' },
    ])
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError('endpointUrl must use https.', [
      { field: 'endpointUrl', message: 'Only https: endpoints are allowed.' },
    ])
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError('endpointUrl must not embed credentials.', [
      { field: 'endpointUrl', message: 'Userinfo in endpointUrl is forbidden.' },
    ])
  }
  return parsed.toString()
}

function normalizeTimeoutMs(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return OUTBOUND_WEBHOOK_LIMITS.DEFAULT_TIMEOUT_MS
  const rounded = Math.trunc(n)
  if (
    rounded < OUTBOUND_WEBHOOK_LIMITS.MIN_TIMEOUT_MS ||
    rounded > OUTBOUND_WEBHOOK_LIMITS.MAX_TIMEOUT_MS
  ) {
    throw new ValidationError('timeoutMs is out of bounds.', [
      {
        field: 'timeoutMs',
        message: `timeoutMs must be between ${OUTBOUND_WEBHOOK_LIMITS.MIN_TIMEOUT_MS} and ${OUTBOUND_WEBHOOK_LIMITS.MAX_TIMEOUT_MS}.`,
      },
    ])
  }
  return rounded
}

function resolveDestinationStatus(input, signingSecretRef) {
  const requested = asString(input.status).trim()
  if (requested) {
    if (!OUTBOUND_WEBHOOK_DESTINATION_STATUSES.includes(requested)) {
      throw new ValidationError('Invalid outbound webhook destination status.', [
        {
          field: 'status',
          message: `status must be one of: ${OUTBOUND_WEBHOOK_DESTINATION_STATUSES.join(', ')}.`,
        },
      ])
    }
    return requested
  }
  if (input.enabled === true && signingSecretRef) {
    return OUTBOUND_WEBHOOK_DESTINATION_STATUS.ENABLED
  }
  if (signingSecretRef || asString(input.endpointUrl).trim()) {
    return OUTBOUND_WEBHOOK_DESTINATION_STATUS.CONFIGURED
  }
  return OUTBOUND_WEBHOOK_DESTINATION_STATUS.DISABLED
}

/**
 * @param {object} [input]
 */
export function makeOutboundWebhookDestination(input = {}) {
  assertNoSecretValues(input)
  if (input.signingSecret != null && input.signingSecret !== '') {
    throw new ValidationError('Raw signing secrets are forbidden.', [
      {
        field: 'signingSecret',
        message: 'Use signingSecretRef (env:/vault:/secretref:) instead.',
      },
    ])
  }

  const companyId = asRequiredCompanyId(input.companyId)
  const endpointUrl = normalizeEndpointUrl(input.endpointUrl)
  const signingSecretRef = normalizeSecretRef(
    input.signingSecretRef,
    'signingSecretRef',
  )
  if (!signingSecretRef) {
    throw new ValidationError('signingSecretRef is required.', [
      {
        field: 'signingSecretRef',
        message: 'Use env:NAME, vault:path, or secretref:id.',
      },
    ])
  }

  const status = resolveDestinationStatus(input, signingSecretRef)
  const enabled =
    status === OUTBOUND_WEBHOOK_DESTINATION_STATUS.ENABLED &&
    input.enabled !== false
  const createdAt = asIso(input.createdAt, nowIso())
  const updatedAt = asIso(input.updatedAt, createdAt)

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('owhd'),
    companyId,
    name: asString(input.name).trim().slice(0, OUTBOUND_WEBHOOK_LIMITS.MAX_NAME) ||
      'Outbound webhook',
    endpointUrl,
    enabled,
    status: enabled
      ? OUTBOUND_WEBHOOK_DESTINATION_STATUS.ENABLED
      : status === OUTBOUND_WEBHOOK_DESTINATION_STATUS.ENABLED
        ? OUTBOUND_WEBHOOK_DESTINATION_STATUS.CONFIGURED
        : status,
    signingSecretRef,
    headers: normalizeOutboundWebhookHeaders(input.headers),
    timeoutMs: normalizeTimeoutMs(input.timeoutMs),
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : OUTBOUND_WEBHOOK_SCHEMA_VERSION,
    createdAt,
    updatedAt,
  })
}

export function cloneOutboundWebhookDestination(destination) {
  return makeOutboundWebhookDestination(destination ?? {})
}

/**
 * Studio projection — refs only, never resolved secrets.
 *
 * @param {object | null | undefined} destination
 */
export function presentStudioOutboundWebhookDestination(destination) {
  if (!destination) return null
  const next = makeOutboundWebhookDestination(destination)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    name: next.name,
    endpointUrl: next.endpointUrl,
    enabled: next.enabled,
    status: next.status,
    signingSecretRef: next.signingSecretRef,
    hasSigningSecretRef: Boolean(next.signingSecretRef),
    headers: Object.freeze({ ...next.headers }),
    timeoutMs: next.timeoutMs,
    schemaVersion: next.schemaVersion,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  })
}

export function serializeOutboundWebhookDestination(destination) {
  const next = makeOutboundWebhookDestination(destination)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    name: next.name,
    endpointUrl: next.endpointUrl,
    enabled: next.enabled,
    status: next.status,
    signingSecretRef: next.signingSecretRef,
    headers: Object.freeze({ ...next.headers }),
    timeoutMs: next.timeoutMs,
    schemaVersion: next.schemaVersion,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  })
}

/**
 * @param {object} [input]
 */
export function makeOutboundWebhookDeliveryOutcome(input = {}) {
  const companyId = asRequiredCompanyId(input.companyId)
  const intentId = asOptionalId(input.intentId)
  if (!intentId) {
    throw new ValidationError('Delivery outcome requires intentId.', [
      { field: 'intentId', message: 'intentId is required.' },
    ])
  }
  const status = OUTBOUND_WEBHOOK_OUTCOME_STATUSES.includes(input.status)
    ? input.status
    : OUTBOUND_WEBHOOK_OUTCOME_STATUS.REJECTED
  const failureCode =
    input.failureCode == null || input.failureCode === ''
      ? null
      : OUTBOUND_WEBHOOK_FAILURE_CODES.includes(input.failureCode)
        ? input.failureCode
        : null
  const createdAt = asIso(input.createdAt, nowIso())
  const completedAt = asIso(input.completedAt, createdAt)
  const httpStatus =
    Number.isInteger(input.httpStatus) && input.httpStatus >= 100 && input.httpStatus <= 599
      ? input.httpStatus
      : null
  const attemptNumber =
    Number.isInteger(input.attemptNumber) && input.attemptNumber > 0
      ? input.attemptNumber
      : 1

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('owho'),
    companyId,
    intentId,
    destinationId: asOptionalId(input.destinationId),
    status,
    idempotencyKey: asString(input.idempotencyKey).trim() || intentId,
    attemptNumber,
    httpStatus,
    failureCode,
    retryable: typeof input.retryable === 'boolean' ? input.retryable : null,
    truncatedError:
      asString(input.truncatedError)
        .trim()
        .slice(0, OUTBOUND_WEBHOOK_LIMITS.MAX_ERROR) || null,
    createdAt,
    completedAt,
  })
}

export function cloneOutboundWebhookDeliveryOutcome(outcome) {
  return makeOutboundWebhookDeliveryOutcome(outcome ?? {})
}

export function presentStudioOutboundWebhookDeliveryOutcome(outcome) {
  if (!outcome) return null
  return makeOutboundWebhookDeliveryOutcome(outcome)
}

/**
 * Sanitize intent payload for the outbound envelope `data` field.
 *
 * @param {unknown} payload
 */
export function sanitizeOutboundWebhookData(payload) {
  const sanitized = sanitizeAutomationPayload(payload)
  const next = { ...sanitized }
  delete next.destinationId
  delete next.signingSecretRef
  delete next.endpointUrl
  return Object.freeze(next)
}
