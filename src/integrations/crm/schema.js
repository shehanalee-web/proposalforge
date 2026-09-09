/**
 * H16.6 — CrmConnection + CrmExecutionOutcome schemas.
 *
 * Secret references only. Never stores or projects resolved credentials.
 * No provider base URLs — connection config is a bounded allowlist.
 */

import { createRecordId } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import { normalizeSecretRef, assertNoSecretValues } from '../schema.js'
import {
  CRM_CONNECTION_CONFIG_KEYS,
  CRM_CONNECTION_STATUS,
  CRM_CONNECTION_STATUSES,
  CRM_FAILURE_CODES,
  CRM_LIMITS,
  CRM_OPERATIONS,
  CRM_OUTCOME_STATUS,
  CRM_OUTCOME_STATUSES,
  CRM_PROVIDER_ID,
  CRM_PROVIDER_IDS,
  CRM_SCHEMA_VERSION,
} from './types.js'

const SECRET_LIKE_KEY = /secret|password|token|api[_-]?key|credential|authorization/i
const URL_LIKE_KEY = /url|uri|endpoint|host|base|domain|origin|webhook|callback/i

function asString(value) {
  return value == null ? '' : String(value)
}

function asOptionalId(value) {
  const id = asString(value).trim()
  if (!id) return null
  return id.slice(0, CRM_LIMITS.MAX_ID)
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

function asRequiredCompanyId(value, label) {
  const companyId = asOptionalId(value)
  if (!companyId) {
    throw new ValidationError(`${label} requires companyId.`, [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return companyId
}

/**
 * Bounded, non-secret connection settings. Unknown keys are rejected so a
 * vendor base URL can never be smuggled into a connection.
 *
 * @param {unknown} input
 */
export function normalizeCrmConnectionConfig(input) {
  if (input == null) return Object.freeze({})
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('CRM connection config must be an object.', [
      { field: 'config', message: 'config must be a plain object.' },
    ])
  }

  const next = {}
  let count = 0
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = asString(rawKey).trim()
    if (!key) continue
    if (SECRET_LIKE_KEY.test(key)) {
      throw new ValidationError('Secret-like CRM config keys are forbidden.', [
        { field: 'config', message: `config."${key}" is not allowed.` },
      ])
    }
    if (URL_LIKE_KEY.test(key)) {
      throw new ValidationError('CRM connections cannot configure endpoints.', [
        {
          field: 'config',
          message: `config."${key}" is not allowed. Provider endpoints are fixed.`,
        },
      ])
    }
    if (!CRM_CONNECTION_CONFIG_KEYS.includes(key)) {
      throw new ValidationError('CRM config key is not allowlisted.', [
        {
          field: 'config',
          message: `config."${key}" is not on the allowlist.`,
        },
      ])
    }
    const value = asString(rawValue).trim()
    if (!value) continue
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      throw new ValidationError('CRM config values cannot contain URLs.', [
        { field: 'config', message: `config."${key}" must not be a URL.` },
      ])
    }
    if (value.length > CRM_LIMITS.MAX_CONFIG_VALUE) {
      throw new ValidationError('CRM config value is too long.', [
        {
          field: 'config',
          message: `config."${key}" exceeds ${CRM_LIMITS.MAX_CONFIG_VALUE} characters.`,
        },
      ])
    }
    count += 1
    if (count > CRM_LIMITS.MAX_CONFIG_KEYS) {
      throw new ValidationError('Too many CRM config keys.', [
        {
          field: 'config',
          message: `At most ${CRM_LIMITS.MAX_CONFIG_KEYS} config keys are allowed.`,
        },
      ])
    }
    next[key] = value
  }
  return Object.freeze(next)
}

/**
 * Secret references only — env:, vault:, secretref:.
 *
 * @param {unknown} input
 */
export function normalizeCrmCredentialRefs(input) {
  const source =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  assertNoSecretValues(source)
  return Object.freeze({
    apiKeyRef: normalizeSecretRef(source.apiKeyRef, 'credentialRefs.apiKeyRef'),
  })
}

function normalizeProviderId(value) {
  const providerId = asOptionalId(value)
  if (!providerId) {
    throw new ValidationError('CRM connection requires providerId.', [
      { field: 'providerId', message: 'providerId is required.' },
    ])
  }
  if (!CRM_PROVIDER_IDS.includes(providerId)) {
    throw new ValidationError('Unsupported CRM providerId.', [
      {
        field: 'providerId',
        message: `providerId must be one of: ${CRM_PROVIDER_IDS.join(', ')}.`,
      },
    ])
  }
  return providerId
}

function resolveConnectionStatus(input, providerId) {
  const requested = asString(input.status).trim()
  if (requested) {
    if (!CRM_CONNECTION_STATUSES.includes(requested)) {
      throw new ValidationError('Invalid CRM connection status.', [
        {
          field: 'status',
          message: `status must be one of: ${CRM_CONNECTION_STATUSES.join(', ')}.`,
        },
      ])
    }
    return requested
  }
  if (input.enabled === true) return CRM_CONNECTION_STATUS.ENABLED
  if (providerId && providerId !== CRM_PROVIDER_ID.NULL) {
    return CRM_CONNECTION_STATUS.CONFIGURED
  }
  return CRM_CONNECTION_STATUS.DISABLED
}

/**
 * @param {object} [input]
 */
export function makeCrmConnection(input = {}) {
  assertNoSecretValues(input)

  const companyId = asRequiredCompanyId(input.companyId, 'CRM connection')
  const providerId = normalizeProviderId(input.providerId)
  const credentialRefs = normalizeCrmCredentialRefs(input.credentialRefs)
  const status = resolveConnectionStatus(input, providerId)
  const enabled = status === CRM_CONNECTION_STATUS.ENABLED && input.enabled !== false
  const resolvedStatus =
    !enabled && status === CRM_CONNECTION_STATUS.ENABLED
      ? CRM_CONNECTION_STATUS.CONFIGURED
      : status
  const createdAt = asIso(input.createdAt, nowIso())
  const updatedAt = asIso(input.updatedAt, createdAt)

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('crmc'),
    companyId,
    providerId,
    name: asString(input.name).trim().slice(0, CRM_LIMITS.MAX_NAME) || 'CRM connection',
    enabled,
    status: resolvedStatus,
    credentialRefs,
    config: normalizeCrmConnectionConfig(input.config),
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : CRM_SCHEMA_VERSION,
    createdAt,
    updatedAt,
  })
}

export function cloneCrmConnection(connection) {
  return makeCrmConnection(connection ?? {})
}

/**
 * Studio projection — refs only, never resolved secrets.
 *
 * @param {object | null | undefined} connection
 */
export function presentStudioCrmConnection(connection) {
  if (!connection) return null
  const next = makeCrmConnection(connection)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    providerId: next.providerId,
    name: next.name,
    enabled: next.enabled,
    status: next.status,
    credentialRefs: Object.freeze({ ...next.credentialRefs }),
    hasCredentialRefs: Boolean(next.credentialRefs.apiKeyRef),
    config: Object.freeze({ ...next.config }),
    schemaVersion: next.schemaVersion,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  })
}

export function serializeCrmConnection(connection) {
  const next = makeCrmConnection(connection)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    providerId: next.providerId,
    name: next.name,
    enabled: next.enabled,
    status: next.status,
    credentialRefs: Object.freeze({ ...next.credentialRefs }),
    config: Object.freeze({ ...next.config }),
    schemaVersion: next.schemaVersion,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  })
}

/**
 * Bounded, non-secret provider result echo. Never carries credentials.
 *
 * @param {unknown} input
 */
export function sanitizeCrmResult(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({})
  }
  const next = {}
  let count = 0
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (count >= CRM_LIMITS.MAX_RESULT_KEYS) break
    const key = asString(rawKey).trim()
    if (!key || SECRET_LIKE_KEY.test(key)) continue
    let value
    if (typeof rawValue === 'boolean') {
      value = rawValue
    } else if (typeof rawValue === 'number') {
      value = Number.isFinite(rawValue) ? rawValue : null
    } else if (typeof rawValue === 'string') {
      value = rawValue.trim().slice(0, CRM_LIMITS.MAX_FIELD_VALUE)
    } else {
      continue
    }
    next[key] = value
    count += 1
  }
  return Object.freeze(next)
}

/**
 * @param {object} [input]
 */
export function makeCrmExecutionOutcome(input = {}) {
  const companyId = asRequiredCompanyId(input.companyId, 'CRM execution outcome')
  const intentId = asOptionalId(input.intentId)
  if (!intentId) {
    throw new ValidationError('CRM execution outcome requires intentId.', [
      { field: 'intentId', message: 'intentId is required.' },
    ])
  }
  const status = CRM_OUTCOME_STATUSES.includes(input.status)
    ? input.status
    : CRM_OUTCOME_STATUS.REJECTED
  const failureCode =
    input.failureCode == null || input.failureCode === ''
      ? null
      : CRM_FAILURE_CODES.includes(input.failureCode)
        ? input.failureCode
        : null
  const operation = CRM_OPERATIONS.includes(input.operation) ? input.operation : null
  const providerId = CRM_PROVIDER_IDS.includes(input.providerId)
    ? input.providerId
    : null
  const createdAt = asIso(input.createdAt, nowIso())
  const completedAt = asIso(input.completedAt, createdAt)

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('crmo'),
    companyId,
    intentId,
    connectionId: asOptionalId(input.connectionId),
    providerId,
    operation,
    status,
    idempotencyKey: asString(input.idempotencyKey).trim() || intentId,
    attemptNumber:
      Number.isInteger(input.attemptNumber) && input.attemptNumber > 0
        ? input.attemptNumber
        : 1,
    externalId: asOptionalId(input.externalId),
    externalKey: asOptionalId(input.externalKey),
    failureCode,
    retryable: typeof input.retryable === 'boolean' ? input.retryable : null,
    sanitizedResult: sanitizeCrmResult(input.sanitizedResult),
    truncatedError:
      asString(input.truncatedError).trim().slice(0, CRM_LIMITS.MAX_ERROR) || null,
    createdAt,
    completedAt,
  })
}

export function cloneCrmExecutionOutcome(outcome) {
  return makeCrmExecutionOutcome(outcome ?? {})
}

export function presentStudioCrmExecutionOutcome(outcome) {
  if (!outcome) return null
  return makeCrmExecutionOutcome(outcome)
}
