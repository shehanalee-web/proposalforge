/**
 * H16.3 — AutomationRule + AutomationRuleRun schema builders.
 *
 * Thin, inspectable, company-scoped. No scripts, cron, or vendor config.
 */

import { createRecordId } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import {
  AUTOMATION_RULE_ACTION_TYPES,
  AUTOMATION_RULE_CONDITION_OPS,
  AUTOMATION_RULE_EVENT_PATHS,
  AUTOMATION_RULE_FAILURE_REASON,
  AUTOMATION_RULE_LIMITS,
  AUTOMATION_RULE_RUN_STATUS,
  AUTOMATION_RULE_RUN_STATUSES,
  AUTOMATION_RULE_SCHEMA_VERSION,
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
  return id.slice(0, AUTOMATION_RULE_LIMITS.MAX_ID)
}

function asRequiredCompanyId(value) {
  const companyId = asOptionalId(value)
  if (!companyId) {
    throw new ValidationError('AutomationRule requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return companyId
}

function sanitizeScalar(value) {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value
  }
  if (typeof value === 'string') {
    return value.trim().slice(0, AUTOMATION_RULE_LIMITS.MAX_STRING)
  }
  return undefined
}

function isPayloadPath(path) {
  return /^payload\.[A-Za-z0-9_]{1,64}$/.test(path)
}

export function isAllowedAutomationRuleEventPath(path) {
  const field = asString(path).trim()
  if (!field) return false
  if (AUTOMATION_RULE_EVENT_PATHS.includes(field)) return true
  return isPayloadPath(field)
}

/**
 * Read a whitelisted path from an AutomationEvent. Returns undefined if missing.
 *
 * @param {object} event
 * @param {string} path
 */
export function readAutomationEventPath(event, path) {
  const field = asString(path).trim()
  if (!isAllowedAutomationRuleEventPath(field)) return undefined
  if (!event || typeof event !== 'object') return undefined
  if (field === 'type') return event.type ?? null
  if (field === 'source.domain') return event.source?.domain ?? null
  if (field === 'source.entityType') return event.source?.entityType ?? null
  if (field === 'source.entityId') return event.source?.entityId ?? null
  if (field === 'correlation.proposalId') return event.correlation?.proposalId ?? null
  if (field === 'correlation.sessionId') return event.correlation?.sessionId ?? null
  if (field === 'correlation.closeId') return event.correlation?.closeId ?? null
  if (field === 'correlation.followupId') {
    return event.correlation?.followupId ?? null
  }
  if (isPayloadPath(field)) {
    const key = field.slice('payload.'.length)
    if (!event.payload || typeof event.payload !== 'object') return null
    return Object.prototype.hasOwnProperty.call(event.payload, key)
      ? event.payload[key]
      : null
  }
  return undefined
}

function normalizePredicate(input = {}) {
  const path = asString(input.path).trim()
  const op = asString(input.op).trim()
  if (!path || !isAllowedAutomationRuleEventPath(path)) {
    throw new ValidationError('Unsupported condition path.', [
      { field: 'conditions.predicates.path', message: 'path is not allowed.' },
    ])
  }
  if (!AUTOMATION_RULE_CONDITION_OPS.includes(op)) {
    throw new ValidationError('Unsupported condition operator.', [
      { field: 'conditions.predicates.op', message: 'op is not allowed.' },
    ])
  }
  let value = null
  if (op === 'in') {
    if (!Array.isArray(input.value)) {
      throw new ValidationError('Condition "in" requires an array value.', [
        { field: 'conditions.predicates.value', message: 'value must be an array.' },
      ])
    }
    value = Object.freeze(
      input.value
        .map((item) => sanitizeScalar(item))
        .filter((item) => item !== undefined)
        .slice(0, 16),
    )
  } else if (op === 'eq' || op === 'neq') {
    const next = sanitizeScalar(input.value)
    if (next === undefined) {
      throw new ValidationError('Condition value is invalid.', [
        { field: 'conditions.predicates.value', message: 'value must be a scalar.' },
      ])
    }
    value = next
  }
  return Object.freeze({ path, op, value })
}

function normalizeConditions(input = {}) {
  const operator = asString(input.operator || 'and').trim() || 'and'
  if (operator !== 'and') {
    throw new ValidationError('Only AND conditions are supported.', [
      { field: 'conditions.operator', message: 'operator must be "and".' },
    ])
  }
  const raw = Array.isArray(input.predicates) ? input.predicates : []
  if (raw.length > AUTOMATION_RULE_LIMITS.MAX_PREDICATES) {
    throw new ValidationError('Too many condition predicates.', [
      {
        field: 'conditions.predicates',
        message: `At most ${AUTOMATION_RULE_LIMITS.MAX_PREDICATES} predicates.`,
      },
    ])
  }
  return Object.freeze({
    operator: 'and',
    predicates: Object.freeze(raw.map((item) => normalizePredicate(item))),
  })
}

function normalizeActionParamValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'fromEvent')) {
      const path = asString(value.fromEvent).trim()
      if (!isAllowedAutomationRuleEventPath(path)) {
        throw new ValidationError('Unsupported fromEvent path.', [
          { field: 'actions.params.fromEvent', message: 'path is not allowed.' },
        ])
      }
      return Object.freeze({ fromEvent: path })
    }
  }
  const scalar = sanitizeScalar(value)
  if (scalar === undefined) {
    throw new ValidationError('Action param must be a scalar or fromEvent ref.', [
      { field: 'actions.params', message: 'invalid param value.' },
    ])
  }
  return scalar
}

function normalizeActionParams(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({})
  }
  const next = {}
  let count = 0
  for (const [key, value] of Object.entries(input)) {
    if (count >= AUTOMATION_RULE_LIMITS.MAX_PARAM_KEYS) break
    const field = asString(key).trim()
    if (!field || !/^[A-Za-z0-9_]{1,64}$/.test(field)) continue
    next[field] = normalizeActionParamValue(value)
    count += 1
  }
  return Object.freeze(next)
}

function normalizeAction(input = {}) {
  const type = asString(input.type).trim()
  if (!AUTOMATION_RULE_ACTION_TYPES.includes(type)) {
    throw new ValidationError('Unsupported automation action type.', [
      { field: 'actions.type', message: 'action type is not allowed.' },
    ])
  }
  return Object.freeze({
    type,
    params: normalizeActionParams(input.params),
  })
}

function normalizeTrigger(input = {}) {
  const eventTypes = Array.isArray(input.eventTypes)
    ? input.eventTypes
        .map((item) => asString(item).trim())
        .filter(Boolean)
        .slice(0, 32)
    : []
  if (eventTypes.length === 0) {
    throw new ValidationError('Rule trigger requires eventTypes.', [
      { field: 'trigger.eventTypes', message: 'At least one event type is required.' },
    ])
  }
  const sourceDomains = Array.isArray(input.sourceDomains)
    ? Object.freeze(
        input.sourceDomains
          .map((item) => asString(item).trim())
          .filter(Boolean)
          .slice(0, 16),
      )
    : Object.freeze([])
  return Object.freeze({
    eventTypes: Object.freeze(eventTypes),
    sourceDomains,
  })
}

function materialSignature(rule) {
  return JSON.stringify({
    trigger: rule.trigger,
    conditions: rule.conditions,
    actions: rule.actions,
    priority: rule.priority,
    stopAfterMatch: rule.stopAfterMatch,
    runAsActorId: rule.runAsActorId,
  })
}

/**
 * @param {object} [input]
 */
export function makeAutomationRule(input = {}) {
  const companyId = asRequiredCompanyId(input.companyId)
  const name =
    asString(input.name).trim().slice(0, AUTOMATION_RULE_LIMITS.MAX_NAME) ||
    'Automation rule'
  const trigger = normalizeTrigger(input.trigger ?? {})
  const conditions = normalizeConditions(input.conditions ?? { predicates: [] })
  const rawActions = Array.isArray(input.actions) ? input.actions : []
  if (rawActions.length === 0) {
    throw new ValidationError('Rule requires at least one action.', [
      { field: 'actions', message: 'At least one action is required.' },
    ])
  }
  if (rawActions.length > AUTOMATION_RULE_LIMITS.MAX_ACTIONS) {
    throw new ValidationError('Too many actions on rule.', [
      {
        field: 'actions',
        message: `At most ${AUTOMATION_RULE_LIMITS.MAX_ACTIONS} actions.`,
      },
    ])
  }
  const actions = Object.freeze(rawActions.map((item) => normalizeAction(item)))
  const priority =
    Number.isInteger(input.priority) && Number.isFinite(input.priority)
      ? input.priority
      : 100
  const createdAt = asIso(input.createdAt, nowIso())
  const updatedAt = asIso(input.updatedAt, createdAt)
  const version =
    Number.isInteger(input.version) && input.version > 0 ? input.version : 1

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('arule'),
    companyId,
    name,
    enabled: input.enabled !== false,
    version,
    trigger,
    conditions,
    actions,
    priority,
    stopAfterMatch: Boolean(input.stopAfterMatch),
    runAsActorId: asOptionalId(input.runAsActorId),
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : AUTOMATION_RULE_SCHEMA_VERSION,
    createdAt,
    updatedAt,
  })
}

export function cloneAutomationRule(rule) {
  return makeAutomationRule(rule ?? {})
}

/**
 * Build next rule version when material behavior fields change.
 *
 * @param {object | null} previous
 * @param {object} nextInput
 */
export function nextAutomationRuleVersion(previous, nextInput = {}) {
  const draft = makeAutomationRule({
    ...(previous ?? {}),
    ...nextInput,
    id: previous?.id || nextInput.id,
    companyId: nextInput.companyId ?? previous?.companyId,
    version: previous?.version || 1,
    createdAt: previous?.createdAt,
  })
  if (!previous) return 1
  const prev = makeAutomationRule(previous)
  if (materialSignature(prev) === materialSignature(draft)) {
    return prev.version
  }
  return prev.version + 1
}

export function presentStudioAutomationRule(rule) {
  if (!rule) return null
  const next = makeAutomationRule(rule)
  return Object.freeze({
    id: next.id,
    companyId: next.companyId,
    name: next.name,
    enabled: next.enabled,
    version: next.version,
    trigger: Object.freeze({
      eventTypes: [...next.trigger.eventTypes],
      sourceDomains: [...next.trigger.sourceDomains],
    }),
    conditions: Object.freeze({
      operator: next.conditions.operator,
      predicates: next.conditions.predicates.map((item) =>
        Object.freeze({ ...item, value: item.value }),
      ),
    }),
    actions: next.actions.map((item) =>
      Object.freeze({ type: item.type, params: { ...item.params } }),
    ),
    priority: next.priority,
    stopAfterMatch: next.stopAfterMatch,
    runAsActorId: next.runAsActorId,
    schemaVersion: next.schemaVersion,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  })
}

/**
 * Deterministic execution key: event.id|rule.id|rule.version
 *
 * @param {string} eventId
 * @param {string} ruleId
 * @param {number} ruleVersion
 */
export function makeAutomationRuleExecutionKey(eventId, ruleId, ruleVersion) {
  const event = asString(eventId).trim()
  const rule = asString(ruleId).trim()
  const version = Number.isInteger(ruleVersion) ? ruleVersion : 0
  if (!event || !rule || version < 1) return null
  return `${event}|${rule}|${version}`
}

/**
 * @param {object} [input]
 */
export function makeAutomationRuleRun(input = {}) {
  const companyId = asRequiredCompanyId(input.companyId)
  const ruleId = asOptionalId(input.ruleId)
  const eventId = asOptionalId(input.eventId)
  if (!ruleId || !eventId) {
    throw new ValidationError('AutomationRuleRun requires ruleId and eventId.', [
      { field: 'ruleId', message: 'ruleId and eventId are required.' },
    ])
  }
  const ruleVersion =
    Number.isInteger(input.ruleVersion) && input.ruleVersion > 0
      ? input.ruleVersion
      : 1
  const idempotencyKey =
    asString(input.idempotencyKey).trim() ||
    makeAutomationRuleExecutionKey(eventId, ruleId, ruleVersion)
  if (!idempotencyKey) {
    throw new ValidationError('AutomationRuleRun requires an execution key.', [
      { field: 'idempotencyKey', message: 'execution key is incomplete.' },
    ])
  }
  const status = AUTOMATION_RULE_RUN_STATUSES.includes(input.status)
    ? input.status
    : AUTOMATION_RULE_RUN_STATUS.SKIPPED

  let result = null
  if (input.result != null && typeof input.result === 'object' && !Array.isArray(input.result)) {
    const sanitized = {}
    let count = 0
    for (const [key, value] of Object.entries(input.result)) {
      if (count >= 16) break
      const field = asString(key).trim()
      if (!field) continue
      if (typeof value === 'string') {
        sanitized[field] = value.slice(0, AUTOMATION_RULE_LIMITS.MAX_STRING)
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[field] = value
      } else if (value == null) {
        sanitized[field] = null
      } else if (Array.isArray(value)) {
        sanitized[field] = value
          .map((item) => sanitizeScalar(item))
          .filter((item) => item !== undefined)
          .slice(0, 8)
      }
      count += 1
    }
    result = Object.freeze(sanitized)
  }

  return Object.freeze({
    id: asOptionalId(input.id) || createRecordId('arun'),
    companyId,
    ruleId,
    ruleVersion,
    ruleName: asString(input.ruleName)
      .trim()
      .slice(0, AUTOMATION_RULE_LIMITS.MAX_NAME) || null,
    eventId,
    eventType: asString(input.eventType).trim().slice(0, AUTOMATION_RULE_LIMITS.MAX_STRING) || null,
    eventIdempotencyKey: asString(input.eventIdempotencyKey).trim() || null,
    actionType: asString(input.actionType).trim() || null,
    status,
    result,
    failureReason: asOptionalId(input.failureReason),
    idempotencyKey,
    depth:
      Number.isInteger(input.depth) && input.depth >= 0 ? input.depth : 0,
    executedAt: asIso(input.executedAt, nowIso()),
  })
}

export function cloneAutomationRuleRun(run) {
  return makeAutomationRuleRun(run ?? {})
}

export function presentStudioAutomationRuleRun(run) {
  if (!run) return null
  return makeAutomationRuleRun(run)
}

export {
  AUTOMATION_RULE_FAILURE_REASON,
  AUTOMATION_RULE_RUN_STATUS,
}
