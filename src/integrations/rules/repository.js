/**
 * H16.3 — Thin studio repository for automation rules.
 *
 * CRUD only. No builder UI. Company-scoped; never cross-company.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  makeAutomationRule,
  nextAutomationRuleVersion,
  presentStudioAutomationRule,
  presentStudioAutomationRuleRun,
} from './schema.js'
import {
  deleteAutomationRuleRecord,
  getAutomationRuleForCompany,
  listAutomationRuleRunsForCompany,
  listAutomationRulesForCompany,
  upsertAutomationRuleRecord,
} from './store.js'

function assertRulesEnabled() {
  if (!INTEGRATION_CAPABILITIES.automationRules) {
    throw new ForbiddenError('Automation rules are not enabled.')
  }
}

function assertCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return String(companyId).trim()
}

/**
 * @param {string} companyId
 */
export function listStudioAutomationRules(companyId) {
  assertRulesEnabled()
  const scoped = assertCompany(companyId)
  return listAutomationRulesForCompany(scoped).map(presentStudioAutomationRule)
}

/**
 * @param {string} companyId
 * @param {string} ruleId
 */
export function getStudioAutomationRule(companyId, ruleId) {
  assertRulesEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioAutomationRule(getAutomationRuleForCompany(scoped, ruleId))
}

/**
 * Create or update a company rule. Version bumps on material changes.
 *
 * @param {object} input
 */
export function upsertStudioAutomationRule(input = {}) {
  assertRulesEnabled()
  const companyId = assertCompany(input.companyId)
  const existingId = String(input.id ?? '').trim()
  let previous = null
  if (existingId) {
    previous = getAutomationRuleForCompany(companyId, existingId)
  }

  const version = nextAutomationRuleVersion(previous, {
    ...input,
    companyId,
    id: previous?.id || input.id,
  })

  const now = new Date().toISOString()
  const next = makeAutomationRule({
    ...input,
    id: previous?.id || input.id,
    companyId,
    version,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  })

  if (previous && previous.companyId !== next.companyId) {
    throw new ForbiddenError('You cannot move a rule across companies.')
  }

  return presentStudioAutomationRule(upsertAutomationRuleRecord(next))
}

/**
 * Patch enable/disable or shallow fields without forcing a full rewrite.
 *
 * @param {object} input
 */
export function patchStudioAutomationRule(input = {}) {
  assertRulesEnabled()
  const companyId = assertCompany(input.companyId)
  const existing = getAutomationRuleForCompany(companyId, input.id)
  return upsertStudioAutomationRule({
    ...existing,
    ...input,
    companyId,
    id: existing.id,
    trigger: input.trigger ?? existing.trigger,
    conditions: input.conditions ?? existing.conditions,
    actions: input.actions ?? existing.actions,
  })
}

/**
 * @param {string} companyId
 * @param {string} ruleId
 */
export function deleteStudioAutomationRule(companyId, ruleId) {
  assertRulesEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioAutomationRule(deleteAutomationRuleRecord(scoped, ruleId))
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 */
export function listStudioAutomationRuleRuns(companyId, options = {}) {
  assertRulesEnabled()
  const scoped = assertCompany(companyId)
  return listAutomationRuleRunsForCompany(scoped, options).map(
    presentStudioAutomationRuleRun,
  )
}
