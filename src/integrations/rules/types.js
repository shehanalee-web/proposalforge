/**
 * H16.3 — Automation Rules Engine contracts.
 *
 * Company-scoped rules evaluate accepted AutomationEvents and call domain APIs.
 * No workers, outbox, delivery, vendors, or Forge ownership.
 */

export const AUTOMATION_RULE_SCHEMA_VERSION = 1

export const AUTOMATION_RULE_ACTION_TYPE = Object.freeze({
  CREATE_FOLLOWUP: 'create_followup',
  COMPLETE_FOLLOWUP: 'complete_followup',
  DISMISS_FOLLOWUP: 'dismiss_followup',
  ASSIGN_FOLLOWUP: 'assign_followup',
  SCHEDULE_FOLLOWUP: 'schedule_followup',
  NOTIFY_STUDIO: 'notify_studio',
  ENQUEUE_DELIVERY_INTENT: 'enqueue_delivery_intent',
  ENQUEUE_OUTBOUND_WEBHOOK_INTENT: 'enqueue_outbound_webhook_intent',
  ENQUEUE_CRM_INTENT: 'enqueue_crm_intent',
  ENQUEUE_CALENDAR_INTENT: 'enqueue_calendar_intent',
  ENQUEUE_MESSAGING_INTENT: 'enqueue_messaging_intent',
})

export const AUTOMATION_RULE_ACTION_TYPES = Object.freeze(
  Object.values(AUTOMATION_RULE_ACTION_TYPE),
)

export const AUTOMATION_RULE_CONDITION_OP = Object.freeze({
  EQ: 'eq',
  NEQ: 'neq',
  IN: 'in',
  EXISTS: 'exists',
  NOT_EXISTS: 'not_exists',
})

export const AUTOMATION_RULE_CONDITION_OPS = Object.freeze(
  Object.values(AUTOMATION_RULE_CONDITION_OP),
)

/** Whitelisted event paths for conditions and fromEvent params. */
export const AUTOMATION_RULE_EVENT_PATHS = Object.freeze([
  'type',
  'source.domain',
  'source.entityType',
  'source.entityId',
  'correlation.proposalId',
  'correlation.sessionId',
  'correlation.closeId',
  'correlation.followupId',
])

export const AUTOMATION_RULE_RUN_STATUS = Object.freeze({
  MATCHED: 'matched',
  EXECUTED: 'executed',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
})

export const AUTOMATION_RULE_RUN_STATUSES = Object.freeze(
  Object.values(AUTOMATION_RULE_RUN_STATUS),
)

export const AUTOMATION_RULE_FAILURE_REASON = Object.freeze({
  RULES_DISABLED: 'rules_disabled',
  MALFORMED_RULE: 'malformed_rule',
  UNSUPPORTED_CONDITION: 'unsupported_condition',
  CONDITIONS_NOT_MET: 'conditions_not_met',
  UNSUPPORTED_ACTION: 'unsupported_action',
  ACTION_FAILED: 'action_failed',
  DUPLICATE_EXECUTION: 'duplicate_execution',
  DISABLED_RULE: 'disabled_rule',
  COMPANY_MISMATCH: 'company_mismatch',
  COMPANY_REQUIRED: 'company_required',
  CAPPED: 'capped',
  NESTED_EVALUATION: 'nested_evaluation',
  MISSING_ACTOR: 'missing_actor',
  MISSING_PARAM: 'missing_param',
  INVALID_PARAM: 'invalid_param',
  INTENTS_DISABLED: 'intents_disabled',
})

/** Safety caps for a single event evaluation. */
export const AUTOMATION_RULE_LIMITS = Object.freeze({
  MAX_PREDICATES: 8,
  MAX_ACTIONS: 3,
  MAX_MATCHED_RULES: 20,
  MAX_TOTAL_ACTIONS: 60,
  MAX_NAME: 120,
  MAX_PARAM_KEYS: 12,
  MAX_STRING: 200,
  MAX_ID: 128,
})
