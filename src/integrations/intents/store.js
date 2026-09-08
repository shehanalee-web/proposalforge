/**
 * H16.4 — In-memory AutomationActionIntent ledger.
 *
 * Not an outbox. Not a delivery attempt log. Company-scoped only.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import {
  cloneAutomationActionIntent,
  makeAutomationActionIntent,
} from './schema.js'
import { AUTOMATION_ACTION_INTENT_STATUS } from './types.js'

let intents = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneAutomationActionIntent(item))
}

export function configureAutomationActionIntentStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (!persistHandler) return
  persistHandler({ intents: allAutomationActionIntents() })
}

export function allAutomationActionIntents() {
  return cloneList(intents)
}

export function replaceAutomationActionIntents(snapshot = {}) {
  const list = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.intents)
      ? snapshot.intents
      : []
  intents = list.map((item) => makeAutomationActionIntent(item))
  return { intents: allAutomationActionIntents() }
}

export function resetAutomationActionIntentStore(seed = {}) {
  return replaceAutomationActionIntents(seed)
}

export function serializeAutomationActionIntents() {
  return Object.freeze({ intents: allAutomationActionIntents() })
}

export function findAutomationActionIntentById(intentId) {
  const id = String(intentId ?? '').trim()
  if (!id) return null
  const found = intents.find((item) => item.id === id)
  return found ? cloneAutomationActionIntent(found) : null
}

export function findAutomationActionIntentByIdempotencyKey(key) {
  const idempotencyKey = String(key ?? '').trim()
  if (!idempotencyKey) return null
  const found = intents.find((item) => item.idempotencyKey === idempotencyKey)
  return found ? cloneAutomationActionIntent(found) : null
}

/**
 * @param {string} companyId
 * @param {string} intentId
 */
export function getAutomationActionIntentForCompany(companyId, intentId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationActionIntent lookup requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const found = findAutomationActionIntentById(intentId)
  if (!found) throw new NotFoundError('Automation action intent not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return found
}

/**
 * @param {string} companyId
 * @param {{ limit?: number, status?: string }} [options]
 */
export function listAutomationActionIntentsForCompany(companyId, options = {}) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationActionIntent list requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100
  const status = String(options.status ?? '').trim()
  return allAutomationActionIntents()
    .filter((item) => item.companyId === company)
    .filter((item) => !status || item.status === status)
    .sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt)),
    )
    .slice(0, limit)
}

/**
 * Idempotent record. Duplicate key returns existing intent.
 *
 * @param {object} intent
 */
export function recordAutomationActionIntent(intent) {
  const next = makeAutomationActionIntent(intent)
  const existing = findAutomationActionIntentByIdempotencyKey(next.idempotencyKey)
  if (existing) {
    if (existing.companyId !== next.companyId) {
      throw new ForbiddenError('You cannot access another company workspace.')
    }
    return { intent: existing, duplicate: true }
  }
  intents = [...intents, next]
  notify()
  return { intent: cloneAutomationActionIntent(next), duplicate: false }
}

/**
 * Cancel a recorded intent. Idempotent if already cancelled.
 *
 * @param {object} input
 */
export function cancelAutomationActionIntent({
  companyId,
  intentId,
  reason = null,
  now = null,
} = {}) {
  const existing = getAutomationActionIntentForCompany(companyId, intentId)
  if (existing.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED) {
    return { intent: existing, duplicate: true }
  }
  if (existing.status !== AUTOMATION_ACTION_INTENT_STATUS.RECORDED) {
    throw new ValidationError('Only recorded intents can be cancelled.', [
      { field: 'status', message: 'Intent is not cancellable.' },
    ])
  }
  const stamp = now ? new Date(now).toISOString() : new Date().toISOString()
  const next = makeAutomationActionIntent({
    ...existing,
    status: AUTOMATION_ACTION_INTENT_STATUS.CANCELLED,
    cancelledAt: stamp,
    cancelReason: reason || 'studio_cancelled',
    updatedAt: stamp,
  })
  intents = intents.map((item) => (item.id === next.id ? next : item))
  notify()
  return { intent: cloneAutomationActionIntent(next), duplicate: false }
}
