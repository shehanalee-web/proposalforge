/**
 * H16.2 — AutomationEvent schema + sanitization.
 *
 * Thin, reference-oriented envelopes for rules. Never copies full domain docs.
 */

import { createRecordId } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import {
  AUTOMATION_EVENT_SCHEMA_VERSION,
  AUTOMATION_INTAKE_REASON,
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_INTAKE_STATUSES,
  AUTOMATION_SOURCE_DOMAINS,
} from './types.js'

const MAX_PAYLOAD_KEYS = 16
const MAX_STRING = 200
const MAX_ID = 128

const BLOCKED_PAYLOAD_KEYS = Object.freeze([
  'amount',
  'total',
  'selectedTotal',
  'packageAmount',
  'price',
  'unitPrice',
  'grandTotal',
  'subtotal',
  'blocks',
  'items',
  'offers',
  'proposal',
  'decision',
  'statusHistory',
  'signature',
  'payment',
  'contract',
  'invoice',
  'accessRef',
  'accessKey',
  'token',
  'secret',
  'apiKey',
  'password',
  'webhookSecret',
  'clientSecret',
  'rawBody',
  'rawPayload',
  'providerPayload',
  'secrets',
  'secretRefs',
  'apiKeyRef',
  'webhookSecretRef',
])

function asString(value) {
  return value == null ? '' : String(value)
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

function asOptionalId(value) {
  const id = asString(value).trim()
  if (!id) return null
  return id.slice(0, MAX_ID)
}

function sanitizePayloadValue(value) {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value
  }
  if (typeof value === 'string') return value.trim().slice(0, MAX_STRING)
  return undefined
}

/**
 * @param {unknown} input
 */
export function sanitizeAutomationPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({})
  }
  const next = {}
  let count = 0
  for (const [key, value] of Object.entries(input)) {
    if (count >= MAX_PAYLOAD_KEYS) break
    const field = asString(key).trim()
    if (!field || BLOCKED_PAYLOAD_KEYS.includes(field)) continue
    if (field.toLowerCase().includes('secret')) continue
    if (field.toLowerCase().includes('password')) continue
    if (field.toLowerCase().endsWith('ref') && /api|webhook|oauth|token/i.test(field)) {
      continue
    }
    const sanitized = sanitizePayloadValue(value)
    if (sanitized === undefined) continue
    next[field] = sanitized
    count += 1
  }
  return Object.freeze(next)
}

/**
 * @param {object} [source]
 */
export function makeAutomationEventSource(source = {}) {
  const domain = asString(source.domain).trim()
  if (!AUTOMATION_SOURCE_DOMAINS.includes(domain)) {
    throw new ValidationError('Unsupported automation source domain.', [
      { field: 'source.domain', message: 'source.domain is invalid.' },
    ])
  }
  return Object.freeze({
    domain,
    entityType: asOptionalId(source.entityType) || domain,
    entityId: asOptionalId(source.entityId),
    eventId: asOptionalId(source.eventId),
  })
}

/**
 * @param {object} [correlation]
 */
export function makeAutomationEventCorrelation(correlation = {}) {
  return Object.freeze({
    proposalId: asOptionalId(correlation.proposalId),
    sessionId: asOptionalId(correlation.sessionId),
    closeId: asOptionalId(correlation.closeId),
    followupId: asOptionalId(correlation.followupId),
    shareToken: asOptionalId(correlation.shareToken),
    actorId: asOptionalId(correlation.actorId),
  })
}

/**
 * @param {string} companyId
 * @param {string} sourceDomain
 * @param {string} sourceEventIdentity
 */
export function makeAutomationIdempotencyKey(
  companyId,
  sourceDomain,
  sourceEventIdentity,
) {
  const company = asString(companyId).trim()
  const domain = asString(sourceDomain).trim()
  const identity = asString(sourceEventIdentity).trim()
  if (!company || !domain || !identity) return null
  return `${company}|${domain}|${identity}`
}

/**
 * @param {object} [input]
 */
export function makeAutomationEvent(input = {}) {
  const companyId = asOptionalId(input.companyId)
  if (!companyId) {
    throw new ValidationError('AutomationEvent requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }

  const type = asString(input.type).trim()
  if (!type) {
    throw new ValidationError('AutomationEvent requires type.', [
      { field: 'type', message: 'type is required.' },
    ])
  }

  const source = makeAutomationEventSource(input.source ?? {})
  const correlation = makeAutomationEventCorrelation(input.correlation ?? {})
  const sourceEventIdentity =
    asString(input.sourceEventIdentity).trim() ||
    source.eventId ||
    (source.entityId && type ? `${type}:${source.entityId}` : '') ||
    ''

  const idempotencyKey =
    asString(input.idempotencyKey).trim() ||
    makeAutomationIdempotencyKey(companyId, source.domain, sourceEventIdentity)

  if (!idempotencyKey) {
    throw new ValidationError('AutomationEvent requires idempotency identity.', [
      {
        field: 'idempotencyKey',
        message: 'A durable source event identity is required.',
      },
    ])
  }

  const intakeStatus = AUTOMATION_INTAKE_STATUSES.includes(input.intake?.status)
    ? input.intake.status
    : AUTOMATION_INTAKE_STATUS.ACCEPTED

  const receivedAt = asIso(input.receivedAt, nowIso())
  const occurredAt = asIso(input.occurredAt, receivedAt)

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('aevt'),
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : AUTOMATION_EVENT_SCHEMA_VERSION,
    type,
    companyId,
    occurredAt,
    receivedAt,
    source,
    correlation,
    idempotencyKey,
    sourceEventIdentity,
    payload: sanitizeAutomationPayload(input.payload),
    intake: Object.freeze({
      status: intakeStatus,
      reason: asOptionalId(input.intake?.reason),
    }),
  })
}

export function cloneAutomationEvent(event) {
  return makeAutomationEvent(event ?? {})
}

/**
 * @param {object | null | undefined} event
 */
export function presentClientAutomationEvent(event) {
  if (!event) return null
  const next = makeAutomationEvent(event)
  return Object.freeze({
    id: next.id,
    schemaVersion: next.schemaVersion,
    type: next.type,
    companyId: next.companyId,
    occurredAt: next.occurredAt,
    source: Object.freeze({
      domain: next.source.domain,
      entityType: next.source.entityType,
      entityId: next.source.entityId,
      eventId: next.source.eventId,
    }),
    correlation: Object.freeze({
      proposalId: next.correlation.proposalId,
      sessionId: next.correlation.sessionId,
      closeId: next.correlation.closeId,
      followupId: next.correlation.followupId,
      shareToken: null,
      actorId: null,
    }),
    intake: Object.freeze({
      status: next.intake.status,
      reason: next.intake.reason,
    }),
  })
}

/**
 * @param {object | null | undefined} event
 */
export function presentStudioAutomationEvent(event) {
  if (!event) return null
  const next = makeAutomationEvent(event)
  return Object.freeze({
    id: next.id,
    schemaVersion: next.schemaVersion,
    type: next.type,
    companyId: next.companyId,
    occurredAt: next.occurredAt,
    receivedAt: next.receivedAt,
    source: Object.freeze({ ...next.source }),
    correlation: Object.freeze({ ...next.correlation }),
    idempotencyKey: next.idempotencyKey,
    payload: Object.freeze({ ...next.payload }),
    intake: Object.freeze({ ...next.intake }),
  })
}

/**
 * Minimal persisted receipt — not a domain audit warehouse.
 *
 * @param {object} [input]
 */
export function makeAutomationIntakeReceipt(input = {}) {
  const companyId = asOptionalId(input.companyId)
  const idempotencyKey = asString(input.idempotencyKey).trim()
  const sourceDomain = asString(input.sourceDomain).trim()
  const sourceEventIdentity = asString(input.sourceEventIdentity).trim()
  if (!companyId || !idempotencyKey || !sourceDomain || !sourceEventIdentity) {
    throw new ValidationError('Intake receipt requires identity fields.', [
      { field: 'idempotencyKey', message: 'Receipt identity is incomplete.' },
    ])
  }
  const status = AUTOMATION_INTAKE_STATUSES.includes(input.status)
    ? input.status
    : AUTOMATION_INTAKE_STATUS.ACCEPTED
  return Object.freeze({
    idempotencyKey,
    companyId,
    sourceDomain,
    sourceEventIdentity,
    status,
    reason: asOptionalId(input.reason),
    automationEventId: asOptionalId(input.automationEventId),
    receivedAt: asIso(input.receivedAt, nowIso()),
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : AUTOMATION_EVENT_SCHEMA_VERSION,
  })
}

export { AUTOMATION_INTAKE_REASON, AUTOMATION_INTAKE_STATUS }
