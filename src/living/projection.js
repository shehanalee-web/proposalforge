import { presentProposalForClient } from '../collaboration/present.js'
import { getLivingPublication } from './publication.js'
import { listLivingSections } from './sections.js'
import { hasPresentedOffers, presentAuthoredOffers } from './offers.js'
import { LIVING_CAPABILITIES } from './types.js'
import { emptyOfferGroups } from '../models/offer.js'
import { presentLivingSession } from './schema.js'
import { deriveSelectedCommercialState } from './totals.js'

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
 * Authored offers stay separate from living session selection state.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 * @param {{
 *   session?: object | null,
 *   commercialState?: object | null,
 *   publication?: object | null,
 * }} [options]
 */
export function presentLivingProposal(proposal, options = {}) {
  const presented = withoutStudioDomains(presentProposalForClient(proposal))
  if (!presented) {
    return {
      proposal: presented,
      sections: [],
      publication: getLivingPublication(presented, {
        publication: options.publication ?? null,
      }),
      capabilities: LIVING_CAPABILITIES,
      authoredOffers: emptyOfferGroups(),
      interactionState: null,
      commercialState: null,
      session: null,
    }
  }

  const authoredOffers = presentAuthoredOffers(presented)
  const session = options.session ? presentLivingSession(options.session) : null
  let commercialState = options.commercialState ?? null
  if (commercialState === null && hasPresentedOffers(authoredOffers)) {
    commercialState = deriveSelectedCommercialState(presented, session)
  }
  if (!hasPresentedOffers(authoredOffers)) {
    commercialState = null
  }

  return {
    proposal: presented,
    sections: listLivingSections(presented),
    publication: getLivingPublication(presented, {
      publication: options.publication ?? null,
    }),
    capabilities: LIVING_CAPABILITIES,
    authoredOffers,
    // H12 feedback loads via living share token APIs — not embedded here
    // (presenting must not ensure/create portal records as a side effect).
    interactionState: LIVING_CAPABILITIES.h12Interactions
      ? { enabled: true }
      : null,
    commercialState,
    session,
  }
}
