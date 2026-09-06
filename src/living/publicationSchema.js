import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import {
  DEFAULT_UPDATED_BY,
  proposalFieldsFromSnapshot,
  snapshotFromProposal,
  snapshotsEqual,
} from '../models/proposalVersion.js'
import { ValidationError } from '../services/errors.js'

/**
 * Living publication / immutable snapshot records (H14 Phase 4B).
 *
 * Authored proposal content only. Never stores client selections, engagement
 * events, follow-ups, or analytics.
 */

export const LIVING_PUBLICATION_STATUS = Object.freeze({
  PUBLISHED: 'published',
})

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

function cloneDeep(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * Stable fingerprint of authored snapshot content (no timestamps / sessions).
 *
 * @param {import('../models/proposalVersion.js').ProposalSnapshot} snapshot
 */
export function fingerprintPublicationPayload(snapshot) {
  return JSON.stringify(snapshotFromProposal(proposalFieldsFromSnapshot(snapshot)))
}

/**
 * @param {import('../models/proposal.js').Proposal} proposal
 */
export function fingerprintAuthoredProposal(proposal) {
  return fingerprintPublicationPayload(snapshotFromProposal(proposal))
}

/**
 * @param {import('../models/proposal.js').Proposal} authored
 * @param {import('../models/proposalVersion.js').ProposalSnapshot} payload
 */
export function authoredDiffersFromPayload(authored, payload) {
  return !snapshotsEqual(snapshotFromProposal(authored), payload)
}

/**
 * @param {object} [input]
 */
export function makeLivingPublication(input = {}) {
  const proposalId = asString(input.proposalId).trim()
  const shareToken = asString(input.shareToken).trim()
  if (!proposalId) {
    throw new ValidationError('proposalId is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  if (!shareToken) {
    throw new ValidationError('shareToken is required.', [
      { field: 'shareToken', message: 'shareToken is required.' },
    ])
  }

  const payload = cloneDeep(input.payload ?? null)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Publication payload is required.', [
      { field: 'payload', message: 'Immutable authored payload is required.' },
    ])
  }

  // Reject accidental domain bleed.
  if (
    'selectedPackageId' in payload ||
    'selectedAddonIds' in payload ||
    'followups' in payload ||
    'engagement' in payload ||
    'events' in payload
  ) {
    throw new ValidationError('Publication payload contains forbidden domains.', [
      { field: 'payload', message: 'Selections, events, and follow-ups are not allowed.' },
    ])
  }

  const snapshotNumber = Number(input.snapshotNumber ?? 1)
  if (!Number.isInteger(snapshotNumber) || snapshotNumber < 1) {
    throw new ValidationError('snapshotNumber must be a positive integer.', [
      { field: 'snapshotNumber', message: 'snapshotNumber must be a positive integer.' },
    ])
  }

  const fingerprint =
    asString(input.contentFingerprint).trim() || fingerprintPublicationPayload(payload)

  return {
    id: asString(input.id).trim() || createRecordId('lpub'),
    companyId: asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    proposalId,
    shareToken,
    snapshotNumber,
    publishedAt: asIso(input.publishedAt, nowIso()),
    publishedBy: asString(input.publishedBy).trim() || DEFAULT_UPDATED_BY,
    sourceRevision:
      input.sourceRevision == null || input.sourceRevision === ''
        ? null
        : Number(input.sourceRevision),
    sourceVersionId: asString(input.sourceVersionId).trim() || null,
    status: LIVING_PUBLICATION_STATUS.PUBLISHED,
    payload,
    contentFingerprint: fingerprint,
  }
}

export function cloneLivingPublication(record) {
  const next = makeLivingPublication(record)
  return {
    ...next,
    payload: cloneDeep(next.payload),
  }
}

/**
 * Studio/client-safe presentation of a publication record.
 *
 * @param {object} record
 * @param {{ includePayload?: boolean }} [options]
 */
export function presentLivingPublication(record, options = {}) {
  const next = makeLivingPublication(record)
  const base = {
    id: next.id,
    companyId: next.companyId,
    proposalId: next.proposalId,
    shareToken: next.shareToken,
    snapshotNumber: next.snapshotNumber,
    publishedAt: next.publishedAt,
    publishedBy: next.publishedBy,
    sourceRevision: next.sourceRevision,
    sourceVersionId: next.sourceVersionId,
    status: next.status,
    contentFingerprint: next.contentFingerprint,
  }
  if (options.includePayload) {
    return { ...base, payload: cloneDeep(next.payload) }
  }
  return base
}
