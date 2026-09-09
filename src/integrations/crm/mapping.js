/**
 * H16.6 — Deterministic vendor-neutral CRM record mapping.
 *
 * Pure functions: same input always produces the same mutation.
 * No mapping DSL, no vendor object names, no monetary fields.
 *
 * H16.4 sanitization flattens intent payloads (nested objects are dropped), so
 * the canonical wire form is flat `record.<field>` keys. A nested `record`
 * object is also accepted for direct/in-process callers.
 */

import {
  CRM_FAILURE_CODE,
  CRM_FORBIDDEN_RECORD_FIELDS,
  CRM_LIMITS,
  CRM_OPERATIONS,
  CRM_RECORD_FIELDS,
  CRM_RECORD_TYPE,
  CRM_RECORD_TYPE_BY_OPERATION,
} from './types.js'

const RECORD_PREFIX = 'record.'

function asString(value) {
  return value == null ? '' : String(value)
}

function fail(failureCode, message) {
  return { ok: false, failureCode, message }
}

function trimmed(value, max = CRM_LIMITS.MAX_FIELD_VALUE) {
  return asString(value).trim().slice(0, max)
}

function isForbiddenField(field) {
  const key = asString(field).trim()
  if (!key) return false
  return CRM_FORBIDDEN_RECORD_FIELDS.some(
    (blocked) => blocked.toLowerCase() === key.toLowerCase(),
  )
}

/**
 * Collect the raw record bag from a flat intent payload or a nested object.
 *
 * @param {object} payload
 */
export function collectCrmRecordInput(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  const bag = {}

  const nested = source.record
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    for (const [key, value] of Object.entries(nested)) {
      bag[asString(key).trim()] = value
    }
  }

  for (const [key, value] of Object.entries(source)) {
    const name = asString(key)
    if (!name.startsWith(RECORD_PREFIX)) continue
    const field = name.slice(RECORD_PREFIX.length).trim()
    if (!field) continue
    bag[field] = value
  }

  return bag
}

/**
 * Normalize a universal record for one operation.
 *
 * Unknown fields are dropped. Monetary fields are rejected outright — this is a
 * second wall behind H16.4 sanitization, which does not see `record.` prefixes.
 *
 * @param {string} operation
 * @param {object} payload
 */
export function extractCrmRecord(operation, payload) {
  const op = asString(operation).trim()
  if (!CRM_OPERATIONS.includes(op)) {
    return fail(
      CRM_FAILURE_CODE.UNSUPPORTED_OPERATION,
      `CRM operation "${op || '(missing)'}" is not supported.`,
    )
  }

  const recordType = CRM_RECORD_TYPE_BY_OPERATION[op]
  const allowed = CRM_RECORD_FIELDS[recordType]
  const bag = collectCrmRecordInput(payload)

  for (const key of Object.keys(bag)) {
    if (isForbiddenField(key)) {
      return fail(
        CRM_FAILURE_CODE.VALIDATION_FAILURE,
        `Monetary field "${key}" is not synced in this release.`,
      )
    }
  }

  const fields = {}
  for (const field of allowed) {
    if (!Object.prototype.hasOwnProperty.call(bag, field)) continue
    const raw = bag[field]
    if (raw == null) continue
    if (typeof raw === 'object') continue
    const max = field === 'body' ? CRM_LIMITS.MAX_NOTE_BODY : CRM_LIMITS.MAX_FIELD_VALUE
    const value = trimmed(raw, max)
    if (!value) continue
    fields[field] = field === 'email' || field === 'domain' ? value.toLowerCase() : value
  }

  if (Object.keys(fields).length > CRM_LIMITS.MAX_RECORD_FIELDS) {
    return fail(CRM_FAILURE_CODE.VALIDATION_FAILURE, 'Too many CRM record fields.')
  }

  const required = requiredCrmField(recordType, fields)
  if (required) {
    return fail(CRM_FAILURE_CODE.VALIDATION_FAILURE, required)
  }

  const sorted = {}
  for (const key of Object.keys(fields).sort()) sorted[key] = fields[key]

  return { ok: true, recordType, fields: Object.freeze(sorted) }
}

function requiredCrmField(recordType, fields) {
  if (recordType === CRM_RECORD_TYPE.CONTACT && !fields.email) {
    return 'Contact records require an email.'
  }
  if (recordType === CRM_RECORD_TYPE.COMPANY && !fields.domain && !fields.name) {
    return 'Company records require a name or domain.'
  }
  if (recordType === CRM_RECORD_TYPE.DEAL && !fields.name && !fields.proposalId) {
    return 'Deal records require a name or proposalId.'
  }
  if (recordType === CRM_RECORD_TYPE.NOTE && !fields.body) {
    return 'Note records require a body.'
  }
  return null
}

/**
 * Deterministic natural key used for upsert matching. Notes are create-only.
 *
 * @param {string} recordType
 * @param {object} fields
 */
export function makeCrmExternalKey(recordType, fields = {}) {
  if (recordType === CRM_RECORD_TYPE.CONTACT) {
    return fields.email ? `contact:${fields.email}` : null
  }
  if (recordType === CRM_RECORD_TYPE.COMPANY) {
    const key = fields.domain || fields.name
    return key ? `company:${key.toLowerCase()}` : null
  }
  if (recordType === CRM_RECORD_TYPE.DEAL) {
    const key = fields.proposalId || fields.name
    return key ? `deal:${key.toLowerCase()}` : null
  }
  return null
}

/**
 * Build the vendor-neutral mutation handed to a CRM adapter.
 *
 * @param {{
 *   operation: string,
 *   payload: object,
 *   companyId: string,
 *   connectionId: string,
 *   providerId: string,
 *   idempotencyKey: string,
 *   correlation?: object,
 * }} input
 */
export function buildCrmMutation(input = {}) {
  const extracted = extractCrmRecord(input.operation, input.payload)
  if (!extracted.ok) return extracted

  const { recordType, fields } = extracted
  const correlation = input.correlation ?? {}

  return {
    ok: true,
    mutation: Object.freeze({
      operation: asString(input.operation).trim(),
      recordType,
      companyId: asString(input.companyId).trim(),
      connectionId: asString(input.connectionId).trim(),
      providerId: asString(input.providerId).trim(),
      idempotencyKey: asString(input.idempotencyKey).trim(),
      externalKey: makeCrmExternalKey(recordType, fields),
      fields,
      correlation: Object.freeze({
        proposalId: trimmed(correlation.proposalId) || null,
        actorId: trimmed(correlation.actorId) || null,
      }),
    }),
  }
}
