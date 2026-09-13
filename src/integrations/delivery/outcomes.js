/**
 * H16.16 Slice 16.2 — In-memory delivery execution outcome ledger.
 *
 * Application-level replay: one terminal rejected outcome per intent.id.
 * Not an outbox, retry queue, filesystem store, or durable repository.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  cloneDeliveryExecutionOutcome,
  makeDeliveryExecutionOutcome,
} from './schema.js'

let outcomes = []

function cloneList(list) {
  return list.map((item) => cloneDeliveryExecutionOutcome(item))
}

function scopedCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return check.companyId
}

/**
 * @param {string} intentId
 * @returns {object | null}
 */
export function findDeliveryOutcomeByIntentId(intentId) {
  const id = String(intentId ?? '').trim()
  if (!id) return null
  const found = outcomes.find((item) => item.intentId === id)
  return found ? cloneDeliveryExecutionOutcome(found) : null
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 * @returns {object[]}
 */
export function listDeliveryOutcomesForCompany(companyId, options = {}) {
  const company = scopedCompany(companyId)
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? Math.min(options.limit, 200) : 50
  return cloneList(outcomes)
    .filter((item) => item.companyId === company)
    .slice(-limit)
    .reverse()
}

/**
 * @param {object} [seed]
 */
export function resetDeliveryOutcomeStore(seed = {}) {
  const list = Array.isArray(seed)
    ? seed
    : Array.isArray(seed?.outcomes)
      ? seed.outcomes
      : []
  outcomes = list.map((item) => makeDeliveryExecutionOutcome(item))
  return { outcomes: cloneList(outcomes) }
}

/**
 * Record a terminal rejected outcome. Duplicate intentId returns the existing row.
 *
 * @param {object} input
 */
export function recordDeliveryOutcome(input = {}) {
  const intentId = String(input.intentId ?? '').trim()
  if (!intentId) {
    throw new ValidationError('intent id is required.', [
      { field: 'intentId', message: 'intent id is required.' },
    ])
  }
  const existing = findDeliveryOutcomeByIntentId(intentId)
  if (existing) {
    const scoped = scopedCompany(input.companyId)
    if (existing.companyId !== scoped) {
      throw new ForbiddenError('You cannot access another company workspace.')
    }
    return { outcome: existing, duplicate: true }
  }
  const outcome = makeDeliveryExecutionOutcome(input)
  outcomes = [...outcomes, outcome]
  return { outcome: cloneDeliveryExecutionOutcome(outcome), duplicate: false }
}
