import { LIVING_CAPABILITIES, LIVING_PUBLICATION_SOURCE } from './types.js'

/**
 * Conceptual publication metadata for the living renderer.
 *
 * Phase 1 always reports authored live content. A frozen published snapshot
 * belongs to a later H14 publication phase and must not be faked here.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function getLivingPublication(proposal) {
  const pointer = proposal?.publishedRevision ?? proposal?.livingRevision ?? null

  return {
    source: LIVING_PUBLICATION_SOURCE.AUTHORED,
    snapshot: false,
    revision: pointer == null || pointer === '' ? null : String(pointer),
    proposalId: proposal?.id ?? null,
    shareToken: proposal?.shareToken ?? null,
    status: proposal?.status ?? null,
    capabilities: LIVING_CAPABILITIES,
  }
}
