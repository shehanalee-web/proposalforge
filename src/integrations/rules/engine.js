/**
 * H16.3 — Synchronous Automation Rules Engine.
 *
 * Evaluates company-scoped rules against accepted AutomationEvents.
 * Nested intake caused by rule actions does not re-enter evaluation (depth > 0).
 */

import { INTEGRATION_CAPABILITIES } from '../types.js'
import { evaluateAutomationConditions } from './conditions.js'
import { executeAutomationAction } from './actions.js'
import {
  makeAutomationRule,
  makeAutomationRuleExecutionKey,
  makeAutomationRuleRun,
} from './schema.js'
import {
  findAutomationRuleRunByIdempotencyKey,
  listEnabledAutomationRulesForCompany,
  recordAutomationRuleRun,
} from './store.js'
import {
  AUTOMATION_RULE_FAILURE_REASON,
  AUTOMATION_RULE_LIMITS,
  AUTOMATION_RULE_RUN_STATUS,
} from './types.js'
import { createRecordId } from '../../models/ids.js'

/** Sync evaluation depth — nested domain fan-out must not re-enter rules. */
let evaluationDepth = 0

export function getAutomationRuleEvaluationDepth() {
  return evaluationDepth
}

export function isAutomationRuleEvaluationActive() {
  return evaluationDepth > 0
}

function triggerMatches(rule, event) {
  const types = rule.trigger?.eventTypes ?? []
  if (!types.includes(event.type)) return false
  const domains = rule.trigger?.sourceDomains ?? []
  if (domains.length > 0 && !domains.includes(event.source?.domain)) {
    return false
  }
  return true
}

function baseRunFields(rule, event, depth) {
  return {
    companyId: rule.companyId,
    ruleId: rule.id,
    ruleVersion: rule.version,
    ruleName: rule.name,
    eventId: event.id,
    eventType: event.type,
    eventIdempotencyKey: event.idempotencyKey,
    depth,
    idempotencyKey: makeAutomationRuleExecutionKey(
      event.id,
      rule.id,
      rule.version,
    ),
  }
}

function recordRun(fields) {
  return recordAutomationRuleRun(makeAutomationRuleRun(fields))
}

/**
 * Evaluate enabled company rules for one accepted AutomationEvent.
 *
 * @param {object} event
 * @param {{ depth?: number }} [context]
 * @returns {object[]} run records produced
 */
export function evaluateAutomationRulesForEvent(event, context = {}) {
  if (!INTEGRATION_CAPABILITIES.automationRules) {
    return []
  }
  if (!event || typeof event !== 'object') return []
  const companyId = String(event.companyId ?? '').trim()
  if (!companyId) return []

  const incomingDepth =
    Number.isInteger(context.depth) && context.depth >= 0
      ? context.depth
      : evaluationDepth

  // Nested events from rule actions: ingest may record them, but do not evaluate.
  if (incomingDepth > 0 || evaluationDepth > 0) {
    return []
  }

  evaluationDepth += 1
  const produced = []

  try {
    let snapshot
    try {
      snapshot = listEnabledAutomationRulesForCompany(companyId)
    } catch {
      return produced
    }

    let matchedCount = 0
    let actionCount = 0
    let stop = false

    for (const rawRule of snapshot) {
      if (stop) break

      let rule
      try {
        rule = makeAutomationRule(rawRule)
      } catch {
        // Malformed persisted rule — skip with durable record when identity known.
        if (rawRule?.id && event.id) {
          const key = makeAutomationRuleExecutionKey(
            event.id,
            rawRule.id,
            Number.isInteger(rawRule.version) && rawRule.version > 0
              ? rawRule.version
              : 1,
          )
          if (key && !findAutomationRuleRunByIdempotencyKey(key)) {
            const recorded = recordRun({
              companyId,
              ruleId: rawRule.id,
              ruleVersion:
                Number.isInteger(rawRule.version) && rawRule.version > 0
                  ? rawRule.version
                  : 1,
              ruleName: String(rawRule.name ?? '').trim() || null,
              eventId: event.id,
              eventType: event.type,
              eventIdempotencyKey: event.idempotencyKey,
              actionType: null,
              status: AUTOMATION_RULE_RUN_STATUS.SKIPPED,
              failureReason: AUTOMATION_RULE_FAILURE_REASON.MALFORMED_RULE,
              idempotencyKey: key,
              depth: evaluationDepth,
            })
            produced.push(recorded.run)
          }
        }
        continue
      }

      if (rule.companyId !== companyId) {
        continue
      }

      if (!triggerMatches(rule, event)) {
        continue
      }

      if (matchedCount >= AUTOMATION_RULE_LIMITS.MAX_MATCHED_RULES) {
        const key = makeAutomationRuleExecutionKey(
          event.id,
          rule.id,
          rule.version,
        )
        if (key && !findAutomationRuleRunByIdempotencyKey(key)) {
          const recorded = recordRun({
            ...baseRunFields(rule, event, evaluationDepth),
            actionType: null,
            status: AUTOMATION_RULE_RUN_STATUS.SKIPPED,
            failureReason: AUTOMATION_RULE_FAILURE_REASON.CAPPED,
          })
          produced.push(recorded.run)
        }
        continue
      }

      const executionKey = makeAutomationRuleExecutionKey(
        event.id,
        rule.id,
        rule.version,
      )
      const existing = findAutomationRuleRunByIdempotencyKey(executionKey)
      if (existing) {
        produced.push(existing)
        matchedCount += 1
        if (rule.stopAfterMatch) stop = true
        continue
      }

      const conditionEval = evaluateAutomationConditions(event, rule.conditions)
      if (conditionEval.skipped) {
        const recorded = recordRun({
          ...baseRunFields(rule, event, evaluationDepth),
          actionType: null,
          status: AUTOMATION_RULE_RUN_STATUS.SKIPPED,
          failureReason:
            conditionEval.reason ||
            AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
          result: {
            predicateCount: conditionEval.predicates.length,
          },
        })
        produced.push(recorded.run)
        matchedCount += 1
        if (rule.stopAfterMatch) stop = true
        continue
      }
      if (!conditionEval.ok) {
        // Trigger matched but conditions not met — not an execution.
        continue
      }

      matchedCount += 1
      const actionResults = []
      let failed = false
      let failureReason = null
      let primaryActionType = null
      const ruleRunId = createRecordId('arun')

      for (let actionIndex = 0; actionIndex < rule.actions.length; actionIndex += 1) {
        const action = rule.actions[actionIndex]
        if (actionCount >= AUTOMATION_RULE_LIMITS.MAX_TOTAL_ACTIONS) {
          actionResults.push(
            Object.freeze({
              ok: false,
              actionType: action.type,
              failureReason: AUTOMATION_RULE_FAILURE_REASON.CAPPED,
            }),
          )
          failed = true
          failureReason = AUTOMATION_RULE_FAILURE_REASON.CAPPED
          break
        }
        actionCount += 1
        if (!primaryActionType) primaryActionType = action.type
        const outcome = executeAutomationAction(rule, event, action, {
          actionIndex,
          ruleRunId,
        })
        actionResults.push(outcome)
        if (!outcome.ok) {
          failed = true
          failureReason =
            outcome.failureReason || AUTOMATION_RULE_FAILURE_REASON.ACTION_FAILED
          // Continue remaining actions on the same rule (no retry); record failure.
        }
      }

      const recorded = recordRun({
        ...baseRunFields(rule, event, evaluationDepth),
        id: ruleRunId,
        actionType: primaryActionType,
        status: failed
          ? AUTOMATION_RULE_RUN_STATUS.FAILED
          : AUTOMATION_RULE_RUN_STATUS.EXECUTED,
        failureReason: failed ? failureReason : null,
        result: Object.freeze({
          actionCount: actionResults.length,
          okCount: actionResults.filter((item) => item.ok).length,
          followupId: actionResults.find((item) => item.result?.id)?.result?.id ?? null,
          notificationId:
            actionResults.find((item) => item.result?.notificationId)?.result
              ?.notificationId ?? null,
          intentId:
            actionResults.find((item) => item.result?.intentId)?.result
              ?.intentId ?? null,
        }),
      })
      produced.push(recorded.run)

      if (rule.stopAfterMatch) stop = true
    }

    return produced
  } finally {
    evaluationDepth = Math.max(0, evaluationDepth - 1)
  }
}

/**
 * Hook for H16.2 accepted intake. No-op when rules disabled or nested.
 *
 * @param {object} event
 */
export function onAutomationEventAccepted(event) {
  if (!INTEGRATION_CAPABILITIES.automationRules) return []
  if (evaluationDepth > 0) return []
  return evaluateAutomationRulesForEvent(event, { depth: evaluationDepth })
}
