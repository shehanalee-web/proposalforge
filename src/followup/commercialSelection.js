import { presentAuthoredOffers } from '../living/offers.js'
import { LIVING_CAPABILITIES } from '../living/types.js'
import { FOLLOWUP_CAPABILITIES } from './types.js'
import { FOLLOWUP_REASON, FOLLOWUP_SOURCE } from './types.js'
import { FOLLOWUP_REASON_META } from './reasons.js'
import { addMs, clockOf } from './policy.js'
import { FOLLOWUP_POLICY } from './policy.js'

/**
 * Whether a living session currently holds a meaningful commercial selection.
 *
 * @param {object | null | undefined} session
 */
export function livingSessionHasCommercialSelection(session) {
  if (!session) return false
  if (session.selectedPackageId) return true
  if (session.selectedAlternativeId) return true
  return Array.isArray(session.selectedAddonIds) && session.selectedAddonIds.length > 0
}

/**
 * Build a short studio-facing description of the current selection.
 * Titles come from authored offers only — never client amounts.
 *
 * @param {object | null | undefined} proposal
 * @param {object | null | undefined} session
 */
export function describeLivingCommercialSelection(proposal, session) {
  if (!livingSessionHasCommercialSelection(session)) return ''
  const offers = presentAuthoredOffers(proposal)
  const parts = []

  if (session.selectedPackageId) {
    const pkg = offers.packages.find((item) => item.id === session.selectedPackageId)
    parts.push(pkg?.title ? `package “${pkg.title}”` : 'a package')
  }
  if (session.selectedAlternativeId) {
    const alt = offers.alternatives.find((item) => item.id === session.selectedAlternativeId)
    parts.push(alt?.title ? `alternative “${alt.title}”` : 'an alternative')
  }
  if (Array.isArray(session.selectedAddonIds) && session.selectedAddonIds.length) {
    const titles = session.selectedAddonIds
      .map((id) => offers.addons.find((item) => item.id === id)?.title || id)
      .filter(Boolean)
    if (titles.length === 1) parts.push(`add-on “${titles[0]}”`)
    else if (titles.length > 1) parts.push(`add-ons ${titles.map((t) => `“${t}”`).join(', ')}`)
  }

  if (!parts.length) return 'Client made a commercial selection in the living proposal.'
  return `Client selected ${parts.join(' and ')}.`
}

/**
 * Build the COMMERCIAL_SELECTION signal extras when a living session has
 * authored offer choices and the proposal is still commercially open.
 *
 * @param {{
 *   proposal: object,
 *   livingSession?: object | null,
 *   ownerActorId?: string,
 *   now?: number | Date | string,
 * }} input
 */
export function commercialSelectionSignalExtras({
  proposal,
  livingSession = null,
  ownerActorId = '',
  now = Date.now(),
} = {}) {
  if (!FOLLOWUP_CAPABILITIES.commercialSelection) return null
  if (!LIVING_CAPABILITIES.commercialSelectionFollowup) return null
  if (!livingSessionHasCommercialSelection(livingSession)) return null

  const meta = FOLLOWUP_REASON_META[FOLLOWUP_REASON.COMMERCIAL_SELECTION]
  const clock = clockOf(now)
  const updated = livingSession.updatedAt || livingSession.createdAt || clock

  return {
    reason: FOLLOWUP_REASON.COMMERCIAL_SELECTION,
    title: meta.title,
    description: describeLivingCommercialSelection(proposal, livingSession),
    priority: meta.priority,
    sourceType: FOLLOWUP_SOURCE.LIVING,
    sourceId: livingSession.id || proposal.id,
    // One open commercial-selection follow-up per proposal (dedupe key).
    signalSourceId: '',
    dueAt: addMs(updated, FOLLOWUP_POLICY.manualDefaultDueMs) || null,
    ownerActorId: ownerActorId || '',
  }
}
