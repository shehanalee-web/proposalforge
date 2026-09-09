/**
 * H16.5 — Thin studio repository for outbound webhooks.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  presentStudioOutboundWebhookDestination,
  presentStudioOutboundWebhookDeliveryOutcome,
} from './schema.js'
import {
  deleteOutboundWebhookDestinationForCompany,
  getOutboundWebhookDestinationForCompany,
  listOutboundWebhookDestinationsForCompany,
  setOutboundWebhookDestinationEnabled,
  upsertOutboundWebhookDestinationForCompany,
} from './destinations.js'
import {
  getOutboundWebhookOutcomeForCompany,
  listOutboundWebhookOutcomesForCompany,
} from './outcomes.js'
import { executeOutboundWebhookForIntent } from './execute.js'

function assertWebhooksEnabled() {
  if (!INTEGRATION_CAPABILITIES.outboundWebhooks) {
    throw new ForbiddenError('Outbound webhooks are not enabled.')
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
export function listStudioOutboundWebhookDestinations(companyId) {
  assertWebhooksEnabled()
  const scoped = assertCompany(companyId)
  return listOutboundWebhookDestinationsForCompany(scoped).map(
    presentStudioOutboundWebhookDestination,
  )
}

/**
 * @param {string} companyId
 * @param {string} destinationId
 */
export function getStudioOutboundWebhookDestination(companyId, destinationId) {
  assertWebhooksEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioOutboundWebhookDestination(
    getOutboundWebhookDestinationForCompany(scoped, destinationId),
  )
}

/**
 * @param {object} input
 */
export function upsertStudioOutboundWebhookDestination(input = {}) {
  assertWebhooksEnabled()
  const scoped = assertCompany(input.companyId)
  return presentStudioOutboundWebhookDestination(
    upsertOutboundWebhookDestinationForCompany(scoped, input),
  )
}

/**
 * @param {object} input
 */
export function patchStudioOutboundWebhookDestination(input = {}) {
  assertWebhooksEnabled()
  const scoped = assertCompany(input.companyId)
  if (typeof input.enabled === 'boolean' && input.id && Object.keys(input).length <= 3) {
    return presentStudioOutboundWebhookDestination(
      setOutboundWebhookDestinationEnabled(scoped, input.id, input.enabled),
    )
  }
  const existing = getOutboundWebhookDestinationForCompany(scoped, input.id)
  return presentStudioOutboundWebhookDestination(
    upsertOutboundWebhookDestinationForCompany(scoped, {
      ...existing,
      ...input,
      id: existing.id,
      companyId: scoped,
    }),
  )
}

/**
 * @param {string} companyId
 * @param {string} destinationId
 */
export function deleteStudioOutboundWebhookDestination(companyId, destinationId) {
  assertWebhooksEnabled()
  const scoped = assertCompany(companyId)
  return deleteOutboundWebhookDestinationForCompany(scoped, destinationId)
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 */
export function listStudioOutboundWebhookOutcomes(companyId, options = {}) {
  assertWebhooksEnabled()
  const scoped = assertCompany(companyId)
  return listOutboundWebhookOutcomesForCompany(scoped, options).map(
    presentStudioOutboundWebhookDeliveryOutcome,
  )
}

/**
 * @param {string} companyId
 * @param {string} outcomeId
 */
export function getStudioOutboundWebhookOutcome(companyId, outcomeId) {
  assertWebhooksEnabled()
  const scoped = assertCompany(companyId)
  return presentStudioOutboundWebhookDeliveryOutcome(
    getOutboundWebhookOutcomeForCompany(scoped, outcomeId),
  )
}

/**
 * Internal/studio synchronous execute — not a client action.
 *
 * @param {{ companyId: string, intentId: string }} input
 */
export async function executeStudioOutboundWebhook(input = {}) {
  assertWebhooksEnabled()
  const scoped = assertCompany(input.companyId)
  return executeOutboundWebhookForIntent({
    companyId: scoped,
    intentId: input.intentId,
  })
}
