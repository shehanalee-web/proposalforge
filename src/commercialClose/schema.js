import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { makeDecisionSnapshot } from '../living/schema.js'
import {
  COMMERCIAL_CLOSE_STATUS,
  COMMERCIAL_CLOSE_STATUSES,
} from './types.js'

/**
 * CommercialClose records.
 *
 * Stores an immutable copy of the H14 decision snapshot plus identity
 * anchors. Does not clone proposal blocks or offer definitions.
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

  return {
    id: asString(input.id).trim() || createRecordId('cclose'),
    companyId: asString(input.companyId).trim() || decision.companyId || DEFAULT_COMPANY_ID,
    proposalId: asString(input.proposalId).trim() || decision.proposalId,
    sessionId: asString(input.sessionId).trim() || decision.sessionId,
    status,
    decision,
    openedAt,
    openedByActorId: asOptionalId(input.openedByActorId),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  }
}

export function cloneCommercialClose(record) {
  const next = makeCommercialClose(record)
  return {
    ...next,
    decision: makeCloseDecisionBinding(next.decision),
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
    openedAt: next.openedAt,
    openedByActorId: next.openedByActorId,
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
    openedAt: next.openedAt,
  }
}
