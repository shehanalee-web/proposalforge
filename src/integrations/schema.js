/**
 * H16.1 — Integration configuration schema.
 *
 * Stores secret references only. Never stores or projects secret values.
 */

import { createRecordId } from '../models/ids.js'
import { ValidationError } from '../services/errors.js'
import {
  INTEGRATION_KIND,
  INTEGRATION_KINDS,
  INTEGRATION_REJECTION_REASON,
  INTEGRATION_STATUS,
  INTEGRATION_STATUSES,
} from './types.js'

/** Allowed secret reference forms — never raw credential material. */
export const SECRET_REF_PATTERN =
  /^(env|vault|secretref):[A-Za-z0-9][A-Za-z0-9_./:-]*$/

const FORBIDDEN_SECRET_VALUE_KEYS = Object.freeze([
  'apiKey',
  'apiSecret',
  'secret',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'webhookSecret',
  'privateKey',
])

function asString(value) {
  return value == null ? '' : String(value)
}

function asOptionalId(value) {
  const id = asString(value).trim()
  return id || null
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function normalizeSecretRef(value, field = 'secretRef') {
  if (value == null || value === '') return null
  const ref = asString(value).trim()
  if (!SECRET_REF_PATTERN.test(ref)) {
    throw new ValidationError('Secret references must use env:, vault:, or secretref: form.', [
      {
        field,
        message: 'Use env:NAME, vault:path, or secretref:id — never raw secret values.',
      },
    ])
  }
  return ref
}

/**
 * Reject payloads that attempt to carry raw secret values.
 *
 * @param {object} [input]
 */
export function assertNoSecretValues(input = {}) {
  if (!input || typeof input !== 'object') return
  for (const key of FORBIDDEN_SECRET_VALUE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] != null && input[key] !== '') {
      throw new ValidationError('Raw secret values are forbidden on integration config.', [
        {
          field: key,
          message: `${key} is not allowed. Store a secret reference instead.`,
        },
      ])
    }
  }
  if (input.secrets != null) {
    throw new ValidationError('Raw secret values are forbidden on integration config.', [
      {
        field: 'secrets',
        message: 'secrets bags are not allowed. Use secretRefs only.',
      },
    ])
  }
}

/**
 * @param {object} [input]
 */
export function makeSecretRefs(input = {}) {
  assertNoSecretValues(input)
  const source =
    input.secretRefs && typeof input.secretRefs === 'object' ? input.secretRefs : input
  return Object.freeze({
    apiKeyRef: normalizeSecretRef(source.apiKeyRef, 'apiKeyRef'),
    webhookSecretRef: normalizeSecretRef(
      source.webhookSecretRef,
      'webhookSecretRef',
    ),
    oauthClientSecretRef: normalizeSecretRef(
      source.oauthClientSecretRef,
      'oauthClientSecretRef',
    ),
  })
}

function hasAnySecretRef(secretRefs) {
  if (!secretRefs) return false
  return Boolean(
    secretRefs.apiKeyRef ||
      secretRefs.webhookSecretRef ||
      secretRefs.oauthClientSecretRef,
  )
}

function resolveStatus(input, secretRefs) {
  const requested = asString(input.status).trim()
  if (requested) {
    if (!INTEGRATION_STATUSES.includes(requested)) {
      throw new ValidationError('Invalid integration status.', [
        {
          field: 'status',
          message: `status must be one of: ${INTEGRATION_STATUSES.join(', ')}.`,
        },
      ])
    }
    return requested
  }
  if (input.enabled === true) return INTEGRATION_STATUS.ENABLED
  if (hasAnySecretRef(secretRefs) || asOptionalId(input.accountId)) {
    return INTEGRATION_STATUS.CONFIGURED
  }
  return INTEGRATION_STATUS.DISABLED
}

/**
 * @param {object} [input]
 */
export function makeIntegrationConfig(input = {}) {
  assertNoSecretValues(input)

  const companyId = asOptionalId(input.companyId)
  if (!companyId) {
    throw new ValidationError('Integration config requires companyId.', [
      {
        field: 'companyId',
        message: 'companyId is required.',
      },
    ])
  }

  const kind = asString(input.kind).trim()
  if (!INTEGRATION_KINDS.includes(kind)) {
    throw new ValidationError('Invalid integration kind.', [
      {
        field: 'kind',
        message: `kind must be one of: ${INTEGRATION_KINDS.join(', ')}.`,
      },
    ])
  }

  const secretRefs = makeSecretRefs(input)
  const status = resolveStatus(input, secretRefs)
  const providerId = asOptionalId(input.providerId)
  const enabled =
    status === INTEGRATION_STATUS.ENABLED && Boolean(providerId)

  const createdAt = asString(input.createdAt).trim() || nowIso()
  const updatedAt = asString(input.updatedAt).trim() || createdAt

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('intg'),
    companyId,
    kind,
    providerId,
    status,
    enabled,
    accountId: asOptionalId(input.accountId),
    secretRefs,
    metadata:
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? Object.freeze({ ...input.metadata })
        : Object.freeze({}),
    createdAt,
    updatedAt,
  })
}

export function cloneIntegrationConfig(config) {
  return makeIntegrationConfig(config ?? {})
}

/**
 * Client-safe projection — never includes secret refs or account material.
 *
 * @param {object | null | undefined} config
 */
export function presentClientIntegrationConfig(config) {
  if (!config) {
    return Object.freeze({
      kind: null,
      providerId: null,
      status: INTEGRATION_STATUS.DISABLED,
      enabled: false,
    })
  }
  return Object.freeze({
    kind: config.kind ?? null,
    providerId: null,
    status: INTEGRATION_STATUS.DISABLED,
    enabled: false,
  })
}

/**
 * Studio-safe projection — architecture status + whether refs exist.
 * Secret reference strings are allowed; secret values never appear.
 *
 * @param {object | null | undefined} config
 */
export function presentStudioIntegrationConfig(config) {
  if (!config) {
    return Object.freeze({
      id: null,
      companyId: null,
      kind: null,
      providerId: null,
      status: INTEGRATION_STATUS.DISABLED,
      enabled: false,
      configured: false,
      hasSecretRefs: false,
      secretRefs: Object.freeze({
        apiKeyRef: null,
        webhookSecretRef: null,
        oauthClientSecretRef: null,
      }),
      architectureOnly: true,
    })
  }
  const next = makeIntegrationConfig(config)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    kind: next.kind,
    providerId: next.providerId,
    status: next.status,
    enabled: false,
    configured: hasAnySecretRef(next.secretRefs) || Boolean(next.accountId),
    hasSecretRefs: hasAnySecretRef(next.secretRefs),
    accountId: next.accountId,
    secretRefs: Object.freeze({ ...next.secretRefs }),
    architectureOnly: true,
  })
}

/**
 * Serialize config for persistence — refs only, never invent secret fields.
 *
 * @param {object} config
 */
export function serializeIntegrationConfig(config) {
  const next = makeIntegrationConfig(config)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    kind: next.kind,
    providerId: next.providerId,
    status: next.status,
    enabled: next.enabled,
    accountId: next.accountId,
    secretRefs: Object.freeze({ ...next.secretRefs }),
    metadata: Object.freeze({ ...next.metadata }),
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  })
}

export function integrationConfigHasSecretMaterial(value) {
  if (value == null) return false
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  for (const key of FORBIDDEN_SECRET_VALUE_KEYS) {
    if (new RegExp(`"${key}"\\s*:\\s*"[^"]+"`, 'i').test(text)) return true
  }
  if (/"secrets"\s*:\s*\{/i.test(text)) return true
  return false
}

export { INTEGRATION_KIND, INTEGRATION_REJECTION_REASON }
