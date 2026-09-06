import { NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { BLOCK_TYPE } from '../blocks/ids.js'
import { emitLivingEvent } from './events.js'
import {
  makeLivingEngagementEvent,
  presentLivingEngagementEvent,
} from './eventSchema.js'
import {
  insertLivingEngagementEvent,
  listLivingEngagementEventsForProposal,
} from './eventStore.js'
import { presentAuthoredOffers } from './offers.js'
import {
  resolveLivingProposalById,
  resolveLivingProposalByShareToken,
} from './resolvers.js'
import { findLivingSessionByShareToken } from './store.js'
import { LIVING_CAPABILITIES, LIVING_EVENT, LIVING_EVENTS } from './types.js'
import { resolveLivingProposalContent } from './publicationResolvers.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function loadProposalByToken(shareToken) {
  const token = String(shareToken ?? '').trim()
  if (!token) {
    const error = new NotFoundError('This proposal is not available.')
    error.reason = 'living_unavailable'
    throw error
  }
  const authored = resolveLivingProposalByShareToken(token)
  if (!authored) {
    const error = new NotFoundError('This proposal is not available.')
    error.reason = 'living_unavailable'
    throw error
  }
  return resolveLivingProposalContent(authored)
}

function assertBlockOnProposal(proposal, blockId) {
  if (!blockId) return
  const found = (proposal.blocks ?? []).some((block) => block?.id === blockId)
  if (!found) {
    throw new ValidationError('That section is not part of this proposal.', [
      { field: 'blockId', message: `Unknown blockId: ${blockId}` },
    ])
  }
}

function assertOfferOnProposal(proposal, offerId) {
  if (!offerId) return
  const offers = presentAuthoredOffers(proposal)
  const known = [
    ...offers.packages,
    ...offers.addons,
    ...offers.alternatives,
  ].some((offer) => offer.id === offerId)
  if (!known) {
    throw new ValidationError('That offer is not part of this proposal.', [
      { field: 'offerId', message: `Unknown or disabled offerId: ${offerId}` },
    ])
  }
}

/**
 * Summarize engagement for studio read surfaces.
 *
 * @param {object[]} events
 */
export function summarizeLivingEngagement(events = []) {
  const list = Array.isArray(events) ? events : []
  const countType = (type) => list.filter((event) => event.type === type).length
  const last = list
    .slice()
    .sort((left, right) => String(right.at).localeCompare(String(left.at)))[0]

  const sectionIds = new Set(
    list
      .filter((event) => event.type === LIVING_EVENT.SECTION_VIEWED && event.blockId)
      .map((event) => event.blockId),
  )

  return {
    opens: countType(LIVING_EVENT.PROPOSAL_OPENED),
    sectionsViewed: sectionIds.size,
    sectionViewEvents: countType(LIVING_EVENT.SECTION_VIEWED),
    pricingViewed: countType(LIVING_EVENT.PRICING_VIEWED),
    packageExpanded: countType(LIVING_EVENT.PACKAGE_EXPANDED),
    packageSelections: countType(LIVING_EVENT.PACKAGE_SELECTED),
    addonSelections: countType(LIVING_EVENT.ADDON_SELECTED),
    acceptanceStarted: countType(LIVING_EVENT.ACCEPTANCE_STARTED),
    accepted: countType(LIVING_EVENT.ACCEPTED),
    totalEvents: list.length,
    lastEngagementAt: last?.at ?? null,
    lastEngagementType: last?.type ?? null,
  }
}

/**
 * Persist a client living engagement event.
 * Proposal identity is derived from the share token — never from the body.
 *
 * @param {{
 *   shareToken: string,
 *   type: string,
 *   blockId?: string | null,
 *   offerId?: string | null,
 *   sessionId?: string | null,
 *   metadata?: object,
 *   at?: string,
 * }} input
 */
export function recordLivingEngagementEvent(input = {}) {
  if (!LIVING_CAPABILITIES.commercialEvents) {
    throw new ValidationError('Living engagement events are not enabled.', [
      { field: 'type', message: 'commercialEvents capability is off.' },
    ])
  }

  const proposal = loadProposalByToken(input.shareToken)
  const type = String(input.type ?? '').trim()
  if (!LIVING_EVENTS.includes(type)) {
    throw new ValidationError('Unknown living event type.', [
      { field: 'type', message: `Unsupported event type: ${type || '(empty)'}` },
    ])
  }

  const blockId = input.blockId == null ? null : String(input.blockId).trim() || null
  const offerId = input.offerId == null ? null : String(input.offerId).trim() || null

  assertBlockOnProposal(proposal, blockId)
  assertOfferOnProposal(proposal, offerId)

  if (type === LIVING_EVENT.PRICING_VIEWED && blockId) {
    const block = (proposal.blocks ?? []).find((item) => item.id === blockId)
    if (block && block.type !== BLOCK_TYPE.PRICING) {
      throw new ValidationError('pricing_viewed requires a pricing block.', [
        { field: 'blockId', message: 'blockId is not a pricing section.' },
      ])
    }
  }

  const session =
    findLivingSessionByShareToken(proposal.shareToken) ??
    null
  const sessionId =
    input.sessionId == null || String(input.sessionId).trim() === ''
      ? session?.id ?? null
      : String(input.sessionId).trim()

  if (sessionId && session && sessionId !== session.id) {
    throw new ValidationError('sessionId does not match this share session.', [
      { field: 'sessionId', message: 'Unknown session for this share token.' },
    ])
  }

  // Client-supplied proposalId / companyId / money fields are ignored.
  void input.proposalId
  void input.companyId
  void input.amount
  void input.total
  void input.selectedTotal
  void input.packageAmount

  const record = insertLivingEngagementEvent(
    makeLivingEngagementEvent({
      companyId: scopedCompany(proposal.companyId),
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      type,
      blockId,
      offerId,
      sessionId: sessionId || session?.id || null,
      metadata: input.metadata,
      at: input.at,
    }),
  )

  emitLivingEvent(type, {
    proposalId: proposal.id,
    shareToken: proposal.shareToken,
    blockId: record.blockId,
    offerId: record.offerId,
    sessionId: record.sessionId,
    eventId: record.id,
  })

  return presentLivingEngagementEvent(record)
}

/**
 * Studio-only engagement feed for a proposal.
 *
 * @param {{ proposalId: string, companyId?: string }} input
 */
export function listStudioLivingEngagementEvents({ proposalId, companyId }) {
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('proposalId is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  const company = scopedCompany(companyId)
  const proposal = resolveLivingProposalById(pid, company)
  if (!proposal) {
    const error = new NotFoundError('This proposal is not available.')
    error.reason = 'living_unavailable'
    throw error
  }

  const events = listLivingEngagementEventsForProposal(pid, company).map((event) =>
    presentLivingEngagementEvent(event),
  )

  return {
    proposalId: pid,
    companyId: company,
    events,
    summary: summarizeLivingEngagement(events),
    capabilities: LIVING_CAPABILITIES,
  }
}
