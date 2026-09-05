import { BLOCK_TYPE } from '../blocks/ids.js'
import {
  emptyOfferGroups,
  makeOfferGroups,
  presentOfferGroups,
} from '../models/offer.js'
import { getCommercialModules } from '../utils/commercialTotals.js'

function pricingBlock(proposal) {
  return (proposal?.blocks ?? []).find((block) => block.type === BLOCK_TYPE.PRICING)
}

/**
 * Authored offer groups on the proposal's pricing block.
 * Empty when the proposal has no Phase 2 data.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function getProposalOfferGroups(proposal) {
  return makeOfferGroups(pricingBlock(proposal)?.data?.offers)
}

/**
 * Published/living projection of authored offers.
 *
 * Enabled options only. No selection flags. Does not clone the proposal
 * or rewrite commercial line amounts.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 */
export function presentAuthoredOffers(proposal) {
  const pricing = pricingBlock(proposal)
  if (!pricing) return emptyOfferGroups()
  const modules = getCommercialModules(pricing, proposal ?? {})
  return presentOfferGroups(pricing.data?.offers, modules, { enabledOnly: true })
}

export function hasPresentedOffers(offers) {
  const groups = offers ?? emptyOfferGroups()
  return (
    (groups.packages?.length ?? 0) > 0 ||
    (groups.addons?.length ?? 0) > 0 ||
    (groups.alternatives?.length ?? 0) > 0
  )
}
