/**
 * H16.5 — Normalized outbound webhook envelope + deterministic JSON.
 *
 * Never dumps raw AutomationEvent / AutomationActionIntent records.
 */

import { createRecordId } from '../../models/ids.js'
import {
  OUTBOUND_WEBHOOK_ENVELOPE_TYPE,
  OUTBOUND_WEBHOOK_SCHEMA_VERSION,
} from './types.js'
import { sanitizeOutboundWebhookData } from './schema.js'

function asId(value) {
  const id = value == null ? '' : String(value).trim()
  return id || null
}

/**
 * Stable JSON serialization (sorted object keys, no whitespace).
 *
 * @param {unknown} value
 */
export function stableStringify(value) {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return JSON.stringify(value)
  }
  if (type !== 'object') return 'null'
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const keys = Object.keys(value).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

/**
 * Build a versioned, sanitized webhook envelope from an H16.4 intent.
 *
 * @param {object} intent
 * @param {{ occurredAt?: string, envelopeId?: string }} [options]
 */
export function buildOutboundWebhookEnvelope(intent, options = {}) {
  const correlation = intent?.correlation && typeof intent.correlation === 'object'
    ? intent.correlation
    : {}
  const occurredAt = options.occurredAt
    ? new Date(options.occurredAt).toISOString()
    : new Date().toISOString()

  return Object.freeze({
    schemaVersion: OUTBOUND_WEBHOOK_SCHEMA_VERSION,
    type: OUTBOUND_WEBHOOK_ENVELOPE_TYPE,
    id: asId(options.envelopeId) || createRecordId('owhe'),
    occurredAt,
    companyId: asId(intent?.companyId),
    intent: Object.freeze({
      id: asId(intent?.id),
      kind: asId(intent?.kind),
      actionType: asId(intent?.actionType),
      idempotencyKey: asId(intent?.idempotencyKey),
    }),
    event: Object.freeze({
      id: asId(intent?.eventId),
      idempotencyKey: asId(intent?.eventIdempotencyKey),
    }),
    rule: Object.freeze({
      id: asId(intent?.ruleId),
      version: Number.isInteger(intent?.ruleVersion) ? intent.ruleVersion : null,
      actionIndex: Number.isInteger(intent?.actionIndex) ? intent.actionIndex : null,
    }),
    correlation: Object.freeze({
      proposalId: asId(correlation.proposalId),
      followupId: asId(correlation.followupId),
      sessionId: asId(correlation.sessionId),
      closeId: asId(correlation.closeId),
      actorId: asId(correlation.actorId),
    }),
    data: sanitizeOutboundWebhookData(intent?.payload),
  })
}

/**
 * @param {object} envelope
 * @returns {string}
 */
export function serializeOutboundWebhookEnvelope(envelope) {
  return stableStringify(envelope)
}
