import { makeProposal } from '../models/proposal.js'
import { proposalFieldsFromSnapshot } from '../models/proposalVersion.js'
import { PDF_AUDIENCE } from './pdfFormat.js'

/**
 * Build the proposal record the PDF Engine will render.
 *
 * Layout, theme and Brand Kit stay outside this function. A version snapshot
 * is rehydrated onto the live proposal identity so a past PDF does not mutate
 * stored history.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 * @param {{
 *   audience?: string,
 *   version?: import('../models/proposalVersion.js').ProposalVersion | null,
 * }} [options]
 * @returns {import('../models/proposal.js').Proposal}
 */
export function prepareProposalForPdf(proposal, options = {}) {
  const version = options.version
  let source = proposal

  if (version) {
    const snapshot = version.snapshot ?? {}
    const hasBlocks = Array.isArray(snapshot.blocks) && snapshot.blocks.length > 0
    const base = hasBlocks
      ? proposal
      : { ...proposal, blocks: undefined, images: undefined }

    source = makeProposal({
      ...base,
      ...proposalFieldsFromSnapshot(snapshot),
      id: proposal.id,
      createdAt: proposal.createdAt,
      updatedAt: version.createdAt,
      status: version.status,
      versions: proposal.versions,
      currentVersion: version.versionNumber,
      shareToken: proposal.shareToken,
    })
  }

  if (options.audience === PDF_AUDIENCE.CLIENT) {
    return { ...source, notes: '' }
  }

  return source
}
