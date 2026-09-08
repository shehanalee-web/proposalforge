/**
 * H16.2 — Idempotent automation event intake.
 *
 * Records thin AutomationEvents + durable receipt ledger entries.
 * Never mutates proposals, decisions, CommercialClose, workflow, or follow-ups.
 */

import { INTEGRATION_CAPABILITIES } from '../types.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  AUTOMATION_EVENT_SCHEMA_VERSION,
  AUTOMATION_INTAKE_REASON,
  AUTOMATION_INTAKE_STATUS,
} from './types.js'
import { makeAutomationIntakeReceipt, presentStudioAutomationEvent } from './schema.js'
import { normalizeDomainEvent } from './normalize.js'
import {
  findAutomationEventById,
  findAutomationIntakeReceipt,
  getAutomationEventById,
  listAcceptedAutomationEventsForCompany,
  listAutomationIntakeReceiptsForCompany,
  recordAcceptedAutomationIntake,
  recordAutomationIntakeReceiptOnly,
} from './store.js'

function resultShape({
  ok,
  status,
  reason = null,
  event = null,
  receipt = null,
  duplicate = false,
}) {
  return Object.freeze({
    ok,
    status,
    reason,
    duplicate,
    event: event ? presentStudioAutomationEvent(event) : null,
    receipt: receipt ? makeAutomationIntakeReceipt(receipt) : null,
  })
}

/**
 * Normalize only — no persistence.
 *
 * @param {object} input
 */
export function normalizeDomainEventForIntake(input) {
  return normalizeDomainEvent(input)
}

/**
 * Idempotent ingest of a domain emission / normalized draft.
 *
 * @param {object} input
 */
export function ingestAutomationEvent(input = {}) {
  if (!INTEGRATION_CAPABILITIES.eventIntake) {
    return resultShape({
      ok: false,
      status: AUTOMATION_INTAKE_STATUS.REJECTED,
      reason: AUTOMATION_INTAKE_REASON.INTAKE_DISABLED,
    })
  }

  const normalized =
    input.event && input.event.idempotencyKey
      ? {
          ok: true,
          status: AUTOMATION_INTAKE_STATUS.ACCEPTED,
          reason: null,
          event: input.event,
        }
      : normalizeDomainEvent(input)

  if (!normalized.ok || !normalized.event) {
    const status =
      normalized.status || AUTOMATION_INTAKE_STATUS.REJECTED
    const reason =
      normalized.reason || AUTOMATION_INTAKE_REASON.MALFORMED_EVENT

    // Persist minimal rejected/ignored receipts only when identity is known.
    const companyId = String(input.companyId ?? input.rawEvent?.companyId ?? '').trim()
    const domain = String(
      input.sourceDomain || input.domain || input.source?.domain || '',
    ).trim()
    const identity = String(
      input.sourceEventIdentity ||
        input.sourceEventId ||
        input.rawEvent?.id ||
        input.busEvent?.payload?.eventId ||
        '',
    ).trim()

    let receipt = null
    if (
      companyId &&
      domain &&
      identity &&
      (status === AUTOMATION_INTAKE_STATUS.IGNORED ||
        status === AUTOMATION_INTAKE_STATUS.REJECTED)
    ) {
      const key = `${companyId}|${domain}|${identity}`
      const existing = findAutomationIntakeReceipt(key)
      if (existing) {
        receipt = existing
      } else {
        receipt = recordAutomationIntakeReceiptOnly({
          idempotencyKey: key,
          companyId,
          sourceDomain: domain,
          sourceEventIdentity: identity,
          status,
          reason,
          automationEventId: null,
          schemaVersion: AUTOMATION_EVENT_SCHEMA_VERSION,
        })
      }
    }

    return resultShape({
      ok: false,
      status,
      reason,
      receipt,
    })
  }

  const event = normalized.event
  const companyCheck = evaluateIntegrationCompanyScope(
    event.companyId,
    input.expectedCompanyId,
  )
  if (!companyCheck.ok) {
    return resultShape({
      ok: false,
      status: AUTOMATION_INTAKE_STATUS.REJECTED,
      reason: companyCheck.reason,
    })
  }

  const existingReceipt = findAutomationIntakeReceipt(event.idempotencyKey)
  if (existingReceipt) {
    const existingEvent = existingReceipt.automationEventId
      ? findAutomationEventById(existingReceipt.automationEventId)
      : null
    return resultShape({
      ok: true,
      status: AUTOMATION_INTAKE_STATUS.DUPLICATE,
      reason: AUTOMATION_INTAKE_REASON.DUPLICATE,
      duplicate: true,
      event: existingEvent || event,
      receipt: existingReceipt,
    })
  }

  const accepted = {
    ...event,
    intake: {
      status: AUTOMATION_INTAKE_STATUS.ACCEPTED,
      reason: null,
    },
  }

  const recorded = recordAcceptedAutomationIntake(accepted, {
    idempotencyKey: accepted.idempotencyKey,
    companyId: accepted.companyId,
    sourceDomain: accepted.source.domain,
    sourceEventIdentity: accepted.sourceEventIdentity,
    status: AUTOMATION_INTAKE_STATUS.ACCEPTED,
    reason: null,
    automationEventId: accepted.id,
    receivedAt: accepted.receivedAt,
    schemaVersion: accepted.schemaVersion,
  })

  return resultShape({
    ok: true,
    status: AUTOMATION_INTAKE_STATUS.ACCEPTED,
    event: recorded.event,
    receipt: recorded.receipt,
  })
}

export {
  getAutomationEventById,
  listAcceptedAutomationEventsForCompany,
  listAutomationIntakeReceiptsForCompany,
  normalizeDomainEvent,
}
