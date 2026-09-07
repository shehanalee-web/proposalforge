import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { PROPOSAL_STATUS } from '../models/proposal.js'
import { resolveWorkflowActor } from '../workflow/actors.js'
import {
  makeLivingEngagementEvent,
} from '../living/eventSchema.js'
import { insertLivingEngagementEvent } from '../living/eventStore.js'
import { emitLivingEvent } from '../living/events.js'
import { makeDecisionSnapshot } from '../living/schema.js'
import {
  findLivingSession,
  findLivingSessionByShareToken,
  listLivingSessionsForProposal,
} from '../living/store.js'
import {
  resolveLivingProposalById,
  resolveLivingProposalByShareToken,
} from '../living/resolvers.js'
import {
  studioCanCreateCommercialClose,
  studioCanViewCommercialClose,
} from './permissions.js'
import {
  makeCloseDecisionBinding,
  makeCommercialClose,
  presentClientCommercialClose,
  presentCommercialClose,
} from './schema.js'
import {
  findCommercialClose,
  findCommercialCloseByDecision,
  findCommercialCloseByProposal,
  insertCommercialClose,
  listCommercialClosesForProposal,
} from './store.js'
import {
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_STATUS,
} from './types.js'
import { LIVING_EVENT } from '../living/types.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function actorOf(input) {
  return resolveWorkflowActor(input)
}

function assertCompanyActor(actor, companyId) {
  if (actor.companyId !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function assertCapability() {
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain) {
    throw new ValidationError('Commercial close domain is not enabled.', [
      { field: 'capabilities', message: 'commercialCloseDomain capability is off.' },
    ])
  }
}

function requireProposal(companyId, proposalId) {
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('proposalId is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  const proposal = resolveLivingProposalById(pid, companyId)
  if (!proposal) {
    throw new NotFoundError('Proposal not found.')
  }
  const ownedBy =
    String(proposal.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
  if (ownedBy !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return proposal
}

function findLockedSessionForProposal(proposalId, companyId) {
  const sessions = listLivingSessionsForProposal(proposalId)
  const locked = sessions.filter(
    (session) => session.decisionLocked && session.decisionSnapshot,
  )
  if (locked.length === 0) return null
  // Prefer the session matching the proposal share token when available.
  const proposal = resolveLivingProposalById(proposalId, companyId)
  if (proposal?.shareToken) {
    const byToken = locked.find((session) => session.shareToken === proposal.shareToken)
    if (byToken) return byToken
  }
  const scoped = locked.filter((session) => {
    const owned =
      String(session.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
    return owned === companyId
  })
  const pool = scoped.length ? scoped : locked
  return pool
    .slice()
    .sort((left, right) =>
      String(right.acceptedAt || right.updatedAt || '').localeCompare(
        String(left.acceptedAt || left.updatedAt || ''),
      ),
    )[0]
}

/**
 * Validate locked decision is sufficient to open a commercial close.
 *
 * @param {object} session
 * @param {object} proposal
 */
export function assertValidCloseDecision(session, proposal) {
  if (!session) {
    throw new ValidationError('No living session exists for this proposal.', [
      { field: 'sessionId', message: 'Living session is required.' },
    ])
  }
  if (!session.decisionLocked) {
    throw new ValidationError('Commercial decision is not locked.', [
      { field: 'decisionLocked', message: 'Accept the proposal before opening a close.' },
    ])
  }
  if (!session.decisionSnapshot) {
    throw new ValidationError('Decision snapshot is missing.', [
      { field: 'decisionSnapshot', message: 'An accepted decision snapshot is required.' },
    ])
  }
  if (session.proposalId !== proposal.id) {
    throw new ValidationError('Session does not belong to this proposal.', [
      { field: 'proposalId', message: 'Proposal and session do not match.' },
    ])
  }
  const proposalCompany =
    String(proposal.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
  const sessionCompany = String(session.companyId ?? '').trim()
  // Enforce company isolation when both sides declare a company.
  // Sessions for proposals without companyId may use a local/default tag.
  if (
    sessionCompany &&
    proposal.companyId &&
    sessionCompany !== proposalCompany
  ) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  if (
    session.shareToken &&
    proposal.shareToken &&
    session.shareToken !== proposal.shareToken
  ) {
    throw new ValidationError('Session does not belong to this share link.', [
      { field: 'shareToken', message: 'Share token and session do not match.' },
    ])
  }

  const snapshot = makeDecisionSnapshot(session.decisionSnapshot)
  if (!snapshot.acceptedAt) {
    throw new ValidationError('Acceptance timestamp is missing from the decision.', [
      { field: 'acceptedAt', message: 'acceptedAt is required on the decision snapshot.' },
    ])
  }
  if (snapshot.selectedTotal == null || !Number.isFinite(Number(snapshot.selectedTotal))) {
    throw new ValidationError('Commercial totals are missing from the decision.', [
      { field: 'selectedTotal', message: 'selectedTotal is required on the decision snapshot.' },
    ])
  }
  if (!snapshot.currency) {
    throw new ValidationError('Currency is missing from the decision.', [
      { field: 'currency', message: 'currency is required on the decision snapshot.' },
    ])
  }
  const hasRevision =
    snapshot.publicationId != null ||
    snapshot.proposalVersion != null ||
    snapshot.snapshotNumber != null
  if (!hasRevision) {
    throw new ValidationError('Revision identity is missing from the decision.', [
      {
        field: 'proposalVersion',
        message: 'publicationId, snapshotNumber, or proposalVersion is required.',
      },
    ])
  }

  return snapshot
}

function emitCloseOpenedEvent({ proposal, session, close, actorId }) {
  if (!proposal?.shareToken) return
  try {
    const record = insertLivingEngagementEvent(
      makeLivingEngagementEvent({
        companyId: close.companyId,
        proposalId: close.proposalId,
        shareToken: proposal.shareToken,
        type: LIVING_EVENT.CLOSE_OPENED,
        sessionId: session.id,
        metadata: {
          closeId: close.id,
          publicationId: close.decision.publicationId,
          snapshotNumber: close.decision.snapshotNumber,
          proposalVersion: close.decision.proposalVersion,
          source: 'commercial_close',
          actorId: actorId || null,
        },
        at: close.openedAt,
      }),
    )
    emitLivingEvent(LIVING_EVENT.CLOSE_OPENED, {
      proposalId: close.proposalId,
      shareToken: proposal.shareToken,
      sessionId: session.id,
      closeId: close.id,
      eventId: record.id,
    })
  } catch {
    // Audit emission is best-effort; close persistence is authoritative.
  }
}

/**
 * Studio: load close for a proposal (if any).
 */
export function getCommercialCloseForProposal({ companyId, proposalId, actor } = {}) {
  assertCapability()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewCommercialClose(user)) {
    throw new ForbiddenError('You do not have permission to view commercial closes.')
  }
  requireProposal(scoped, proposalId)
  const close = findCommercialCloseByProposal(proposalId, scoped)
  return {
    close: presentCommercialClose(close),
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}

/**
 * Studio: load close by id.
 */
export function getCommercialCloseById({ companyId, closeId, actor } = {}) {
  assertCapability()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewCommercialClose(user)) {
    throw new ForbiddenError('You do not have permission to view commercial closes.')
  }
  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }
  const close = findCommercialClose(id)
  if (!close || close.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }
  return {
    close: presentCommercialClose(close),
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}

/**
 * Create (or return existing) CommercialClose from the locked H14 decision.
 * Idempotent for the same session + acceptedAt.
 */
export function createCommercialCloseFromAcceptedDecision({
  companyId,
  proposalId,
  actor,
  sessionId,
} = {}) {
  assertCapability()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanCreateCommercialClose(user)) {
    throw new ForbiddenError('You do not have permission to open a commercial close.')
  }

  const proposal = requireProposal(scoped, proposalId)
  if (proposal.status !== PROPOSAL_STATUS.ACCEPTED) {
    throw new ValidationError('Proposal must be accepted before opening a commercial close.', [
      { field: 'status', message: 'Only accepted proposals can open a commercial close.' },
    ])
  }

  let session = null
  const requestedSessionId = String(sessionId ?? '').trim()
  if (requestedSessionId) {
    session = findLivingSession(requestedSessionId)
    if (!session) {
      throw new ValidationError('Living session not found.', [
        { field: 'sessionId', message: 'Living session not found.' },
      ])
    }
  } else {
    session = findLockedSessionForProposal(proposal.id, scoped)
  }

  const snapshot = assertValidCloseDecision(session, proposal)

  const existing = findCommercialCloseByDecision(
    session.id,
    snapshot.acceptedAt,
    scoped,
  )
  if (existing) {
    return {
      close: presentCommercialClose(existing),
      created: false,
      capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
    }
  }

  // Also treat one open close per proposal as the active close for H15.1.
  const byProposal = findCommercialCloseByProposal(proposal.id, scoped)
  if (byProposal && byProposal.status === COMMERCIAL_CLOSE_STATUS.OPEN) {
    if (
      byProposal.sessionId === session.id &&
      byProposal.decision?.acceptedAt === snapshot.acceptedAt
    ) {
      return {
        close: presentCommercialClose(byProposal),
        created: false,
        capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
      }
    }
    throw new ValidationError('An open commercial close already exists for this proposal.', [
      { field: 'status', message: 'Only one open commercial close is allowed per proposal.' },
    ])
  }

  const decision = makeCloseDecisionBinding({
    ...snapshot,
    proposalId: proposal.id,
    companyId: scoped,
    sessionId: session.id,
    decisionLocked: true,
  })

  const close = insertCommercialClose(
    makeCommercialClose({
      companyId: scoped,
      proposalId: proposal.id,
      sessionId: session.id,
      status: COMMERCIAL_CLOSE_STATUS.OPEN,
      decision,
      openedByActorId: user.id,
      openedAt: new Date().toISOString(),
    }),
  )

  emitCloseOpenedEvent({
    proposal,
    session,
    close,
    actorId: user.id,
  })

  return {
    close: presentCommercialClose(close),
    created: true,
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}

/**
 * Client read-only accepted-close summary via share token.
 * Never exposes actor ids, follow-ups, or workflow internals.
 */
export function getClientCommercialCloseSummary({ shareToken } = {}) {
  assertCapability()
  const token = String(shareToken ?? '').trim()
  if (!token) {
    throw new NotFoundError('This proposal is not available.')
  }
  const proposal = resolveLivingProposalByShareToken(token)
  if (!proposal || proposal.shareToken !== token) {
    throw new NotFoundError('This proposal is not available.')
  }
  if (proposal.status !== PROPOSAL_STATUS.ACCEPTED) {
    return { close: null, capabilities: { commercialCloseDomain: true } }
  }

  const session = findLivingSessionByShareToken(token)
  const company =
    String(proposal.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID

  let close = null
  if (session?.id && session.decisionSnapshot?.acceptedAt) {
    close = findCommercialCloseByDecision(
      session.id,
      session.decisionSnapshot.acceptedAt,
      company,
    )
  }
  if (!close) {
    close = findCommercialCloseByProposal(proposal.id, company)
  }

  return {
    close: presentClientCommercialClose(close),
    capabilities: {
      commercialCloseDomain: COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain,
      digitalSignature: false,
      paymentProcessing: false,
    },
  }
}

export function listProposalCommercialCloses({ companyId, proposalId, actor } = {}) {
  assertCapability()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanViewCommercialClose(user)) {
    throw new ForbiddenError('You do not have permission to view commercial closes.')
  }
  requireProposal(scoped, proposalId)
  return {
    closes: listCommercialClosesForProposal(proposalId, scoped).map((item) =>
      presentCommercialClose(item),
    ),
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}
