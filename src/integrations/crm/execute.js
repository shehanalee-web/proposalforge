/**
 * H16.6 — Synchronous CRM execution.
 *
 * Consumes recorded H16.4 `crm` intents. Never mutates the intent.
 * Application-level duplicate suppression by intent.id — not external
 * exactly-once. No workers, outbox, queues, retries, leasing, or DLQ.
 *
 * Credentials are never resolved here: mock_crm needs none and no vendor
 * transport exists in this milestone.
 */

import { NotFoundError } from '../../services/errors.js'
import { INTEGRATION_CAPABILITIES, INTEGRATION_KIND } from '../types.js'
import { getAutomationActionIntentForCompany } from '../intents/store.js'
import { AUTOMATION_ACTION_INTENT_STATUS } from '../intents/types.js'
import { getCrmConnectionForCompany } from './connections.js'
import { getCrmAdapter, normalizeCrmAdapterResult } from './adapter.js'
import './adapters.js'
import { buildCrmMutation } from './mapping.js'
import { findCrmOutcomeByIntentId, recordCrmOutcome } from './outcomes.js'
import {
  CRM_FAILURE_CODE,
  CRM_LIMITS,
  CRM_OUTCOME_STATUS,
} from './types.js'

/** H16.3 action type that produces CRM intents. */
export const CRM_INTENT_ACTION_TYPE = 'enqueue_crm_intent'

/** @type {boolean | null} */
let capabilityOverride = null

/**
 * Test-only capability override (does not mutate frozen INTEGRATION_CAPABILITIES).
 *
 * @param {boolean | null} value
 */
export function setCrmCapabilityOverrideForTests(value) {
  capabilityOverride = typeof value === 'boolean' ? value : null
}

export function isCrmCapabilityEnabled() {
  if (capabilityOverride != null) return capabilityOverride
  return INTEGRATION_CAPABILITIES.crm === true
}

function sanitizeErrorMessage(message) {
  return String(message ?? '')
    .replace(/(env|vault|secretref):[A-Za-z0-9_./:-]+/gi, '[ref]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, CRM_LIMITS.MAX_ERROR)
}

function persistOutcome(input) {
  return recordCrmOutcome({
    ...input,
    truncatedError: input.truncatedError ? sanitizeErrorMessage(input.truncatedError) : null,
    attemptNumber: 1,
    completedAt: new Date().toISOString(),
  }).outcome
}

function terminal({ ok, outcome, intent }) {
  return {
    ok,
    duplicate: false,
    outcome,
    lineage: lineageOf(intent),
  }
}

function lineageOf(intent) {
  if (!intent) return null
  return Object.freeze({
    intentId: intent.id,
    eventId: intent.eventId,
    ruleId: intent.ruleId,
    ruleVersion: intent.ruleVersion,
    actionIndex: intent.actionIndex,
    idempotencyKey: intent.idempotencyKey,
    actorId: intent.correlation?.actorId ?? null,
    runAsActorId: intent.correlation?.actorId ?? null,
    proposalId: intent.correlation?.proposalId ?? null,
  })
}

function reject({
  companyId,
  intentId,
  intent = null,
  connectionId = null,
  providerId = null,
  operation = null,
  failureCode,
  message,
  retryable = false,
}) {
  return terminal({
    ok: false,
    intent,
    outcome: persistOutcome({
      companyId,
      intentId,
      connectionId,
      providerId,
      operation,
      status: CRM_OUTCOME_STATUS.REJECTED,
      idempotencyKey: intentId,
      failureCode,
      retryable,
      truncatedError: message,
    }),
  })
}

/**
 * Execute a recorded CRM intent against its company-scoped connection.
 *
 * @param {{ companyId: string, intentId: string }} input
 */
export async function executeCrmIntent(input = {}) {
  const companyId = String(input.companyId ?? '').trim()
  const intentId = String(input.intentId ?? '').trim()

  if (!companyId || !intentId) {
    throw new NotFoundError('CRM execution requires companyId and intentId.')
  }

  // Application-level idempotency: one terminal outcome per intent.id.
  const existing = findCrmOutcomeByIntentId(intentId)
  if (existing) {
    if (existing.companyId !== companyId) {
      throw new NotFoundError('CRM execution outcome not found for company.')
    }
    return {
      ok: existing.status === CRM_OUTCOME_STATUS.SUCCEEDED,
      duplicate: true,
      outcome: existing,
      lineage: null,
    }
  }

  if (!isCrmCapabilityEnabled()) {
    return reject({
      companyId,
      intentId,
      failureCode: CRM_FAILURE_CODE.CAPABILITY_DISABLED,
      message: 'CRM capability is disabled.',
    })
  }

  const intent = getAutomationActionIntentForCompany(companyId, intentId)

  if (intent.kind !== INTEGRATION_KIND.CRM) {
    return reject({
      companyId,
      intentId,
      intent,
      failureCode: CRM_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Intent kind is not crm.',
    })
  }

  if (intent.actionType !== CRM_INTENT_ACTION_TYPE) {
    return reject({
      companyId,
      intentId,
      intent,
      failureCode: CRM_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Intent actionType is not enqueue_crm_intent.',
    })
  }

  if (intent.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED) {
    return reject({
      companyId,
      intentId,
      intent,
      failureCode: CRM_FAILURE_CODE.INTENT_CANCELLED,
      message: 'Cancelled intents are never executed.',
    })
  }

  const connectionId = String(intent.payload?.connectionId ?? '').trim()
  if (!connectionId) {
    return reject({
      companyId,
      intentId,
      intent,
      failureCode: CRM_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Intent payload requires connectionId.',
    })
  }

  // Company scope comes from the intent, never from a client-supplied override.
  let connection
  try {
    connection = getCrmConnectionForCompany(intent.companyId, connectionId)
  } catch {
    return reject({
      companyId,
      intentId,
      intent,
      connectionId,
      failureCode: CRM_FAILURE_CODE.NOT_FOUND,
      message: 'CRM connection was not found for this company.',
    })
  }

  if (!connection.enabled) {
    return reject({
      companyId,
      intentId,
      intent,
      connectionId,
      providerId: connection.providerId,
      failureCode: CRM_FAILURE_CODE.CONNECTION_DISABLED,
      message: 'CRM connection is disabled.',
    })
  }

  const adapter = getCrmAdapter(connection.providerId)
  if (!adapter || !adapter.isEnabled(connection)) {
    return reject({
      companyId,
      intentId,
      intent,
      connectionId,
      providerId: connection.providerId,
      failureCode: CRM_FAILURE_CODE.PROVIDER_DISABLED,
      message: 'CRM provider adapter is disabled.',
    })
  }

  const operation = String(intent.payload?.operation ?? '').trim()
  const mapped = buildCrmMutation({
    operation,
    payload: intent.payload,
    companyId: intent.companyId,
    connectionId: connection.id,
    providerId: connection.providerId,
    idempotencyKey: intent.id,
    correlation: intent.correlation,
  })
  if (!mapped.ok) {
    return reject({
      companyId,
      intentId,
      intent,
      connectionId,
      providerId: connection.providerId,
      operation,
      failureCode: mapped.failureCode,
      message: mapped.message,
    })
  }

  const mutation = mapped.mutation
  const context = Object.freeze({
    companyId: intent.companyId,
    connectionId: connection.id,
    providerId: connection.providerId,
    config: connection.config,
    intentId: intent.id,
    actorId: intent.correlation?.actorId ?? null,
  })

  let raw
  try {
    raw = await adapter.applyMutation(mutation, context)
  } catch (error) {
    return terminal({
      ok: false,
      intent,
      outcome: persistOutcome({
        companyId,
        intentId,
        connectionId: connection.id,
        providerId: connection.providerId,
        operation,
        status: CRM_OUTCOME_STATUS.FAILED,
        idempotencyKey: intent.id,
        externalKey: mutation.externalKey,
        failureCode: CRM_FAILURE_CODE.PROVIDER_ERROR,
        retryable: true,
        truncatedError: sanitizeErrorMessage(error?.message || 'CRM adapter threw.'),
      }),
    })
  }

  const result = normalizeCrmAdapterResult(raw)

  if (!result.ok) {
    return terminal({
      ok: false,
      intent,
      outcome: persistOutcome({
        companyId,
        intentId,
        connectionId: connection.id,
        providerId: connection.providerId,
        operation,
        status: CRM_OUTCOME_STATUS.FAILED,
        idempotencyKey: intent.id,
        externalKey: mutation.externalKey,
        failureCode: result.failureCode || CRM_FAILURE_CODE.PROVIDER_ERROR,
        retryable: result.retryable,
        truncatedError: result.message || 'CRM mutation failed.',
      }),
    })
  }

  return terminal({
    ok: true,
    intent,
    outcome: persistOutcome({
      companyId,
      intentId,
      connectionId: connection.id,
      providerId: connection.providerId,
      operation,
      status: CRM_OUTCOME_STATUS.SUCCEEDED,
      idempotencyKey: intent.id,
      externalId: result.externalId,
      externalKey: mutation.externalKey,
      failureCode: null,
      retryable: false,
      sanitizedResult: result.result,
      truncatedError: null,
    }),
  })
}
