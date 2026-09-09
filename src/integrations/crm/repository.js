/**
 * H16.6 — Thin studio repository for CRM connections and outcomes.
 *
 * Execution is internal/studio only — there is no client-facing CRM mutation.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  presentStudioCrmConnection,
  presentStudioCrmExecutionOutcome,
} from './schema.js'
import {
  deleteCrmConnectionForCompany,
  getCrmConnectionForCompany,
  listCrmConnectionsForCompany,
  setCrmConnectionEnabled,
  upsertCrmConnectionForCompany,
} from './connections.js'
import { getCrmOutcomeForCompany, listCrmOutcomesForCompany } from './outcomes.js'
import { executeCrmIntent, isCrmCapabilityEnabled } from './execute.js'

function assertCrmEnabled() {
  if (!isCrmCapabilityEnabled()) {
    throw new ForbiddenError('CRM integration is not enabled.')
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
export function listStudioCrmConnections(companyId) {
  assertCrmEnabled()
  const scoped = assertCompany(companyId)
  return listCrmConnectionsForCompany(scoped).map(presentStudioCrmConnection)
}

/**
 * @param {string} companyId
 * @param {string} connectionId
 */
export function getStudioCrmConnection(companyId, connectionId) {
  assertCrmEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioCrmConnection(getCrmConnectionForCompany(scoped, connectionId))
}

/**
 * @param {object} input
 */
export function upsertStudioCrmConnection(input = {}) {
  assertCrmEnabled()
  const scoped = assertCompany(input.companyId)
  return presentStudioCrmConnection(upsertCrmConnectionForCompany(scoped, input))
}

/**
 * @param {object} input
 */
export function patchStudioCrmConnection(input = {}) {
  assertCrmEnabled()
  const scoped = assertCompany(input.companyId)
  if (typeof input.enabled === 'boolean' && input.id && Object.keys(input).length <= 3) {
    return presentStudioCrmConnection(
      setCrmConnectionEnabled(scoped, input.id, input.enabled),
    )
  }
  const existing = getCrmConnectionForCompany(scoped, input.id)
  return presentStudioCrmConnection(
    upsertCrmConnectionForCompany(scoped, {
      ...existing,
      ...input,
      id: existing.id,
      companyId: scoped,
    }),
  )
}

/**
 * @param {string} companyId
 * @param {string} connectionId
 */
export function deleteStudioCrmConnection(companyId, connectionId) {
  assertCrmEnabled()
  const scoped = assertCompany(companyId)
  return deleteCrmConnectionForCompany(scoped, connectionId)
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 */
export function listStudioCrmOutcomes(companyId, options = {}) {
  assertCrmEnabled()
  const scoped = assertCompany(companyId)
  return listCrmOutcomesForCompany(scoped, options).map(presentStudioCrmExecutionOutcome)
}

/**
 * @param {string} companyId
 * @param {string} outcomeId
 */
export function getStudioCrmOutcome(companyId, outcomeId) {
  assertCrmEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioCrmExecutionOutcome(getCrmOutcomeForCompany(scoped, outcomeId))
}

/**
 * Internal/studio synchronous execute — not a client action.
 *
 * @param {{ companyId: string, intentId: string }} input
 */
export async function executeStudioCrmIntent(input = {}) {
  assertCrmEnabled()
  const scoped = assertCompany(input.companyId)
  return executeCrmIntent({ companyId: scoped, intentId: input.intentId })
}
