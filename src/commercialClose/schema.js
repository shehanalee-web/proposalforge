import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { makeDecisionSnapshot } from '../living/schema.js'
import {
  makeCloseSignature,
  presentClientCloseSignature,
  presentCloseSignature,
} from './signatureSchema.js'
import {
  makeClosePaymentFromDecision,
  presentClientClosePayment,
  presentClosePayment,
} from './paymentSchema.js'
import {
  COMMERCIAL_CLOSE_STATUS,
  COMMERCIAL_CLOSE_STATUSES,
} from './types.js'

/**
 * CommercialClose records.
 *
 * Stores an immutable copy of the H14 decision snapshot plus identity
 * anchors. Does not clone proposal blocks or offer definitions.
 * H15.2 adds status history for the close state machine.
 * H15.3 adds provider-neutral signature request/evidence on the close.
 * H15.4 adds provider-neutral payment request/evidence on the close.
 */

function asString(value) {
  return value == null ? '' : String(value)
}

function asIso(value, fallback = null) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

function asOptionalId(value) {
  const id = asString(value).trim()
  return id || null
}

/**
 * @param {object} [input]
 */
export function makeCloseStatusHistoryEntry(input = {}) {
  return Object.freeze({
    id: asString(input.id).trim() || createRecordId('cchst'),
    from: asString(input.from).trim() || null,
    to: asString(input.to).trim(),
    at: asIso(input.at, nowIso()),
    actorId: asOptionalId(input.actorId),
  })
}

function asStatusHistory(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => makeCloseStatusHistoryEntry(entry))
}

/**
 * Immutable commercial decision binding stored on the close.
 * Includes session/proposal identity that the living snapshot alone may omit.
 *
 * @param {object} [input]
 */
export function makeCloseDecisionBinding(input = {}) {
  const snapshot = makeDecisionSnapshot(input)
  return Object.freeze({
    proposalId: asString(input.proposalId).trim(),
    companyId: asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    sessionId: asString(input.sessionId).trim(),
    decisionLocked: true,
    publicationId: snapshot.publicationId,
    snapshotNumber: snapshot.snapshotNumber,
    proposalVersion: snapshot.proposalVersion,
    sourceVersionId: snapshot.sourceVersionId,
    selectedPackageId: snapshot.selectedPackageId,
    selectedAlternativeId: snapshot.selectedAlternativeId,
    selectedAddonIds: snapshot.selectedAddonIds,
    selectedTotal: snapshot.selectedTotal,
    selectedSubtotal: snapshot.selectedSubtotal,
    packageAmount: snapshot.packageAmount,
    alternativeAmount: snapshot.alternativeAmount,
    addonsAmount: snapshot.addonsAmount,
    currency: snapshot.currency,
    acceptedAt: snapshot.acceptedAt,
  })
}

/**
 * @param {object} [input]
 */
export function makeCommercialClose(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  const openedAt = asIso(input.openedAt, createdAt)
  const status = COMMERCIAL_CLOSE_STATUSES.includes(input.status)
    ? input.status
    : COMMERCIAL_CLOSE_STATUS.OPEN

  const decision =
    input.decision && typeof input.decision === 'object'
      ? makeCloseDecisionBinding(input.decision)
      : makeCloseDecisionBinding(input.decisionSnapshot ?? {})

  const statusHistory = asStatusHistory(input.statusHistory)
  const signature = makeCloseSignature(input.signature ?? {})
  const paymentSeed = input.payment ?? {}
  const payment = makeClosePaymentFromDecision(
    { decision, id: asString(input.id).trim() },
    paymentSeed,
  )

  return {
    id: asString(input.id).trim() || createRecordId('cclose'),
    companyId: asString(input.companyId).trim() || decision.companyId || DEFAULT_COMPANY_ID,
    proposalId: asString(input.proposalId).trim() || decision.proposalId,
    sessionId: asString(input.sessionId).trim() || decision.sessionId,
    status,
    decision,
    signature,
    payment,
    statusHistory,
    openedAt,
    openedByActorId: asOptionalId(input.openedByActorId),
    lastTransitionAt: asIso(input.lastTransitionAt, null),
    lastTransitionByActorId: asOptionalId(input.lastTransitionByActorId),
    closedAt: asIso(input.closedAt, null),
    cancelledAt: asIso(input.cancelledAt, null),
    expiredAt: asIso(input.expiredAt, null),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  }
}

export function cloneCommercialClose(record) {
  const next = makeCommercialClose(record)
  return {
    ...next,
    decision: makeCloseDecisionBinding(next.decision),
    signature: makeCloseSignature(next.signature),
    payment: makeClosePaymentFromDecision(next, next.payment),
    statusHistory: next.statusHistory.map((entry) => makeCloseStatusHistoryEntry(entry)),
  }
}

/**
 * Studio presentation — includes actor id for workspace operators.
 *
 * @param {object | null | undefined} record
 */
export function presentCommercialClose(record) {
  if (!record) return null
  const next = makeCommercialClose(record)
  return {
    id: next.id,
    companyId: next.companyId,
    proposalId: next.proposalId,
    sessionId: next.sessionId,
    status: next.status,
    decision: {
      proposalId: next.decision.proposalId,
      companyId: next.decision.companyId,
      sessionId: next.decision.sessionId,
      decisionLocked: next.decision.decisionLocked,
      publicationId: next.decision.publicationId,
      snapshotNumber: next.decision.snapshotNumber,
      proposalVersion: next.decision.proposalVersion,
      sourceVersionId: next.decision.sourceVersionId,
      selectedPackageId: next.decision.selectedPackageId,
      selectedAlternativeId: next.decision.selectedAlternativeId,
      selectedAddonIds: [...next.decision.selectedAddonIds],
      selectedTotal: next.decision.selectedTotal,
      selectedSubtotal: next.decision.selectedSubtotal,
      packageAmount: next.decision.packageAmount,
      alternativeAmount: next.decision.alternativeAmount,
      addonsAmount: next.decision.addonsAmount,
      currency: next.decision.currency,
      acceptedAt: next.decision.acceptedAt,
    },
    signature: presentCloseSignature(next.signature),
    payment: presentClosePayment(next.payment),
    statusHistory: next.statusHistory.map((entry) => ({
      id: entry.id,
      from: entry.from,
      to: entry.to,
      at: entry.at,
      actorId: entry.actorId,
    })),
    openedAt: next.openedAt,
    openedByActorId: next.openedByActorId,
    lastTransitionAt: next.lastTransitionAt,
    lastTransitionByActorId: next.lastTransitionByActorId,
    closedAt: next.closedAt,
    cancelledAt: next.cancelledAt,
    expiredAt: next.expiredAt,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  }
}

/**
 * Client-safe accepted-close summary. No actor ids, no internals.
 *
 * @param {object | null | undefined} record
 */
export function presentClientCommercialClose(record) {
  if (!record) return null
  const next = makeCommercialClose(record)
  return {
    id: next.id,
    proposalId: next.proposalId,
    status: next.status,
    decision: {
      publicationId: next.decision.publicationId,
      snapshotNumber: next.decision.snapshotNumber,
      proposalVersion: next.decision.proposalVersion,
      selectedPackageId: next.decision.selectedPackageId,
      selectedAlternativeId: next.decision.selectedAlternativeId,
      selectedAddonIds: [...next.decision.selectedAddonIds],
      selectedTotal: next.decision.selectedTotal,
      selectedSubtotal: next.decision.selectedSubtotal,
      currency: next.decision.currency,
      acceptedAt: next.decision.acceptedAt,
      decisionLocked: true,
    },
    signature: presentClientCloseSignature(next.signature),
    payment: presentClientClosePayment(next.payment),
    openedAt: next.openedAt,
  }
}
