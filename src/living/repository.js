import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { emitLivingEvent } from './events.js'
import { presentAuthoredOffers } from './offers.js'
import { presentLivingProposal } from './projection.js'
import { resolveLivingProposalByShareToken } from './resolvers.js'
import {
  makeDecisionSnapshot,
  makeLivingSession,
  presentLivingSession,
} from './schema.js'
import {
  findLivingSessionByShareToken,
  insertLivingSession,
  listLivingSessionsForProposal,
  replaceLivingSession,
} from './store.js'
import { deriveSelectedCommercialState, normalizeLivingSelections } from './totals.js'
import { LIVING_CAPABILITIES, LIVING_EVENT } from './types.js'
import { listLivingEngagementEventsForProposal } from './eventStore.js'
import {
  makeLivingEngagementEvent,
  presentLivingEngagementEvent,
} from './eventSchema.js'
import { insertLivingEngagementEvent } from './eventStore.js'
import { summarizeLivingEngagement } from './eventRepository.js'
import { findCurrentLivingPublication } from './publicationStore.js'
import { resolveLivingProposalContent } from './publicationResolvers.js'
import { reconcileLivingCommercialSelectionFollowup } from './signals.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function deny(message, { notFound = true } = {}) {
  const error = notFound ? new NotFoundError(message) : new ForbiddenError(message)
  error.reason = 'living_unavailable'
  throw error
}

function loadAuthoredOrDeny(shareToken) {
  const token = String(shareToken ?? '').trim()
  if (!token) deny('This proposal is not available.')
  const proposal = resolveLivingProposalByShareToken(token)
  if (!proposal) deny('This proposal is not available.')
  if (proposal.shareToken && proposal.shareToken !== token) {
    deny('This proposal is not available.')
  }
  return proposal
}

/**
 * Client-facing proposal content: current publication when published,
 * otherwise authored compatibility (no silent fake snapshot).
 */
function loadProposalOrDeny(shareToken) {
  return resolveLivingProposalContent(loadAuthoredOrDeny(shareToken))
}

function assertProposalMatch(session, proposal) {
  if (session.proposalId !== proposal.id) {
    deny('This selection does not belong to this proposal.', { notFound: false })
  }
  if (session.shareToken !== proposal.shareToken) {
    deny('This selection does not belong to this share link.', { notFound: false })
  }
}

/**
 * Resolve publication / revision identity for close-binding.
 * Uses living publication ids — does not invent a second versioning system.
 *
 * @param {import('../models/proposal.js').Proposal} authored
 */
export function resolveLivingRevisionIdentity(authored) {
  if (!authored?.id) {
    return {
      publicationId: null,
      snapshotNumber: null,
      proposalVersion: null,
      sourceVersionId: null,
    }
  }

  const publication = LIVING_CAPABILITIES.snapshots
    ? findCurrentLivingPublication(authored.id, authored.companyId ?? '')
    : null

  if (
    publication &&
    (!authored.shareToken || publication.shareToken === authored.shareToken)
  ) {
    return {
      publicationId: publication.id,
      snapshotNumber: publication.snapshotNumber ?? null,
      proposalVersion:
        publication.sourceRevision != null
          ? Number(publication.sourceRevision)
          : authored.currentVersion != null
            ? Number(authored.currentVersion)
            : null,
      sourceVersionId: publication.sourceVersionId ?? null,
    }
  }

  return {
    publicationId: null,
    snapshotNumber: null,
    proposalVersion:
      authored.currentVersion != null && authored.currentVersion !== ''
        ? Number(authored.currentVersion)
        : null,
    sourceVersionId: null,
  }
}

function withRevisionIdentity(session, authored) {
  if (session.decisionLocked) return session
  const revision = resolveLivingRevisionIdentity(authored)
  return {
    ...session,
    publicationId: revision.publicationId,
    snapshotNumber: revision.snapshotNumber,
    proposalVersion: revision.proposalVersion,
    sourceVersionId: revision.sourceVersionId,
  }
}

function stamp(session) {
  return { ...session, updatedAt: new Date().toISOString() }
}

function save(session) {
  const next = makeLivingSession(stamp(session))
  const existing = findLivingSessionByShareToken(next.shareToken)
  if (existing) {
    replaceLivingSession(existing.id, {
      ...next,
      id: existing.id,
      createdAt: existing.createdAt,
    })
  } else {
    insertLivingSession(next)
  }
  return makeLivingSession(findLivingSessionByShareToken(next.shareToken))
}

/**
 * Ensure a living session exists for this share context.
 * Identity is the share token — not authentication, not a public session URL.
 *
 * @param {string} shareToken
 */
export function getOrCreateLivingSession(shareToken) {
  const authored = loadAuthoredOrDeny(shareToken)
  const proposal = resolveLivingProposalContent(authored)
  const companyId = scopedCompany(authored.companyId)
  const existing = findLivingSessionByShareToken(authored.shareToken)
  if (existing) {
    assertProposalMatch(existing, authored)
    if (existing.decisionLocked) return existing
    const offers = presentAuthoredOffers(proposal)
    const normalized = normalizeLivingSelections(offers, existing)
    const stamped = withRevisionIdentity(
      { ...existing, ...normalized },
      authored,
    )
    if (
      stamped.selectedPackageId !== existing.selectedPackageId ||
      stamped.selectedAlternativeId !== existing.selectedAlternativeId ||
      stamped.selectedAddonIds.join('\0') !== existing.selectedAddonIds.join('\0') ||
      stamped.publicationId !== existing.publicationId ||
      stamped.snapshotNumber !== existing.snapshotNumber ||
      stamped.proposalVersion !== existing.proposalVersion
    ) {
      return save(stamped)
    }
    return existing
  }

  return save(
    withRevisionIdentity(
      makeLivingSession({
        proposalId: authored.id,
        shareToken: authored.shareToken,
        companyId,
        selectedPackageId: null,
        selectedAlternativeId: null,
        selectedAddonIds: [],
      }),
      authored,
    ),
  )
}

/**
 * Client living view: authored projection + session + derived totals.
 * Never returns workflow / follow-up / studio domains.
 *
 * @param {{ shareToken: string }} input
 */
export function getLivingClientView({ shareToken }) {
  const authored = loadAuthoredOrDeny(shareToken)
  const publication = LIVING_CAPABILITIES.snapshots
    ? findCurrentLivingPublication(authored.id, authored.companyId ?? '')
    : null
  const activePublication =
    publication && publication.shareToken === authored.shareToken ? publication : null
  const proposal = resolveLivingProposalContent(authored)
  const session = getOrCreateLivingSession(authored.shareToken)
  const commercialState = deriveSelectedCommercialState(proposal, session)
  const living = presentLivingProposal(proposal, {
    session,
    commercialState,
    publication: activePublication,
  })

  return {
    ...living,
    session: presentLivingSession(session),
    commercialState,
    capabilities: LIVING_CAPABILITIES,
  }
}

function rejectUnknownOffer(kind, id) {
  throw new ValidationError(`That ${kind} is not available on this proposal.`, [
    { field: kind, message: `Unknown or disabled ${kind}: ${id}` },
  ])
}

/**
 * Apply client commercial selections. Validates against authored offers only.
 * Never writes proposal content or amounts from the client body.
 *
 * @param {{
 *   shareToken: string,
 *   selectedPackageId?: string | null,
 *   selectedAlternativeId?: string | null,
 *   selectedAddonIds?: string[],
 *   toggleAddonId?: string,
 * }} input
 */
export function applyLivingDecisions(input = {}) {
  const authored = loadAuthoredOrDeny(input.shareToken)
  const proposal = resolveLivingProposalContent(authored)
  const session = getOrCreateLivingSession(authored.shareToken)
  assertProposalMatch(session, authored)

  if (session.decisionLocked) {
    throw new ValidationError('This commercial decision is locked after acceptance.', [
      { field: 'decisionLocked', message: 'Selections cannot change after acceptance.' },
    ])
  }

  const offers = presentAuthoredOffers(proposal)
  const next = {
    selectedPackageId: session.selectedPackageId,
    selectedAlternativeId: session.selectedAlternativeId,
    selectedAddonIds: [...session.selectedAddonIds],
  }

  if ('selectedPackageId' in input) {
    const raw = input.selectedPackageId
    if (raw == null || String(raw).trim() === '') {
      next.selectedPackageId = null
    } else {
      const id = String(raw).trim()
      const found = offers.packages.find((offer) => offer.id === id)
      if (!found) rejectUnknownOffer('package', id)
      next.selectedPackageId = found.id
    }
  }

  if ('selectedAlternativeId' in input) {
    const raw = input.selectedAlternativeId
    if (raw == null || String(raw).trim() === '') {
      next.selectedAlternativeId = null
    } else {
      const id = String(raw).trim()
      const found = offers.alternatives.find((offer) => offer.id === id)
      if (!found) rejectUnknownOffer('alternative', id)
      next.selectedAlternativeId = found.id
    }
  }

  if ('selectedAddonIds' in input) {
    if (!Array.isArray(input.selectedAddonIds)) {
      throw new ValidationError('selectedAddonIds must be an array.', [
        { field: 'selectedAddonIds', message: 'selectedAddonIds must be an array.' },
      ])
    }
    const enabled = new Set(offers.addons.map((offer) => offer.id))
    const ids = []
    for (const entry of input.selectedAddonIds) {
      const id = String(entry ?? '').trim()
      if (!id) continue
      if (!enabled.has(id)) rejectUnknownOffer('addon', id)
      if (!ids.includes(id)) ids.push(id)
    }
    next.selectedAddonIds = ids
  }

  if (input.toggleAddonId != null) {
    const id = String(input.toggleAddonId).trim()
    const found = offers.addons.find((offer) => offer.id === id)
    if (!found) rejectUnknownOffer('addon', id)
    if (next.selectedAddonIds.includes(found.id)) {
      next.selectedAddonIds = next.selectedAddonIds.filter((item) => item !== found.id)
    } else {
      next.selectedAddonIds = [...next.selectedAddonIds, found.id]
    }
  }

  // Client-supplied amounts are ignored. Authored offer amounts always win.
  void input.amount
  void input.total
  void input.selectedTotal
  void input.packageAmount

  const saved = save(
    withRevisionIdentity(
      {
        ...session,
        ...next,
      },
      authored,
    ),
  )
  const commercialState = deriveSelectedCommercialState(proposal, saved)

  if ('selectedPackageId' in input && saved.selectedPackageId) {
    emitLivingEvent(LIVING_EVENT.PACKAGE_SELECTED, {
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      sessionId: saved.id,
      offerId: saved.selectedPackageId,
      signal: 'commercial_selection',
    })
  }
  if (input.toggleAddonId || 'selectedAddonIds' in input) {
    emitLivingEvent(LIVING_EVENT.ADDON_SELECTED, {
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      sessionId: saved.id,
      offerIds: saved.selectedAddonIds,
      signal: 'commercial_selection',
    })
  }

  // Best-effort H13 commercial selection signal — never blocks the client decision.
  reconcileLivingCommercialSelectionFollowup({
    companyId: scopedCompany(proposal.companyId),
    proposalId: proposal.id,
  })

  return {
    session: presentLivingSession(saved),
    commercialState,
    proposalId: proposal.id,
  }
}

/**
 * Freeze acceptance against the current publication revision + commercial selection.
 * Does not mutate authored proposal content or offer prices.
 *
 * @param {{ shareToken: string, acceptedAt?: string }} input
 */
export function captureLivingAcceptanceDecision(input = {}) {
  const authored = loadAuthoredOrDeny(input.shareToken)
  const proposal = resolveLivingProposalContent(authored)
  const session = getOrCreateLivingSession(authored.shareToken)
  assertProposalMatch(session, authored)

  if (session.decisionLocked && session.decisionSnapshot) {
    return {
      session: presentLivingSession(session),
      decisionSnapshot: makeDecisionSnapshot(session.decisionSnapshot),
      alreadyLocked: true,
    }
  }

  const revision = resolveLivingRevisionIdentity(authored)
  const commercialState = deriveSelectedCommercialState(proposal, session)
  const acceptedAt = input.acceptedAt || new Date().toISOString()

  const decisionSnapshot = makeDecisionSnapshot({
    publicationId: revision.publicationId,
    snapshotNumber: revision.snapshotNumber,
    proposalVersion: revision.proposalVersion,
    sourceVersionId: revision.sourceVersionId,
    selectedPackageId: session.selectedPackageId,
    selectedAlternativeId: session.selectedAlternativeId,
    selectedAddonIds: session.selectedAddonIds,
    selectedTotal: commercialState?.selectedTotal ?? null,
    selectedSubtotal: commercialState?.selectedSubtotal ?? null,
    packageAmount: commercialState?.packageAmount ?? null,
    alternativeAmount: commercialState?.alternativeAmount ?? null,
    addonsAmount: commercialState?.addonsAmount ?? null,
    currency: commercialState?.currency ?? proposal.currency ?? 'USD',
    acceptedAt,
  })

  const saved = save({
    ...session,
    publicationId: revision.publicationId,
    snapshotNumber: revision.snapshotNumber,
    proposalVersion: revision.proposalVersion,
    sourceVersionId: revision.sourceVersionId,
    decisionLocked: true,
    acceptedAt,
    decisionSnapshot,
  })

  if (LIVING_CAPABILITIES.commercialEvents) {
    const record = insertLivingEngagementEvent(
      makeLivingEngagementEvent({
        companyId: scopedCompany(authored.companyId),
        proposalId: authored.id,
        shareToken: authored.shareToken,
        type: LIVING_EVENT.ACCEPTED,
        sessionId: saved.id,
        metadata: {
          publicationId: revision.publicationId,
          snapshotNumber: revision.snapshotNumber,
          proposalVersion: revision.proposalVersion,
          source: 'acceptance',
        },
        at: acceptedAt,
      }),
    )
    emitLivingEvent(LIVING_EVENT.ACCEPTED, {
      proposalId: authored.id,
      shareToken: authored.shareToken,
      sessionId: saved.id,
      eventId: record.id,
      publicationId: revision.publicationId,
    })
  }

  return {
    session: presentLivingSession(saved),
    decisionSnapshot,
    alreadyLocked: false,
  }
}

/**
 * Studio summary: sessions + engagement counts.
 * Does not write follow-ups or activity analytics.
 *
 * @param {{ proposalId: string, companyId?: string }} input
 */
export function getLivingStudioSummary({ proposalId, companyId }) {
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('proposalId is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  const company = scopedCompany(companyId)
  const sessions = listLivingSessionsForProposal(pid)
  const events = listLivingEngagementEventsForProposal(pid, company).map((event) =>
    presentLivingEngagementEvent(event),
  )
  return {
    proposalId: pid,
    sessionCount: sessions.length,
    sessions: sessions.map((session) => presentLivingSession(session)),
    engagement: summarizeLivingEngagement(events),
    capabilities: LIVING_CAPABILITIES,
  }
}

/**
 * Reject cross-proposal session access when a caller supplies a mismatched id.
 *
 * @param {{ shareToken: string, proposalId?: string }} input
 */
export function assertLivingProposalAccess({ shareToken, proposalId }) {
  const proposal = loadProposalOrDeny(shareToken)
  const expected = String(proposalId ?? '').trim()
  if (expected && expected !== proposal.id) {
    deny('This selection does not belong to this proposal.', { notFound: false })
  }
  return proposal
}
