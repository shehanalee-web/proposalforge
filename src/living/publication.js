import { resolveLivingPublicationMeta } from './publicationResolvers.js'
import { findCurrentLivingPublication } from './publicationStore.js'
import { LIVING_CAPABILITIES } from './types.js'

/**
 * Publication metadata for the living renderer.
 *
 * When snapshots are enabled and a current publication exists for the proposal,
 * reports the published source. Otherwise preserves authored compatibility —
 * never invents a fake snapshot.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 * @param {{ publication?: object | null }} [options]
 */
export function getLivingPublication(proposal, options = {}) {
  if (options.publication) {
    return resolveLivingPublicationMeta(proposal, {
      publication: options.publication,
    })
  }

  if (proposal?.id && LIVING_CAPABILITIES.snapshots) {
    const current = findCurrentLivingPublication(
      proposal.id,
      proposal.companyId ?? '',
    )
    if (current && current.shareToken === (proposal.shareToken ?? '')) {
      return resolveLivingPublicationMeta(proposal, { publication: current })
    }
  }

  return resolveLivingPublicationMeta(proposal, { publication: null })
}
