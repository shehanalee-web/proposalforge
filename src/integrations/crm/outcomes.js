/**
 * H16.6 — CRM execution outcome ledger (not an outbox / retry queue).
 *
 * Application-level idempotency: one terminal outcome per intent.id.
 * This is NOT external exactly-once. A crash after applyMutation but before
 * the outcome is persisted can still let a later run re-apply the mutation.
 * Providers can use the persisted connectionId/operation/externalKey hints to
 * de-duplicate on their side.
 *
 * Kept deliberately separate from the H16.5 webhook outcome ledger.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { cloneCrmExecutionOutcome, makeCrmExecutionOutcome } from './schema.js'

let outcomes = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneCrmExecutionOutcome(item))
}

export function configureCrmOutcomeStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (!persistHandler) return
  persistHandler({ outcomes: allCrmOutcomes() })
}

export function allCrmOutcomes() {
  return cloneList(outcomes)
}

export function replaceCrmOutcomes(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.outcomes)
      ? snapshot.outcomes
      : []
  outcomes = list.map((item) => makeCrmExecutionOutcome(item))
  return { outcomes: allCrmOutcomes() }
}

export function resetCrmOutcomeStore(seed = {}) {
  return replaceCrmOutcomes(seed)
}

export function serializeCrmOutcomes() {
  return Object.freeze({ outcomes: allCrmOutcomes() })
}

/**
 * @param {string} intentId
 */
export function findCrmOutcomeByIntentId(intentId) {
  const id = String(intentId ?? '').trim()
  if (!id) return null
  const found = outcomes.find((item) => item.intentId === id)
  return found ? cloneCrmExecutionOutcome(found) : null
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 */
export function listCrmOutcomesForCompany(companyId, options = {}) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('CRM outcome listing requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? Math.min(options.limit, 200) : 50
  return allCrmOutcomes()
    .filter((item) => item.companyId === company)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
}

/**
 * @param {string} companyId
 * @param {string} outcomeId
 */
export function getCrmOutcomeForCompany(companyId, outcomeId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('CRM outcome lookup requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const id = String(outcomeId ?? '').trim()
  const found = outcomes.find((item) => item.id === id)
  if (!found) throw new NotFoundError('CRM execution outcome not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return cloneCrmExecutionOutcome(found)
}

/**
 * Record a terminal outcome. A duplicate intentId returns the existing record.
 *
 * @param {object} input
 */
export function recordCrmOutcome(input = {}) {
  const intentId = String(input.intentId ?? '').trim()
  if (!intentId) {
    throw new ValidationError('CRM outcome requires intentId.', [
      { field: 'intentId', message: 'intentId is required.' },
    ])
  }
  const existing = findCrmOutcomeByIntentId(intentId)
  if (existing) {
    return { outcome: existing, duplicate: true }
  }
  const outcome = makeCrmExecutionOutcome(input)
  outcomes = [...outcomes, outcome]
  notify()
  return { outcome: cloneCrmExecutionOutcome(outcome), duplicate: false }
}
