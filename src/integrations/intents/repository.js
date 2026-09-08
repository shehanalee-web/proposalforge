/**
 * H16.4 — Thin studio repository for action intents.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { presentStudioAutomationActionIntent } from './schema.js'
import {
  cancelAutomationActionIntent,
  getAutomationActionIntentForCompany,
  listAutomationActionIntentsForCompany,
} from './store.js'

function assertIntentsEnabled() {
  if (!INTEGRATION_CAPABILITIES.actionIntents) {
    throw new ForbiddenError('Automation action intents are not enabled.')
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
 * @param {{ limit?: number, status?: string }} [options]
 */
export function listStudioAutomationActionIntents(companyId, options = {}) {
  assertIntentsEnabled()
  const scoped = assertCompany(companyId)
  return listAutomationActionIntentsForCompany(scoped, options).map(
    presentStudioAutomationActionIntent,
  )
}

/**
 * @param {string} companyId
 * @param {string} intentId
 */
export function getStudioAutomationActionIntent(companyId, intentId) {
  assertIntentsEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioAutomationActionIntent(
    getAutomationActionIntentForCompany(scoped, intentId),
  )
}

/**
 * @param {object} input
 */
export function cancelStudioAutomationActionIntent(input = {}) {
  assertIntentsEnabled()
  const scoped = assertCompany(input.companyId)
  const result = cancelAutomationActionIntent({
    companyId: scoped,
    intentId: input.intentId,
    reason: input.reason,
    now: input.now,
  })
  return presentStudioAutomationActionIntent(result.intent)
}
