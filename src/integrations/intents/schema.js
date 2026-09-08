/**
 * H16.4 — AutomationActionIntent schema.
 *
 * Thin, company-scoped intent records. No secrets, documents, or attempts.
 */

import { createRecordId } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import { INTEGRATION_KINDS } from '../types.js'
import { sanitizeAutomationPayload } from '../events/schema.js'
import {
  AUTOMATION_ACTION_INTENT_LIMITS,
  AUTOMATION_ACTION_INTENT_SCHEMA_VERSION,
  AUTOMATION_ACTION_INTENT_STATUS,
  AUTOMATION_ACTION_INTENT_STATUSES,
} from './types.js'

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
  return id.slice(0, AUTOMATION_ACTION_INTENT_LIMITS.MAX_ID)
}

function asRequiredCompanyId(value) {
  const companyId = asOptionalId(value)
  if (!companyId) {
    throw new ValidationError('AutomationActionIntent requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return companyId
}

/**
 * Deterministic intent key:
 * ${event.id}|${rule.id}|${rule.version}|${actionIndex}|${actionType}
 *
 * @param {string} eventId
 * @param {string} ruleId
 * @param {number} ruleVersion
 * @param {number} actionIndex
 * @param {string} actionType
 */
export function makeAutomationActionIntentIdempotencyKey(
  eventId,
  ruleId,
  ruleVersion,
  actionIndex,
  actionType,
) {
  const event = asString(eventId).trim()
  const rule = asString(ruleId).trim()
  const version = Number.isInteger(ruleVersion) ? ruleVersion : 0
  const index = Number.isInteger(actionIndex) && actionIndex >= 0 ? actionIndex : -1
  const type = asString(actionType).trim()
  if (!event || !rule || version < 1 || index < 0 || !type) return null
  return `${event}|${rule}|${version}|${index}|${type}`
}

function makeCorrelation(input = {}) {
  return Object.freeze({
    proposalId: asOptionalId(input.proposalId),
    followupId: asOptionalId(input.followupId),
    sessionId: asOptionalId(input.sessionId),
    closeId: asOptionalId(input.closeId),
    actorId: asOptionalId(input.actorId),
  })
}

/**
 * @param {object} [input]
 */
export function makeAutomationActionIntent(input = {}) {
  const companyId = asRequiredCompanyId(input.companyId)
  const kind = asString(input.kind).trim()
  if (!INTEGRATION_KINDS.includes(kind)) {
    throw new ValidationError('AutomationActionIntent kind is invalid.', [
      { field: 'kind', message: `kind must be one of: ${INTEGRATION_KINDS.join(', ')}.` },
    ])
  }
  const actionType = asString(input.actionType).trim()
  if (!actionType) {
    throw new ValidationError('AutomationActionIntent requires actionType.', [
      { field: 'actionType', message: 'actionType is required.' },
    ])
  }
  const eventId = asOptionalId(input.eventId)
  const ruleId = asOptionalId(input.ruleId)
  const ruleVersion =
    Number.isInteger(input.ruleVersion) && input.ruleVersion > 0
      ? input.ruleVersion
      : 0
  const actionIndex =
    Number.isInteger(input.actionIndex) && input.actionIndex >= 0
      ? input.actionIndex
      : -1
  if (!eventId || !ruleId || ruleVersion < 1 || actionIndex < 0) {
    throw new ValidationError('AutomationActionIntent requires lineage fields.', [
      {
        field: 'lineage',
        message: 'eventId, ruleId, ruleVersion, and actionIndex are required.',
      },
    ])
  }

  const status = AUTOMATION_ACTION_INTENT_STATUSES.includes(input.status)
    ? input.status
    : AUTOMATION_ACTION_INTENT_STATUS.RECORDED

  const idempotencyKey =
    asString(input.idempotencyKey).trim() ||
    makeAutomationActionIntentIdempotencyKey(
      eventId,
      ruleId,
      ruleVersion,
      actionIndex,
      actionType,
    )
  if (!idempotencyKey) {
    throw new ValidationError('AutomationActionIntent requires idempotencyKey.', [
      { field: 'idempotencyKey', message: 'idempotency key is incomplete.' },
    ])
  }

  const createdAt = asIso(input.createdAt, nowIso())
  const updatedAt = asIso(input.updatedAt, createdAt)
  const cancelledAt =
    status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED
      ? asIso(input.cancelledAt, updatedAt)
      : null
  const cancelReason =
    status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED
      ? asString(input.cancelReason)
          .trim()
          .slice(0, AUTOMATION_ACTION_INTENT_LIMITS.MAX_CANCEL_REASON) || null
      : null

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('aint'),
    companyId,
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : AUTOMATION_ACTION_INTENT_SCHEMA_VERSION,
    kind,
    actionType,
    status,
    idempotencyKey,
    eventId,
    eventIdempotencyKey: asString(input.eventIdempotencyKey).trim() || null,
    ruleId,
    ruleVersion,
    ruleRunId: asOptionalId(input.ruleRunId),
    actionIndex,
    payload: sanitizeAutomationPayload(input.payload),
    correlation: makeCorrelation(input.correlation),
    providerId: asOptionalId(input.providerId),
    createdAt,
    updatedAt,
    cancelledAt,
    cancelReason,
  })
}

export function cloneAutomationActionIntent(intent) {
  return makeAutomationActionIntent(intent ?? {})
}

export function presentStudioAutomationActionIntent(intent) {
  if (!intent) return null
  return makeAutomationActionIntent(intent)
}
