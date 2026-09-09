/**
 * H16.4 — Automation Action Intent contracts.
 *
 * Durable vendor-neutral intents for future delivery/CRM/calendar/messaging/
 * outbound webhook execution. Not an outbox, worker, or executor.
 */

export const AUTOMATION_ACTION_INTENT_SCHEMA_VERSION = 1

export const AUTOMATION_ACTION_INTENT_STATUS = Object.freeze({
  RECORDED: 'recorded',
  CANCELLED: 'cancelled',
})

export const AUTOMATION_ACTION_INTENT_STATUSES = Object.freeze(
  Object.values(AUTOMATION_ACTION_INTENT_STATUS),
)

export const AUTOMATION_ACTION_INTENT_LIMITS = Object.freeze({
  MAX_PAYLOAD_KEYS: 16,
  MAX_STRING: 200,
  MAX_ID: 128,
  MAX_CANCEL_REASON: 200,
})

export const AUTOMATION_ACTION_INTENT_CANCEL_REASON = Object.freeze({
  STUDIO_CANCELLED: 'studio_cancelled',
  SUPERSEDED: 'superseded',
})
