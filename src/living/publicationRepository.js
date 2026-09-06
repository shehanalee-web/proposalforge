import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { DEFAULT_UPDATED_BY, snapshotFromProposal } from '../models/proposalVersion.js'
import {
  authoredDiffersFromPayload,
  fingerprintAuthoredProposal,
  makeLivingPublication,
  presentLivingPublication,
} from './publicationSchema.js'
import {
  findCurrentLivingPublication,
  findLivingPublicationById,
  insertLivingPublication,
  listLivingPublicationsForProposal,
} from './publicationStore.js'
import {
  materializeProposalFromPublication,
  presentPublicationSummary,
  resolveLivingProposalContent,
} from './publicationResolvers.js'
import { resolveLivingProposalById, resolveLivingProposalByShareToken } from './resolvers.js'
import { LIVING_CAPABILITIES } from './types.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function deny(message, { notFound = true } = {}) {
  const error = notFound ? new NotFoundError(message) : new ForbiddenError(message)
  error.reason = 'living_unavailable'
  throw error
}

function loadAuthoredOrDeny(proposalId, companyId) {
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('proposalId is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  const company = scopedCompany(companyId)
  const proposal = resolveLivingProposalById(pid, company)
  if (!proposal) deny('This proposal is not available.')
  return proposal
}

function assertSnapshotsEnabled() {
  if (!LIVING_CAPABILITIES.snapshots) {
    throw new ValidationError('Living publications are not enabled.', [
      { field: 'snapshots', message: 'snapshots capability is off.' },
    ])
  }
}

/**
 * Publish the current authored proposal as a new immutable snapshot.
 *
 * @param {{
 *   proposalId: string,
 *   companyId?: string,
 *   publishedBy?: string,
 * }} input
 */
export function publishLivingProposal(input = {}) {
  assertSnapshotsEnabled()
  const authored = loadAuthoredOrDeny(input.proposalId, input.companyId)
  const shareToken = String(authored.shareToken ?? '').trim()
  if (!shareToken) {
    throw new ValidationError('Proposal must have a share token before publishing.', [
      { field: 'shareToken', message: 'shareToken is required to publish.' },
    ])
  }

  const company = scopedCompany(authored.companyId)
  const existing = listLivingPublicationsForProposal(authored.id, company)
  const snapshotNumber = (existing[0]?.snapshotNumber ?? 0) + 1
  const payload = snapshotFromProposal(authored)

  const versions = Array.isArray(authored.versions) ? authored.versions : []
  const latestVersion = versions.reduce(
    (best, entry) =>
      !best || Number(entry.versionNumber ?? 0) > Number(best.versionNumber ?? 0)
        ? entry
        : best,
    null,
  )

  const record = insertLivingPublication(
    makeLivingPublication({
      companyId: company,
      proposalId: authored.id,
      shareToken,
      snapshotNumber,
      publishedBy: input.publishedBy || DEFAULT_UPDATED_BY,
      sourceRevision:
        authored.currentVersion != null && authored.currentVersion !== 0
          ? Number(authored.currentVersion)
          : latestVersion?.versionNumber ?? null,
      sourceVersionId: latestVersion?.versionId ?? latestVersion?.id ?? null,
      payload,
      contentFingerprint: fingerprintAuthoredProposal(authored),
    }),
  )

  return {
    publication: presentLivingPublication(record, { includePayload: false }),
    summary: presentPublicationSummary(authored, record),
    capabilities: LIVING_CAPABILITIES,
  }
}

/**
 * Studio current publication state.
 *
 * @param {{ proposalId: string, companyId?: string }} input
 */
export function getLivingPublicationState({ proposalId, companyId } = {}) {
  assertSnapshotsEnabled()
  const authored = loadAuthoredOrDeny(proposalId, companyId)
  const company = scopedCompany(authored.companyId)
  const current = findCurrentLivingPublication(authored.id, company)
  const snapshots = listLivingPublicationsForProposal(authored.id, company).map((item) =>
    presentLivingPublication(item),
  )

  return {
    proposalId: authored.id,
    companyId: company,
    shareToken: authored.shareToken ?? null,
    ...presentPublicationSummary(authored, current),
    snapshots,
    capabilities: LIVING_CAPABILITIES,
  }
}

/**
 * Historical snapshot list (studio).
 *
 * @param {{ proposalId: string, companyId?: string }} input
 */
export function listLivingSnapshots({ proposalId, companyId } = {}) {
  assertSnapshotsEnabled()
  const authored = loadAuthoredOrDeny(proposalId, companyId)
  const company = scopedCompany(authored.companyId)
  const snapshots = listLivingPublicationsForProposal(authored.id, company).map((item) =>
    presentLivingPublication(item),
  )
  return {
    proposalId: authored.id,
    companyId: company,
    snapshots,
    capabilities: LIVING_CAPABILITIES,
  }
}

/**
 * One historical immutable snapshot (studio).
 *
 * @param {{ proposalId: string, snapshotId: string, companyId?: string }} input
 */
export function getLivingSnapshot({ proposalId, snapshotId, companyId } = {}) {
  assertSnapshotsEnabled()
  const authored = loadAuthoredOrDeny(proposalId, companyId)
  const company = scopedCompany(authored.companyId)
  const id = String(snapshotId ?? '').trim()
  if (!id) {
    throw new ValidationError('snapshotId is required.', [
      { field: 'snapshotId', message: 'snapshotId is required.' },
    ])
  }

  const record = findLivingPublicationById(id)
  if (!record || record.proposalId !== authored.id || record.companyId !== company) {
    deny('This snapshot is not available.')
  }

  return {
    proposalId: authored.id,
    companyId: company,
    snapshot: presentLivingPublication(record, { includePayload: true }),
    capabilities: LIVING_CAPABILITIES,
  }
}

/**
 * Assert share-token ownership for a publication (no cross-proposal access).
 *
 * @param {{ shareToken: string, proposalId?: string, snapshotId?: string }} input
 */
export function assertLivingPublicationAccess(input = {}) {
  const token = String(input.shareToken ?? '').trim()
  if (!token) deny('This proposal is not available.')
  const authored = resolveLivingProposalByShareToken(token)
  if (!authored) deny('This proposal is not available.')

  const expectedProposal = String(input.proposalId ?? '').trim()
  if (expectedProposal && expectedProposal !== authored.id) {
    deny('This publication does not belong to this proposal.', { notFound: false })
  }

  const snapshotId = String(input.snapshotId ?? '').trim()
  if (snapshotId) {
    const record = findLivingPublicationById(snapshotId)
    if (
      !record ||
      record.proposalId !== authored.id ||
      record.shareToken !== authored.shareToken
    ) {
      deny('This publication does not belong to this share link.', { notFound: false })
    }
  }

  return authored
}

export {
  authoredDiffersFromPayload,
  materializeProposalFromPublication,
  resolveLivingProposalContent,
}
