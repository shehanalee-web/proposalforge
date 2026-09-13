/**
 * H16.16 Slice 16.2 — Fail-closed delivery execution.
 *
 * Consumes a recorded H16.4 delivery intent through the 16.1 authorization
 * contract, then rejects because deliveryExecution is off and null_delivery
 * is disabled. Never sends. Never mutates the intent.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { getIntegrationAdapter } from '../adapters/adapter.js'
import { NULL_INTEGRATION_ADAPTER_ID } from '../adapters/types.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { getAutomationActionIntentForCompany } from '../intents/store.js'
import { AUTOMATION_ACTION_INTENT_STATUS } from '../intents/types.js'
import { INTEGRATION_CAPABILITIES, INTEGRATION_KIND } from '../types.js'
import { findDeliveryOutcomeByIntentId, recordDeliveryOutcome } from './outcomes.js'
import { makeDeliveryExecutionRequest } from './schema.js'
import { DELIVERY_FAILURE_CODE } from './types.js'

const NULL_DELIVERY_ADAPTER_ID = NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.DELIVERY]

/** @type {boolean | null} */
let capabilityOverride = null

/**
 * Test-only. Does not mutate INTEGRATION_CAPABILITIES.
 *
 * @param {boolean | null} value
 */
export function setDeliveryExecutionCapabilityOverrideForTests(value) {
  capabilityOverride = typeof value === 'boolean' ? value : null
}

function isDeliveryExecutionCapable() {
  if (capabilityOverride != null) return capabilityOverride
  return INTEGRATION_CAPABILITIES.deliveryExecution === true
}

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

function lineageOf(intent) {
  return Object.freeze({
    intentId: intent.id,
    eventId: intent.eventId,
    ruleId: intent.ruleId,
    ruleVersion: intent.ruleVersion,
    actionIndex: intent.actionIndex,
    idempotencyKey: intent.idempotencyKey,
  })
}

function reject({ companyId, intent, request = null, failureCode }) {
  const recorded = recordDeliveryOutcome({
    companyId,
    intentId: intent.id,
    idempotencyKey: intent.idempotencyKey,
    adapterId: NULL_DELIVERY_ADAPTER_ID,
    failureCode,
    retryable: false,
    network: false,
    oauth: false,
  })
  return {
    ok: false,
    duplicate: recorded.duplicate,
    outcome: recorded.outcome,
    request,
    lineage: lineageOf(intent),
  }
}

function adapterDisabled() {
  const adapter = getIntegrationAdapter(INTEGRATION_KIND.DELIVERY, NULL_DELIVERY_ADAPTER_ID)
  return !adapter || adapter.isEnabled() !== true
}

/**
 * Authorize via 16.1, then refuse send. No successful delivery path.
 *
 * @param {{ companyId?: string, intentId?: string }} [input]
 */
export function executeDeliveryForIntent(input = {}) {
  const companyId = trim(input.companyId)
  const intentId = trim(input.intentId)
  if (!companyId) {
    throw invalid('companyId is required.', 'companyId')
  }
  if (!intentId) {
    throw invalid('intent id is required.', 'intentId')
  }

  const scoped = assertCompany(companyId)

  const existing = findDeliveryOutcomeByIntentId(intentId)
  if (existing) {
    if (existing.companyId !== scoped) {
      throw new ForbiddenError('You cannot access another company workspace.')
    }
    return {
      ok: false,
      duplicate: true,
      outcome: existing,
      request: null,
      lineage: null,
    }
  }

  const intent = getAutomationActionIntentForCompany(scoped, intentId)

  let request = null
  try {
    request = makeDeliveryExecutionRequest(intent, scoped)
  } catch (error) {
    if (
      intent.kind === INTEGRATION_KIND.DELIVERY &&
      intent.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED
    ) {
      return reject({
        companyId: scoped,
        intent,
        failureCode: DELIVERY_FAILURE_CODE.INTENT_CANCELLED,
      })
    }
    throw error
  }

  const adapterIsDisabled = adapterDisabled()
  let failureCode = DELIVERY_FAILURE_CODE.ADAPTER_DISABLED
  if (!isDeliveryExecutionCapable()) {
    failureCode = DELIVERY_FAILURE_CODE.CAPABILITY_DISABLED
  } else if (adapterIsDisabled) {
    failureCode = DELIVERY_FAILURE_CODE.ADAPTER_DISABLED
  }
  return reject({
    companyId: scoped,
    intent,
    request,
    failureCode,
  })
}
