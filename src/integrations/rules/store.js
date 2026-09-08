/**
 * H16.3 — In-memory automation rules + rule-run ledger.
 *
 * Separate from automation-intake.json. Not a domain audit warehouse.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import {
  cloneAutomationRule,
  cloneAutomationRuleRun,
  makeAutomationRule,
  makeAutomationRuleRun,
} from './schema.js'

let rules = []
let runs = []
let rulesPersistHandler = null
let runsPersistHandler = null

function cloneRules(list) {
  return list.map((item) => {
    if (item?._invalid) {
      return Object.freeze({ ...item })
    }
    return cloneAutomationRule(item)
  })
}

function cloneRuns(list) {
  return list.map((item) => cloneAutomationRuleRun(item))
}

export function configureAutomationRulesStore({ persistRules, persistRuns } = {}) {
  rulesPersistHandler = typeof persistRules === 'function' ? persistRules : null
  runsPersistHandler = typeof persistRuns === 'function' ? persistRuns : null
}

function notifyRules() {
  if (!rulesPersistHandler) return
  rulesPersistHandler({ rules: allAutomationRules() })
}

function notifyRuns() {
  if (!runsPersistHandler) return
  runsPersistHandler({ runs: allAutomationRuleRuns() })
}

export function allAutomationRules() {
  return cloneRules(rules)
}

export function allAutomationRuleRuns() {
  return cloneRuns(runs)
}

export function replaceAutomationRules(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.rules)
      ? snapshot.rules
      : []
  rules = list.map((item) => {
    try {
      return makeAutomationRule(item)
    } catch {
      // Preserve corrupt rows so evaluation can skip them safely.
      return Object.freeze({
        id: String(item?.id ?? 'arule-invalid').trim() || 'arule-invalid',
        companyId: String(item?.companyId ?? '').trim(),
        name: String(item?.name ?? 'Invalid rule').trim() || 'Invalid rule',
        enabled: item?.enabled !== false,
        version:
          Number.isInteger(item?.version) && item.version > 0 ? item.version : 1,
        trigger: item?.trigger ?? { eventTypes: ['__invalid__'], sourceDomains: [] },
        conditions: item?.conditions ?? { operator: 'and', predicates: [] },
        actions: Array.isArray(item?.actions) ? item.actions : [],
        priority: Number.isInteger(item?.priority) ? item.priority : 0,
        stopAfterMatch: Boolean(item?.stopAfterMatch),
        runAsActorId: item?.runAsActorId ?? null,
        schemaVersion: 1,
        createdAt: item?.createdAt ?? new Date().toISOString(),
        updatedAt: item?.updatedAt ?? new Date().toISOString(),
        _invalid: true,
      })
    }
  })
  return { rules: allAutomationRules() }
}

export function replaceAutomationRuleRuns(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.runs)
      ? snapshot.runs
      : []
  runs = list.map((item) => makeAutomationRuleRun(item))
  return { runs: allAutomationRuleRuns() }
}

export function resetAutomationRulesStore(seed = {}) {
  replaceAutomationRules(seed.rules ?? seed ?? [])
  if (seed.runs) replaceAutomationRuleRuns(seed.runs)
  else if (!Array.isArray(seed) && seed && typeof seed === 'object' && !seed.rules) {
    /* rules-only reset */
  }
  return { rules: allAutomationRules(), runs: allAutomationRuleRuns() }
}

export function resetAutomationRuleRunsStore(seed = {}) {
  return replaceAutomationRuleRuns(seed)
}

export function serializeAutomationRules() {
  return Object.freeze({ rules: allAutomationRules() })
}

export function serializeAutomationRuleRuns() {
  return Object.freeze({ runs: allAutomationRuleRuns() })
}

export function findAutomationRuleById(ruleId) {
  const id = String(ruleId ?? '').trim()
  if (!id) return null
  const found = rules.find((item) => item.id === id)
  return found ? cloneAutomationRule(found) : null
}

export function findAutomationRuleRunByIdempotencyKey(key) {
  const idempotencyKey = String(key ?? '').trim()
  if (!idempotencyKey) return null
  const found = runs.find((item) => item.idempotencyKey === idempotencyKey)
  return found ? cloneAutomationRuleRun(found) : null
}

/**
 * @param {string} companyId
 * @param {string} ruleId
 */
export function getAutomationRuleForCompany(companyId, ruleId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationRule lookup requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const found = findAutomationRuleById(ruleId)
  if (!found) throw new NotFoundError('Automation rule not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return found
}

/**
 * @param {string} companyId
 */
export function listAutomationRulesForCompany(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationRule list requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return allAutomationRules()
    .filter((item) => item.companyId === company && !item._invalid)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority
      return String(left.id).localeCompare(String(right.id))
    })
}

/**
 * Enabled rules snapshot for evaluation (priority ASC, id ASC).
 * Returns shallow clones; engine re-validates with makeAutomationRule.
 *
 * @param {string} companyId
 */
export function listEnabledAutomationRulesForCompany(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationRule list requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return rules
    .filter((item) => item.companyId === company && item.enabled)
    .map((item) => Object.freeze({ ...item }))
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority
      return String(left.id).localeCompare(String(right.id))
    })
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 */
export function listAutomationRuleRunsForCompany(companyId, options = {}) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationRuleRun list requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100
  return allAutomationRuleRuns()
    .filter((item) => item.companyId === company)
    .sort((left, right) =>
      String(right.executedAt).localeCompare(String(left.executedAt)),
    )
    .slice(0, limit)
}

/**
 * @param {object} rule
 */
export function upsertAutomationRuleRecord(rule) {
  const next = makeAutomationRule(rule)
  const index = rules.findIndex((item) => item.id === next.id)
  if (index >= 0) {
    if (rules[index].companyId !== next.companyId) {
      throw new ForbiddenError('You cannot move a rule across companies.')
    }
    rules = rules.map((item, i) => (i === index ? next : item))
  } else {
    rules = [...rules, next]
  }
  notifyRules()
  return cloneAutomationRule(next)
}

/**
 * @param {string} companyId
 * @param {string} ruleId
 */
export function deleteAutomationRuleRecord(companyId, ruleId) {
  const existing = getAutomationRuleForCompany(companyId, ruleId)
  rules = rules.filter((item) => item.id !== existing.id)
  notifyRules()
  return existing
}

/**
 * Append a run when the execution key is new. Returns existing on duplicate.
 *
 * @param {object} run
 */
export function recordAutomationRuleRun(run) {
  const next = makeAutomationRuleRun(run)
  const existing = findAutomationRuleRunByIdempotencyKey(next.idempotencyKey)
  if (existing) {
    return { run: existing, duplicate: true }
  }
  runs = [...runs, next]
  notifyRuns()
  return { run: cloneAutomationRuleRun(next), duplicate: false }
}
