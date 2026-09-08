/**
 * H16.2 — In-memory automation events + persisted intake receipts ledger.
 *
 * Receipts are the durable idempotency surface. Accepted AutomationEvents are
 * kept as thin envelopes (not copies of living/close/proposal documents).
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import {
  cloneAutomationEvent,
  makeAutomationEvent,
  makeAutomationIntakeReceipt,
} from './schema.js'
import { AUTOMATION_INTAKE_STATUS } from './types.js'

let events = []
let receipts = []
let persistHandler = null

function cloneEvents(list) {
  return list.map((item) => cloneAutomationEvent(item))
}

function cloneReceipts(list) {
  return list.map((item) => makeAutomationIntakeReceipt(item))
}

export function configureAutomationIntakeStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (!persistHandler) return
  persistHandler({
    receipts: allAutomationIntakeReceipts(),
    events: allAutomationEvents(),
  })
}

export function allAutomationEvents() {
  return cloneEvents(events)
}

export function allAutomationIntakeReceipts() {
  return cloneReceipts(receipts)
}

/**
 * Replace in-memory state from a persisted ledger snapshot.
 *
 * @param {{ receipts?: object[], events?: object[] } | object[]} snapshot
 */
export function replaceAutomationIntakeLedger(snapshot = {}) {
  const bag =
    Array.isArray(snapshot)
      ? { receipts: snapshot, events: [] }
      : snapshot && typeof snapshot === 'object'
        ? snapshot
        : {}
  receipts = (Array.isArray(bag.receipts) ? bag.receipts : []).map((item) =>
    makeAutomationIntakeReceipt(item),
  )
  events = (Array.isArray(bag.events) ? bag.events : []).map((item) =>
    makeAutomationEvent(item),
  )
  return {
    receipts: allAutomationIntakeReceipts(),
    events: allAutomationEvents(),
  }
}

export function resetAutomationIntakeStore(seed = {}) {
  return replaceAutomationIntakeLedger(seed)
}

/**
 * Serialize ledger for persistence — receipts + thin accepted events only.
 */
export function serializeAutomationIntakeLedger() {
  return Object.freeze({
    receipts: allAutomationIntakeReceipts(),
    events: allAutomationEvents().filter(
      (event) => event.intake?.status === AUTOMATION_INTAKE_STATUS.ACCEPTED,
    ),
  })
}

export function findAutomationIntakeReceipt(idempotencyKey) {
  const key = String(idempotencyKey ?? '').trim()
  if (!key) return null
  const found = receipts.find((item) => item.idempotencyKey === key)
  return found ? makeAutomationIntakeReceipt(found) : null
}

export function findAutomationEventById(eventId) {
  const id = String(eventId ?? '').trim()
  if (!id) return null
  const found = events.find((item) => item.id === id)
  return found ? cloneAutomationEvent(found) : null
}

/**
 * @param {string} companyId
 * @param {string} eventId
 */
export function getAutomationEventById(companyId, eventId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationEvent lookup requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  const found = findAutomationEventById(eventId)
  if (!found) throw new NotFoundError('AutomationEvent not found.')
  if (found.companyId !== company) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return found
}

/**
 * @param {string} companyId
 */
export function listAcceptedAutomationEventsForCompany(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('AutomationEvent list requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return allAutomationEvents()
    .filter(
      (event) =>
        event.companyId === company &&
        event.intake?.status === AUTOMATION_INTAKE_STATUS.ACCEPTED,
    )
    .sort((left, right) =>
      String(right.receivedAt).localeCompare(String(left.receivedAt)),
    )
}

/**
 * @param {string} companyId
 */
export function listAutomationIntakeReceiptsForCompany(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('Intake receipt list requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return allAutomationIntakeReceipts().filter((item) => item.companyId === company)
}

/**
 * @param {object} event
 * @param {object} receipt
 */
export function recordAcceptedAutomationIntake(event, receipt) {
  const nextEvent = makeAutomationEvent(event)
  const nextReceipt = makeAutomationIntakeReceipt(receipt)
  if (nextEvent.companyId !== nextReceipt.companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  events = [...events, nextEvent]
  receipts = [...receipts, nextReceipt]
  notify()
  return {
    event: cloneAutomationEvent(nextEvent),
    receipt: makeAutomationIntakeReceipt(nextReceipt),
  }
}

/**
 * Record duplicate/ignored/rejected receipt without creating a new event row.
 * Duplicate receipts are not re-appended when the key already exists.
 *
 * @param {object} receipt
 */
export function recordAutomationIntakeReceiptOnly(receipt) {
  const nextReceipt = makeAutomationIntakeReceipt(receipt)
  const existing = receipts.find(
    (item) => item.idempotencyKey === nextReceipt.idempotencyKey,
  )
  if (existing) {
    return makeAutomationIntakeReceipt(existing)
  }
  receipts = [...receipts, nextReceipt]
  notify()
  return makeAutomationIntakeReceipt(nextReceipt)
}
