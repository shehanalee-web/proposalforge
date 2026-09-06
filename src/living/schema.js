import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'

/**
 * Living session / commercial selection records.
 *
 * Separate from authored proposal content. References offer ids only.
 * Does not clone proposal blocks, pricing lines, or offer definitions.
 *
 * Close-binding (H14 hardening): optional publication revision identity and
 * an immutable decision snapshot captured at acceptance.
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

function asIdList(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const ids = []
  for (const entry of value) {
    const id = asString(entry).trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function asOptionalInt(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.trunc(number)
}

function asMoney(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.round(number * 100) / 100
}

/**
 * Immutable commercial decision captured at acceptance.
 * References publication + selection ids; amounts are derived server-side copies.
 *
 * @param {object} [input]
 */
export function makeDecisionSnapshot(input = {}) {
  return Object.freeze({
    publicationId: asOptionalId(input.publicationId),
    snapshotNumber: asOptionalInt(input.snapshotNumber),
    proposalVersion: asOptionalInt(input.proposalVersion),
    sourceVersionId: asOptionalId(input.sourceVersionId),
    selectedPackageId: asOptionalId(input.selectedPackageId),
    selectedAlternativeId: asOptionalId(input.selectedAlternativeId),
    selectedAddonIds: Object.freeze(asIdList(input.selectedAddonIds)),
    selectedTotal: asMoney(input.selectedTotal),
    selectedSubtotal: asMoney(input.selectedSubtotal),
    packageAmount: asMoney(input.packageAmount),
    alternativeAmount: asMoney(input.alternativeAmount),
    addonsAmount: asMoney(input.addonsAmount),
    currency: asString(input.currency).trim() || 'USD',
    acceptedAt: asIso(input.acceptedAt, null),
  })
}

/**
 * Client-safe decision projection (no follow-up / studio internals).
 *
 * @param {object | null | undefined} snapshot
 */
export function presentDecisionSnapshot(snapshot) {
  if (!snapshot) return null
  const next = makeDecisionSnapshot(snapshot)
  return {
    publicationId: next.publicationId,
    snapshotNumber: next.snapshotNumber,
    proposalVersion: next.proposalVersion,
    selectedPackageId: next.selectedPackageId,
    selectedAlternativeId: next.selectedAlternativeId,
    selectedAddonIds: [...next.selectedAddonIds],
    selectedTotal: next.selectedTotal,
    selectedSubtotal: next.selectedSubtotal,
    currency: next.currency,
    acceptedAt: next.acceptedAt,
  }
}

/**
 * @param {object} [input]
 */
export function makeLivingSession(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  const decisionSnapshot =
    input.decisionSnapshot && typeof input.decisionSnapshot === 'object'
      ? makeDecisionSnapshot(input.decisionSnapshot)
      : null

  return {
    id: asString(input.id).trim() || createRecordId('lsess'),
    proposalId: asString(input.proposalId).trim(),
    shareToken: asString(input.shareToken).trim(),
    companyId: asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    selectedPackageId: asOptionalId(input.selectedPackageId),
    selectedAlternativeId: asOptionalId(input.selectedAlternativeId),
    selectedAddonIds: asIdList(input.selectedAddonIds),
    // Revision identity — additive; older sessions omit these safely.
    publicationId: asOptionalId(input.publicationId),
    snapshotNumber: asOptionalInt(input.snapshotNumber),
    proposalVersion: asOptionalInt(input.proposalVersion),
    sourceVersionId: asOptionalId(input.sourceVersionId),
    decisionLocked: Boolean(input.decisionLocked),
    acceptedAt: asIso(input.acceptedAt, null),
    decisionSnapshot,
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  }
}

export function cloneLivingSession(session) {
  const next = makeLivingSession(session)
  return {
    ...next,
    selectedAddonIds: [...next.selectedAddonIds],
    decisionSnapshot: next.decisionSnapshot
      ? makeDecisionSnapshot(next.decisionSnapshot)
      : null,
  }
}

/**
 * Client-safe session projection. Internal company id stays out.
 * Decision snapshot is projected without follow-up internals.
 *
 * @param {object | null | undefined} session
 */
export function presentLivingSession(session) {
  if (!session) return null
  const next = makeLivingSession(session)
  return {
    id: next.id,
    proposalId: next.proposalId,
    shareToken: next.shareToken,
    selectedPackageId: next.selectedPackageId,
    selectedAlternativeId: next.selectedAlternativeId,
    selectedAddonIds: [...next.selectedAddonIds],
    publicationId: next.publicationId,
    snapshotNumber: next.snapshotNumber,
    proposalVersion: next.proposalVersion,
    decisionLocked: next.decisionLocked,
    acceptedAt: next.acceptedAt,
    decision: presentDecisionSnapshot(next.decisionSnapshot),
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  }
}

export function emptySelectionState() {
  return {
    selectedPackageId: null,
    selectedAlternativeId: null,
    selectedAddonIds: [],
  }
}
