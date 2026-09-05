import { LIVING_CAPABILITIES, LIVING_PUBLICATION_SOURCE } from './types.js'

/**
 * Conceptual publication metadata for the living renderer.
 *
 * Phase 1 always reports the current authored/live proposal. Frozen snapshot
 * pointers (`publishedRevision`, `livingRevision`) belong to a later H14
 * publication phase and are not read here.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function getLivingPublication(proposal) {
  return {
    source: LIVING_PUBLICATION_SOURCE.AUTHORED,
    snapshot: false,
    revision: null,
    proposalId: proposal?.id ?? null,
    shareToken: proposal?.shareToken ?? null,
    status: proposal?.status ?? null,
    capabilities: LIVING_CAPABILITIES,
  }
}
