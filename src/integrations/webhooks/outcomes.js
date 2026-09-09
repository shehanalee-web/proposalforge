/**
 * H16.5 — Delivery outcome ledger (not an outbox / retry queue).
 *
 * Application-level idempotency: one terminal outcome per intent.id.
 * This does NOT provide network exactly-once delivery.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import {
  cloneOutboundWebhookDeliveryOutcome,
  makeOutboundWebhookDeliveryOutcome,
} from './schema.js'

let outcomes = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneOutboundWebhookDeliveryOutcome(item))
}

export function configureOutboundWebhookOutcomeStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (!persistHandler) return
  persistHandler({ outcomes: allOutboundWebhookOutcomes() })
}

export function allOutboundWebhookOutcomes() {
  return cloneList(outcomes)
}

export function replaceOutboundWebhookOutcomes(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.outcomes)
      ? snapshot.outcomes
      : []
  outcomes = list.map((item) => makeOutboundWebhookDeliveryOutcome(item))
  return { outcomes: allOutboundWebhookOutcomes() }
}

export function resetOutboundWebhookOutcomeStore(seed = {}) {
  return replaceOutboundWebhookOutcomes(seed)
}

export function serializeOutboundWebhookOutcomes() {
  return Object.freeze({ outcomes: allOutboundWebhookOutcomes() })
}

/**
 * @param {string} intentId
 */
export function findOutboundWebhookOutcomeByIntentId(intentId) {
  const id = String(intentId ?? '').trim()
  if (!id) return null
  const found = outcomes.find((item) => item.intentId === id)
  return found ? cloneOutboundWebhookDeliveryOutcome(found) : null
}

/**
 * @param {string} companyId
 * @param {{ limit?: number }} [options]
 */
export function listOutboundWebhookOutcomesForCompany(companyId, options = {}) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('Outcome listing requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const limit =
    Number.isInteger(options.limit) && options.limit > 0
      ? Math.min(options.limit, 200)
      : 50
  return allOutboundWebhookOutcomes()
    .filter((item) => item.companyId === company)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
}

/**
 * @param {string} companyId
 * @param {string} outcomeId
 */
export function getOutboundWebhookOutcomeForCompany(companyId, outcomeId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('Outcome lookup requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const id = String(outcomeId ?? '').trim()
  const found = outcomes.find((item) => item.id === id)
  if (!found) throw new NotFoundError('Outbound webhook outcome not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return cloneOutboundWebhookDeliveryOutcome(found)
}

/**
 * Record a terminal outcome. Rejects duplicate intentId (idempotent return).
 *
 * @param {object} input
 */
export function recordOutboundWebhookOutcome(input = {}) {
  const intentId = String(input.intentId ?? '').trim()
  if (!intentId) {
    throw new ValidationError('Outcome requires intentId.', [
      { field: 'intentId', message: 'intentId is required.' },
    ])
  }
  const existing = findOutboundWebhookOutcomeByIntentId(intentId)
  if (existing) {
    return { outcome: existing, duplicate: true }
  }
  const outcome = makeOutboundWebhookDeliveryOutcome(input)
  outcomes = [...outcomes, outcome]
  notify()
  return {
    outcome: cloneOutboundWebhookDeliveryOutcome(outcome),
    duplicate: false,
  }
}
