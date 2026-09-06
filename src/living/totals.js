import { roundMoney } from '../models/commercial.js'
import { OFFER_KIND } from '../models/offer.js'
import { getProposalCommercials } from '../utils/commercialTotals.js'
import { presentAuthoredOffers, hasPresentedOffers } from './offers.js'
import { emptySelectionState, makeLivingSession } from './schema.js'

function findOffer(list, id) {
  if (!id) return null
  return list.find((offer) => offer.id === id) ?? null
}

/**
 * Drop unknown / disabled offer ids from a selection payload.
 * Amounts are never taken from the client.
 *
 * @param {object} authoredOffers
 * @param {object} [selection]
 */
export function normalizeLivingSelections(authoredOffers, selection = {}) {
  const packages = authoredOffers?.packages ?? []
  const alternatives = authoredOffers?.alternatives ?? []
  const addons = authoredOffers?.addons ?? []
  const empty = emptySelectionState()

  const packageId = selection.selectedPackageId ?? null
  const alternativeId = selection.selectedAlternativeId ?? null
  const addonIds = Array.isArray(selection.selectedAddonIds)
    ? selection.selectedAddonIds
    : []

  const selectedPackage = findOffer(packages, packageId)
  const selectedAlternative = findOffer(alternatives, alternativeId)
  const enabledAddonIds = new Set(addons.map((offer) => offer.id))

  return {
    selectedPackageId: selectedPackage ? selectedPackage.id : empty.selectedPackageId,
    selectedAlternativeId: selectedAlternative
      ? selectedAlternative.id
      : empty.selectedAlternativeId,
    selectedAddonIds: addonIds.filter((id) => enabledAddonIds.has(String(id ?? '').trim())),
  }
}

/**
 * Pure derived commercial state from authored offers × living selections.
 * Never mutates proposal.items, pricing lines, or authored offer amounts.
 *
 * @param {import('../models/proposal.js').Proposal | null | undefined} proposal
 * @param {object | null | undefined} session
 */
export function deriveSelectedCommercialState(proposal, session = null) {
  const authoredOffers = presentAuthoredOffers(proposal)
  if (!hasPresentedOffers(authoredOffers)) return null

  const commercials = getProposalCommercials(proposal ?? {})
  const base = commercials.totals
  const selection = normalizeLivingSelections(
    authoredOffers,
    session ? makeLivingSession(session) : emptySelectionState(),
  )

  const selectedPackage = findOffer(authoredOffers.packages, selection.selectedPackageId)
  const selectedAlternative = findOffer(
    authoredOffers.alternatives,
    selection.selectedAlternativeId,
  )
  const selectedAddons = authoredOffers.addons.filter((offer) =>
    selection.selectedAddonIds.includes(offer.id),
  )

  const packageAmount = roundMoney(selectedPackage?.amount ?? 0)
  const alternativeAmount = roundMoney(selectedAlternative?.amount ?? 0)
  const addonsAmount = roundMoney(
    selectedAddons.reduce((sum, offer) => sum + (Number(offer.amount) || 0), 0),
  )

  const hasPackageChoices = authoredOffers.packages.length > 0
  const hasAlternativeChoices = authoredOffers.alternatives.length > 0
  const hasAddonChoices = authoredOffers.addons.length > 0

  // When packages exist, the selected package is the commercial base for the
  // configuration. Otherwise keep the authored investment total as the base.
  const configurationBase = hasPackageChoices ? packageAmount : roundMoney(base.grandTotal)
  const selectedSubtotal = roundMoney(
    configurationBase + alternativeAmount + addonsAmount,
  )
  const selectedTotal = selectedSubtotal

  return {
    selectedPackageId: selection.selectedPackageId,
    selectedAlternativeId: selection.selectedAlternativeId,
    selectedAddonIds: [...selection.selectedAddonIds],
    selectedPackage: selectedPackage
      ? {
          id: selectedPackage.id,
          kind: OFFER_KIND.PACKAGE,
          title: selectedPackage.title,
          amount: packageAmount,
        }
      : null,
    selectedAlternative: selectedAlternative
      ? {
          id: selectedAlternative.id,
          kind: OFFER_KIND.ALTERNATIVE,
          title: selectedAlternative.title,
          amount: alternativeAmount,
        }
      : null,
    selectedAddons: selectedAddons.map((offer) => ({
      id: offer.id,
      kind: OFFER_KIND.ADDON,
      title: offer.title,
      amount: roundMoney(offer.amount),
    })),
    packageAmount,
    alternativeAmount,
    addonsAmount,
    selectedSubtotal,
    selectedTotal,
    baseGrandTotal: roundMoney(base.grandTotal),
    baseSubtotal: roundMoney(base.subtotal),
    hasPackageChoices,
    hasAlternativeChoices,
    hasAddonChoices,
    currency: proposal?.currency ?? 'USD',
  }
}
