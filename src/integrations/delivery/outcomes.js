/**
 * H16.16 Slice 16.3 — Durable rejected delivery outcome ledger.
 *
 * Application-level replay: one terminal outcome per intent.id.
 * JSON persist-handler boot, same as CRM/webhook outcomes.
 * Not an outbox, retry queue, or Native Activity repository.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  cloneDeliveryExecutionOutcome,
  makeDeliveryExecutionOutcome,
} from './schema.js'

let outcomes = []
let persistHandler = null

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

function snapshotOutcomesList(snapshot) {
  if (Array.isArray(snapshot)) return snapshot
  if (snapshot && typeof snapshot === 'object' && Array.isArray(snapshot.outcomes)) {
    return snapshot.outcomes
  }
  throw new ValidationError('delivery outcome snapshot must include an outcomes array.', [
    { field: 'outcomes', message: 'delivery outcome snapshot must include an outcomes array.' },
  ])
}

/**
 * Parse the on-disk JSON snapshot. Malformed JSON and non-snapshot shapes fail
 * closed; they are not coerced into an empty ledger.
 *
 * @param {string} raw
 * @returns {{ outcomes: object[] }}
 */
export function parsePersistedDeliveryOutcomeSnapshot(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ValidationError('Persisted delivery outcomes are not valid JSON.', [
      { field: 'outcomes', message: 'Persisted delivery outcomes are not valid JSON.' },
    ])
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Persisted delivery outcomes must be an object snapshot.', [
      { field: 'outcomes', message: 'Persisted delivery outcomes must be an object snapshot.' },
    ])
  }
  if (!Array.isArray(parsed.outcomes)) {
    throw new ValidationError('Persisted delivery outcomes must include an outcomes array.', [
      { field: 'outcomes', message: 'Persisted delivery outcomes must include an outcomes array.' },
    ])
  }
  return parsed
}

function notify() {
  if (!persistHandler) return
  persistHandler({ outcomes: allDeliveryOutcomes() })
}

/**
 * @param {{ persist?: (snapshot: { outcomes: object[] }) => void }} [input]
 */
export function configureDeliveryOutcomeStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

export function allDeliveryOutcomes() {
  return cloneList(outcomes)
}

/**
 * @param {object | object[]} [snapshot]
 */
export function replaceDeliveryOutcomes(snapshot = { outcomes: [] }) {
  const list = snapshotOutcomesList(snapshot)
  const next = list.map((item) => makeDeliveryExecutionOutcome(item))
  outcomes = next
  return { outcomes: allDeliveryOutcomes() }
}

/**
 * @param {object} [seed]
 */
export function resetDeliveryOutcomeStore(seed = { outcomes: [] }) {
  return replaceDeliveryOutcomes(seed)
}

export function serializeDeliveryOutcomes() {
  return Object.freeze({ outcomes: allDeliveryOutcomes() })
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
 * Tenant-scoped read. Does not execute, persist, or create rows.
 *
 * @param {string} companyId
 * @param {string} intentId
 * @returns {object}
 */
export function getDeliveryOutcomeForCompany(companyId, intentId) {
  const scoped = scopedCompany(companyId)
  const id = String(intentId ?? '').trim()
  if (!id) {
    throw new ValidationError('intent id is required.', [
      { field: 'intentId', message: 'intent id is required.' },
    ])
  }
  const found = outcomes.find((item) => item.intentId === id)
  if (!found) throw new NotFoundError('Delivery execution outcome not found.')
  if (found.companyId !== scoped) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return cloneDeliveryExecutionOutcome(found)
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
  notify()
  return { outcome: cloneDeliveryExecutionOutcome(outcome), duplicate: false }
}
