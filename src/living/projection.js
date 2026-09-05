import { presentProposalForClient } from '../collaboration/present.js'
import { getLivingPublication } from './publication.js'
import { listLivingSections } from './sections.js'
import { presentAuthoredOffers } from './offers.js'
import { LIVING_CAPABILITIES } from './types.js'
import { emptyOfferGroups } from '../models/offer.js'

const STUDIO_ONLY_KEYS = Object.freeze([
  'followups',
  'followup',
  'workflow',
  'nextAction',
])

function withoutStudioDomains(proposal) {
  if (!proposal) return proposal
  let changed = false
  const next = { ...proposal }
  for (const key of STUDIO_ONLY_KEYS) {
    if (key in next) {
      delete next[key]
      changed = true
    }
  }
  return changed ? next : proposal
}

/**
 * Published/livable representation of an existing proposal.
 *
 * Reuses the client presentation strip. Does not clone blocks, invent a
 * second document schema, or merge follow-up / workflow / interaction state.
 * Authored offers are projected separately from future client session state.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function presentLivingProposal(proposal) {
  const presented = withoutStudioDomains(presentProposalForClient(proposal))
  if (!presented) {
    return {
      proposal: presented,
      sections: [],
      publication: getLivingPublication(presented),
      capabilities: LIVING_CAPABILITIES,
      authoredOffers: emptyOfferGroups(),
      interactionState: null,
      commercialState: null,
    }
  }

  return {
    proposal: presented,
    sections: listLivingSections(presented),
    publication: getLivingPublication(presented),
    capabilities: LIVING_CAPABILITIES,
    authoredOffers: presentAuthoredOffers(presented),
    interactionState: null,
    commercialState: null,
  }
}
