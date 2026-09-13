/**
 * H16.16 Slice 16.1 — Delivery execution authorization schema.
 *
 * Maps a recorded delivery AutomationActionIntent onto a frozen in-memory
 * request. Does not mutate the intent, write an outcome, or send anything.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { assertNoSecretValues } from '../schema.js'
import { sanitizeAutomationPayload } from '../events/schema.js'
import { INTEGRATION_KIND } from '../types.js'
import { NULL_INTEGRATION_ADAPTER_ID } from '../adapters/types.js'
import { getAutomationActionIntentForCompany } from '../intents/store.js'
import { AUTOMATION_ACTION_INTENT_STATUS } from '../intents/types.js'
import { AUTOMATION_RULE_ACTION_TYPE } from '../rules/types.js'
import {
  DELIVERY_EXECUTION_FORBIDDEN_FIELDS,
  DELIVERY_EXECUTION_SCHEMA_VERSION,
  DELIVERY_EXECUTION_STATUS,
  DELIVERY_FAILURE_CODES,
  DELIVERY_OUTCOME_STATUS,
} from './types.js'

const DELIVERY_ACTION_TYPE = AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT
const NULL_DELIVERY_ADAPTER_ID = NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.DELIVERY]

function trim(value) {
  return value == null ? '' : String(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function assertCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw invalid('companyId is required.', 'companyId')
  }
  return check.companyId
}

function assertStoredCompany(record, scoped) {
  if (trim(record?.companyId) !== scoped) {
    throw invalid('companyId does not match the requested workspace.', 'companyId')
  }
}

function assertNoForbiddenFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of DELIVERY_EXECUTION_FORBIDDEN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid('Delivery execution cannot carry secret, OAuth, or vendor fields.', key)
  }
  assertNoSecretValues(input)
}

function freezeCorrelation(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  assertNoForbiddenFields(source)
  return Object.freeze({
    proposalId: trim(source.proposalId) || null,
    followupId: trim(source.followupId) || null,
    sessionId: trim(source.sessionId) || null,
    closeId: trim(source.closeId) || null,
    actorId: trim(source.actorId) || null,
  })
}

function freezeRequest({ companyId, intentId, idempotencyKey, payload, correlation }) {
  return Object.freeze({
    schemaVersion: DELIVERY_EXECUTION_SCHEMA_VERSION,
    status: DELIVERY_EXECUTION_STATUS.AUTHORIZED,
    kind: INTEGRATION_KIND.DELIVERY,
    companyId,
    intentId,
    idempotencyKey,
    actionType: DELIVERY_ACTION_TYPE,
    adapterId: NULL_DELIVERY_ADAPTER_ID,
    channel: null,
    payload: sanitizeAutomationPayload(payload),
    correlation: freezeCorrelation(correlation),
    network: false,
    oauth: false,
  })
}

/**
 * @param {object} intent
 * @param {string} companyId
 * @returns {object}
 */
export function makeDeliveryExecutionRequest(intent, companyId) {
  const scoped = assertCompany(companyId)
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    throw invalid('intent is required.', 'intent')
  }

  assertNoForbiddenFields(intent)
  assertNoForbiddenFields(intent.payload)
  assertNoForbiddenFields(intent.correlation)

  const intentId = trim(intent.id)
  if (!intentId) {
    throw invalid('intent id is required.', 'intentId')
  }

  const stored = getAutomationActionIntentForCompany(scoped, intentId)
  assertStoredCompany(stored, scoped)
  if (Object.prototype.hasOwnProperty.call(intent, 'companyId')) {
    assertStoredCompany(intent, scoped)
  }

  if (stored.kind !== INTEGRATION_KIND.DELIVERY) {
    throw invalid('kind must be delivery.', 'kind')
  }
  if (trim(stored.actionType) !== DELIVERY_ACTION_TYPE) {
    throw invalid('actionType must be enqueue_delivery_intent.', 'actionType')
  }
  if (stored.status !== AUTOMATION_ACTION_INTENT_STATUS.RECORDED) {
    throw invalid('intent must be recorded before delivery execution.', 'status')
  }

  return freezeRequest({
    companyId: scoped,
    intentId: stored.id,
    idempotencyKey: stored.idempotencyKey,
    payload: stored.payload,
    correlation: stored.correlation,
  })
}

/**
 * @param {object} [request]
 * @returns {object}
 */
export function cloneDeliveryExecutionRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw invalid('delivery execution request is required.', 'request')
  }
  if (request.status !== DELIVERY_EXECUTION_STATUS.AUTHORIZED) {
    throw invalid('delivery execution status must be authorized.', 'status')
  }
  if (request.kind !== INTEGRATION_KIND.DELIVERY) {
    throw invalid('kind must be delivery.', 'kind')
  }
  const intentId = trim(request.intentId)
  if (!intentId) {
    throw invalid('intent id is required.', 'intentId')
  }
  const idempotencyKey = trim(request.idempotencyKey)
  if (!idempotencyKey) {
    throw invalid('idempotencyKey is required.', 'idempotencyKey')
  }
  if (trim(request.actionType) !== DELIVERY_ACTION_TYPE) {
    throw invalid('actionType must be enqueue_delivery_intent.', 'actionType')
  }
  if (trim(request.adapterId) !== NULL_DELIVERY_ADAPTER_ID) {
    throw invalid('adapterId must be null_delivery.', 'adapterId')
  }
  if (request.network !== false) {
    throw invalid('network must be false.', 'network')
  }
  if (request.oauth !== false) {
    throw invalid('oauth must be false.', 'oauth')
  }
  return freezeRequest({
    companyId: assertCompany(request.companyId),
    intentId,
    idempotencyKey: request.idempotencyKey,
    payload: request.payload,
    correlation: request.correlation,
  })
}

/**
 * @param {object} [request]
 * @returns {object | null}
 */
export function presentStudioDeliveryExecutionRequest(request) {
  if (!request) return null
  return cloneDeliveryExecutionRequest(request)
}

function freezeOutcome({
  companyId,
  intentId,
  idempotencyKey,
  failureCode,
}) {
  return Object.freeze({
    schemaVersion: DELIVERY_EXECUTION_SCHEMA_VERSION,
    status: DELIVERY_OUTCOME_STATUS.REJECTED,
    kind: INTEGRATION_KIND.DELIVERY,
    companyId,
    intentId,
    idempotencyKey,
    adapterId: NULL_DELIVERY_ADAPTER_ID,
    failureCode,
    retryable: false,
    network: false,
    oauth: false,
  })
}

/**
 * Frozen rejected delivery outcome. There is no succeeded path.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function makeDeliveryExecutionOutcome(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('delivery execution outcome is required.', 'outcome')
  }
  if (
    input.status != null &&
    trim(input.status) !== DELIVERY_OUTCOME_STATUS.REJECTED
  ) {
    throw invalid('delivery execution outcome status must be rejected.', 'status')
  }
  if (input.kind != null && trim(input.kind) !== INTEGRATION_KIND.DELIVERY) {
    throw invalid('kind must be delivery.', 'kind')
  }
  const intentId = trim(input.intentId)
  if (!intentId) {
    throw invalid('intent id is required.', 'intentId')
  }
  const idempotencyKey = trim(input.idempotencyKey)
  if (!idempotencyKey) {
    throw invalid('idempotencyKey is required.', 'idempotencyKey')
  }
  if (
    input.adapterId != null &&
    trim(input.adapterId) !== NULL_DELIVERY_ADAPTER_ID
  ) {
    throw invalid('adapterId must be null_delivery.', 'adapterId')
  }
  const failureCode = trim(input.failureCode)
  if (!DELIVERY_FAILURE_CODES.includes(failureCode)) {
    throw invalid('failureCode is required.', 'failureCode')
  }
  if (input.retryable != null && input.retryable !== false) {
    throw invalid('retryable must be false.', 'retryable')
  }
  if (input.network != null && input.network !== false) {
    throw invalid('network must be false.', 'network')
  }
  if (input.oauth != null && input.oauth !== false) {
    throw invalid('oauth must be false.', 'oauth')
  }
  return freezeOutcome({
    companyId: assertCompany(input.companyId),
    intentId,
    idempotencyKey: input.idempotencyKey,
    failureCode,
  })
}

/**
 * @param {object} [outcome]
 * @returns {object}
 */
export function cloneDeliveryExecutionOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) {
    throw invalid('delivery execution outcome is required.', 'outcome')
  }
  if (outcome.status !== DELIVERY_OUTCOME_STATUS.REJECTED) {
    throw invalid('delivery execution outcome status must be rejected.', 'status')
  }
  if (outcome.kind !== INTEGRATION_KIND.DELIVERY) {
    throw invalid('kind must be delivery.', 'kind')
  }
  const intentId = trim(outcome.intentId)
  if (!intentId) {
    throw invalid('intent id is required.', 'intentId')
  }
  const idempotencyKey = trim(outcome.idempotencyKey)
  if (!idempotencyKey) {
    throw invalid('idempotencyKey is required.', 'idempotencyKey')
  }
  if (trim(outcome.adapterId) !== NULL_DELIVERY_ADAPTER_ID) {
    throw invalid('adapterId must be null_delivery.', 'adapterId')
  }
  if (!DELIVERY_FAILURE_CODES.includes(trim(outcome.failureCode))) {
    throw invalid('failureCode is required.', 'failureCode')
  }
  if (outcome.retryable !== false) {
    throw invalid('retryable must be false.', 'retryable')
  }
  if (outcome.network !== false) {
    throw invalid('network must be false.', 'network')
  }
  if (outcome.oauth !== false) {
    throw invalid('oauth must be false.', 'oauth')
  }
  return freezeOutcome({
    companyId: assertCompany(outcome.companyId),
    intentId,
    idempotencyKey: outcome.idempotencyKey,
    failureCode: trim(outcome.failureCode),
  })
}

/**
 * Read/presentation only. No persistence, execution, or mutation.
 *
 * @param {object} [outcome]
 * @returns {object | null}
 */
export function presentStudioDeliveryExecutionOutcome(outcome) {
  if (!outcome) return null
  return cloneDeliveryExecutionOutcome(outcome)
}
