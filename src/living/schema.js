import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'

/**
 * Living session / commercial selection records.
 *
 * Separate from authored proposal content. References offer ids only.
 * Does not clone proposal blocks, pricing lines, or offer definitions.
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

/**
 * @param {object} [input]
 */
export function makeLivingSession(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  return {
    id: asString(input.id).trim() || createRecordId('lsess'),
    proposalId: asString(input.proposalId).trim(),
    shareToken: asString(input.shareToken).trim(),
    companyId:
      asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    selectedPackageId: asOptionalId(input.selectedPackageId),
    selectedAlternativeId: asOptionalId(input.selectedAlternativeId),
    selectedAddonIds: asIdList(input.selectedAddonIds),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  }
}

export function cloneLivingSession(session) {
  return makeLivingSession(session)
}

/**
 * Client-safe session projection. Internal ids stay out of the public URL;
 * shareToken is already in the path the client used.
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
