/**
 * H16.3 — Closed, deterministic condition evaluation.
 *
 * AND-only predicates over whitelisted AutomationEvent paths.
 * Unsupported predicates return inspectable skip results (engine skips the rule).
 */

import {
  isAllowedAutomationRuleEventPath,
  readAutomationEventPath,
} from './schema.js'
import {
  AUTOMATION_RULE_CONDITION_OPS,
  AUTOMATION_RULE_FAILURE_REASON,
  AUTOMATION_RULE_LIMITS,
} from './types.js'

function predicateResult({
  ok,
  path,
  op,
  actual = null,
  expected = null,
  reason = null,
}) {
  return Object.freeze({
    ok: Boolean(ok),
    path: path || null,
    op: op || null,
    actual,
    expected,
    reason,
  })
}

/**
 * Evaluate a single predicate. Never throws for bad input — returns ok:false.
 *
 * @param {object} event
 * @param {object} predicate
 */
export function evaluateAutomationPredicate(event, predicate = {}) {
  const path = String(predicate?.path ?? '').trim()
  const op = String(predicate?.op ?? '').trim()

  if (!path || !isAllowedAutomationRuleEventPath(path)) {
    return predicateResult({
      ok: false,
      path,
      op,
      reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
    })
  }
  if (!AUTOMATION_RULE_CONDITION_OPS.includes(op)) {
    return predicateResult({
      ok: false,
      path,
      op,
      reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
    })
  }

  const actual = readAutomationEventPath(event, path)
  const exists = actual !== null && actual !== undefined && actual !== ''

  if (op === 'exists') {
    return predicateResult({ ok: exists, path, op, actual })
  }
  if (op === 'not_exists') {
    return predicateResult({ ok: !exists, path, op, actual })
  }
  if (op === 'eq') {
    return predicateResult({
      ok: actual === predicate.value,
      path,
      op,
      actual,
      expected: predicate.value ?? null,
    })
  }
  if (op === 'neq') {
    return predicateResult({
      ok: actual !== predicate.value,
      path,
      op,
      actual,
      expected: predicate.value ?? null,
    })
  }
  if (op === 'in') {
    const list = Array.isArray(predicate.value) ? predicate.value : null
    if (!list) {
      return predicateResult({
        ok: false,
        path,
        op,
        actual,
        reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
      })
    }
    return predicateResult({
      ok: list.includes(actual),
      path,
      op,
      actual,
      expected: list,
    })
  }

  return predicateResult({
    ok: false,
    path,
    op,
    reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
  })
}

/**
 * Evaluate AND conditions. Returns inspectable aggregate.
 *
 * @param {object} event
 * @param {object} conditions
 */
export function evaluateAutomationConditions(event, conditions = {}) {
  const operator = String(conditions?.operator ?? 'and').trim() || 'and'
  if (operator !== 'and') {
    return Object.freeze({
      ok: false,
      skipped: true,
      reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
      predicates: Object.freeze([]),
    })
  }

  const raw = Array.isArray(conditions?.predicates) ? conditions.predicates : []
  if (raw.length > AUTOMATION_RULE_LIMITS.MAX_PREDICATES) {
    return Object.freeze({
      ok: false,
      skipped: true,
      reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
      predicates: Object.freeze([]),
    })
  }

  const results = raw.map((predicate) =>
    evaluateAutomationPredicate(event, predicate),
  )
  const unsupported = results.find(
    (item) => item.reason === AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
  )
  if (unsupported) {
    return Object.freeze({
      ok: false,
      skipped: true,
      reason: AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
      predicates: Object.freeze(results),
    })
  }

  const allOk = results.every((item) => item.ok)
  return Object.freeze({
    ok: allOk,
    skipped: false,
    reason: allOk ? null : AUTOMATION_RULE_FAILURE_REASON.CONDITIONS_NOT_MET,
    predicates: Object.freeze(results),
  })
}
