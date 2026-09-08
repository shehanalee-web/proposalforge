/**
 * H16.4 — Record deferred action intents (no execution).
 *
 * Persistence side effect only. Does not emit domain events.
 */

import { INTEGRATION_CAPABILITIES, INTEGRATION_KIND } from '../types.js'
import {
  makeAutomationActionIntent,
  makeAutomationActionIntentIdempotencyKey,
} from './schema.js'
import { recordAutomationActionIntent } from './store.js'
import { AUTOMATION_ACTION_INTENT_STATUS } from './types.js'

const ENQUEUE_KIND_BY_ACTION = Object.freeze({
  enqueue_delivery_intent: INTEGRATION_KIND.DELIVERY,
  enqueue_outbound_webhook_intent: INTEGRATION_KIND.OUTBOUND_WEBHOOK,
  enqueue_crm_intent: INTEGRATION_KIND.CRM,
  enqueue_calendar_intent: INTEGRATION_KIND.CALENDAR,
  enqueue_messaging_intent: INTEGRATION_KIND.MESSAGING,
})

export function isDeferredEnqueueActionType(actionType) {
  return Object.prototype.hasOwnProperty.call(
    ENQUEUE_KIND_BY_ACTION,
    String(actionType ?? '').trim(),
  )
}

export function kindForDeferredEnqueueAction(actionType) {
  return ENQUEUE_KIND_BY_ACTION[String(actionType ?? '').trim()] || null
}

/**
 * Create or return an existing recorded intent. Never executes delivery.
 *
 * @param {object} input
 */
export function recordDeferredAutomationActionIntent(input = {}) {
  if (!INTEGRATION_CAPABILITIES.actionIntents) {
    return {
      ok: false,
      reason: 'intents_disabled',
      intent: null,
      duplicate: false,
    }
  }

  const actionType = String(input.actionType ?? '').trim()
  const kind = kindForDeferredEnqueueAction(actionType)
  if (!kind) {
    return {
      ok: false,
      reason: 'unsupported_action',
      intent: null,
      duplicate: false,
    }
  }

  const companyId = String(input.companyId ?? '').trim()
  const eventId = String(input.eventId ?? '').trim()
  const ruleId = String(input.ruleId ?? '').trim()
  const ruleVersion = Number.isInteger(input.ruleVersion) ? input.ruleVersion : 0
  const actionIndex = Number.isInteger(input.actionIndex) ? input.actionIndex : -1
  if (!companyId || !eventId || !ruleId || ruleVersion < 1 || actionIndex < 0) {
    return {
      ok: false,
      reason: 'missing_param',
      intent: null,
      duplicate: false,
    }
  }

  const idempotencyKey = makeAutomationActionIntentIdempotencyKey(
    eventId,
    ruleId,
    ruleVersion,
    actionIndex,
    actionType,
  )
  if (!idempotencyKey) {
    return {
      ok: false,
      reason: 'missing_param',
      intent: null,
      duplicate: false,
    }
  }

  try {
    const recorded = recordAutomationActionIntent(
      makeAutomationActionIntent({
        companyId,
        kind,
        actionType,
        status: AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
        idempotencyKey,
        eventId,
        eventIdempotencyKey: input.eventIdempotencyKey ?? null,
        ruleId,
        ruleVersion,
        ruleRunId: input.ruleRunId ?? null,
        actionIndex,
        payload: input.payload ?? {},
        correlation: input.correlation ?? {},
        providerId: input.providerId ?? null,
      }),
    )
    return {
      ok: true,
      reason: null,
      intent: recorded.intent,
      duplicate: recorded.duplicate,
    }
  } catch {
    return {
      ok: false,
      reason: 'action_failed',
      intent: null,
      duplicate: false,
    }
  }
}
