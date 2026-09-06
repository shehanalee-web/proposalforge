import { proposalFieldsFromSnapshot } from '../models/proposalVersion.js'
import {
  authoredDiffersFromPayload,
  presentLivingPublication,
} from './publicationSchema.js'
import {
  findCurrentLivingPublication,
  findLivingPublicationById,
  listLivingPublicationsForProposal,
} from './publicationStore.js'
import { LIVING_CAPABILITIES, LIVING_PUBLICATION_SOURCE } from './types.js'

/**
 * Materialize a proposal-shaped object from an immutable publication payload.
 * Keeps authored identity (id, shareToken, companyId) from the live record.
 *
 * @param {import('../models/proposal.js').Proposal} authored
 * @param {object} publication
 */
export function materializeProposalFromPublication(authored, publication) {
  const fields = proposalFieldsFromSnapshot(publication.payload)
  return {
    ...authored,
    ...fields,
    id: authored.id,
    shareToken: authored.shareToken,
    companyId: authored.companyId,
    createdAt: authored.createdAt,
    updatedAt: authored.updatedAt,
    // Working version history stays on the authored record; client strip removes it.
    versions: authored.versions,
    currentVersion: authored.currentVersion,
  }
}

/**
 * Resolve the proposal content the Living client should see.
 * No silent fake snapshot — unpublished proposals keep authored compatibility.
 *
 * @param {import('../models/proposal.js').Proposal} authored
 */
export function resolveLivingProposalContent(authored) {
  if (!authored) return authored
  if (!LIVING_CAPABILITIES.snapshots) return authored

  const current = findCurrentLivingPublication(
    authored.id,
    authored.companyId ?? '',
  )
  if (!current) return authored
  if (current.shareToken !== authored.shareToken) return authored

  return materializeProposalFromPublication(authored, current)
}

/**
 * Publication metadata for the living renderer.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 * @param {{ publication?: object | null }} [options]
 */
export function resolveLivingPublicationMeta(proposal, options = {}) {
  const publication = options.publication ?? null
  if (publication && LIVING_CAPABILITIES.snapshots) {
    return {
      source: LIVING_PUBLICATION_SOURCE.PUBLISHED,
      snapshot: true,
      revision: publication.snapshotNumber,
      snapshotId: publication.id,
      proposalId: proposal?.id ?? publication.proposalId ?? null,
      shareToken: proposal?.shareToken ?? publication.shareToken ?? null,
      status: proposal?.status ?? null,
      publishedAt: publication.publishedAt,
      publishedBy: publication.publishedBy,
      capabilities: LIVING_CAPABILITIES,
    }
  }

  return {
    source: LIVING_PUBLICATION_SOURCE.AUTHORED,
    snapshot: false,
    revision: null,
    snapshotId: null,
    proposalId: proposal?.id ?? null,
    shareToken: proposal?.shareToken ?? null,
    status: proposal?.status ?? null,
    publishedAt: null,
    publishedBy: null,
    capabilities: LIVING_CAPABILITIES,
  }
}

/**
 * @param {string} proposalId
 * @param {string} [companyId]
 */
export function getCurrentPublicationRecord(proposalId, companyId = '') {
  return findCurrentLivingPublication(proposalId, companyId)
}

/**
 * @param {string} snapshotId
 */
export function getPublicationRecordById(snapshotId) {
  return findLivingPublicationById(snapshotId)
}

/**
 * @param {string} proposalId
 * @param {string} [companyId]
 */
export function listPublicationRecords(proposalId, companyId = '') {
  return listLivingPublicationsForProposal(proposalId, companyId)
}

/**
 * @param {import('../models/proposal.js').Proposal} authored
 * @param {object | null} publication
 */
export function presentPublicationSummary(authored, publication) {
  if (!publication) {
    return {
      published: false,
      current: null,
      hasUnpublishedChanges: false,
      snapshotCount: 0,
    }
  }

  return {
    published: true,
    current: presentLivingPublication(publication),
    hasUnpublishedChanges: authoredDiffersFromPayload(authored, publication.payload),
    snapshotCount: listLivingPublicationsForProposal(
      authored.id,
      authored.companyId ?? '',
    ).length,
  }
}
