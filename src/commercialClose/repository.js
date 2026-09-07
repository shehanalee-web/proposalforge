import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { PROPOSAL_STATUS } from '../models/proposal.js'
import { resolveWorkflowActor } from '../workflow/actors.js'
import { makeLivingEngagementEvent } from '../living/eventSchema.js'
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
import { LIVING_EVENT } from '../living/types.js'
import {
  studioCanCreateCommercialClose,
  studioCanManageCommercialCloseContract,
  studioCanManageCommercialCloseInvoice,
  studioCanManageCommercialClosePayment,
  studioCanManageCommercialCloseSignature,
  studioCanTransitionCommercialClose,
  studioCanViewCommercialClose,
} from './permissions.js'
import {
  makeCloseDecisionBinding,
  makeCloseStatusHistoryEntry,
  makeCommercialClose,
  presentClientCommercialClose,
  presentCommercialClose,
} from './schema.js'
import {
  hasValidSignatureEvidence,
  makeCloseSignature,
  makeCloseSignatureBinding,
  makeCloseSignatureEvidence,
  makeCloseSignatureParty,
  makeCloseSignatureRequest,
  presentCloseSignature,
} from './signatureSchema.js'
import {
  hasValidPaymentEvidence,
  makeClosePaymentBinding,
  makeClosePaymentEvidence,
  makeClosePaymentFromDecision,
  makeClosePaymentRequest,
  presentClosePayment,
  resolveClosePaymentAmounts,
} from './paymentSchema.js'
import {
  makeCloseContractBinding,
  makeCloseContractFromDecision,
  makeCloseContractParty,
  makeCloseContractRecord,
  makeCloseContractRequest,
  presentCloseContract,
} from './contractSchema.js'
import {
  makeCloseInvoiceBinding,
  makeCloseInvoiceFromDecision,
  makeCloseInvoiceRecord,
  makeCloseInvoiceRequest,
  presentCloseInvoice,
} from './invoiceSchema.js'
import { reconcileCommercialCloseFollowup } from './signals.js'
import {
  findCommercialClose,
  findCommercialCloseByDecision,
  findCommercialCloseByProposal,
  insertCommercialClose,
  listCommercialClosesForProposal,
  replaceCommercialClose,
} from './store.js'
import {
  assertCommercialCloseTransition,
  allowedCommercialCloseTransitions,
} from './transitions.js'
import {
  CLOSE_CONTRACT_METHOD,
  CLOSE_CONTRACT_PARTY_ROLE,
  CLOSE_CONTRACT_STATUS,
  CLOSE_INVOICE_KIND,
  CLOSE_INVOICE_KINDS,
  CLOSE_INVOICE_METHOD,
  CLOSE_INVOICE_STATUS,
  CLOSE_PAYMENT_KIND,
  CLOSE_PAYMENT_KINDS,
  CLOSE_PAYMENT_METHOD,
  CLOSE_PAYMENT_STATUS,
  CLOSE_SIGNATURE_METHOD,
  CLOSE_SIGNATURE_PARTY_ROLE,
  CLOSE_SIGNATURE_STATUS,
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_EVENT,
  COMMERCIAL_CLOSE_STATUS,
  isTerminalCommercialCloseStatus,
} from './types.js'

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

function assertStateMachine() {
  assertCapability()
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine) {
    throw new ValidationError('Commercial close state machine is not enabled.', [
      {
        field: 'capabilities',
        message: 'commercialCloseStateMachine capability is off.',
      },
    ])
  }
}

function assertSignaturePath() {
  assertStateMachine()
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath) {
    throw new ValidationError('Commercial close signature path is not enabled.', [
      {
        field: 'capabilities',
        message: 'commercialCloseSignaturePath capability is off.',
      },
    ])
  }
}

function assertPaymentPath() {
  assertStateMachine()
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialClosePaymentPath) {
    throw new ValidationError('Commercial close payment path is not enabled.', [
      {
        field: 'capabilities',
        message: 'commercialClosePaymentPath capability is off.',
      },
    ])
  }
}

function assertContractPath() {
  assertStateMachine()
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseContractPath) {
    throw new ValidationError('Commercial close contract path is not enabled.', [
      {
        field: 'capabilities',
        message: 'commercialCloseContractPath capability is off.',
      },
    ])
  }
}

function assertInvoicePath() {
  assertStateMachine()
  if (!COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseInvoicePath) {
    throw new ValidationError('Commercial close invoice path is not enabled.', [
      {
        field: 'capabilities',
        message: 'commercialCloseInvoicePath capability is off.',
      },
    ])
  }
}

function bindingFromClose(close) {
  return makeCloseSignatureBinding({
    closeId: close.id,
    sessionId: close.sessionId,
    proposalId: close.proposalId,
    acceptedAt: close.decision?.acceptedAt,
    publicationId: close.decision?.publicationId,
    snapshotNumber: close.decision?.snapshotNumber,
    proposalVersion: close.decision?.proposalVersion,
  })
}

function paymentBindingFromClose(close) {
  return makeClosePaymentBinding({
    closeId: close.id,
    sessionId: close.sessionId,
    proposalId: close.proposalId,
    acceptedAt: close.decision?.acceptedAt,
    publicationId: close.decision?.publicationId,
    snapshotNumber: close.decision?.snapshotNumber,
    proposalVersion: close.decision?.proposalVersion,
  })
}

function contractBindingFromClose(close) {
  return makeCloseContractBinding({
    closeId: close.id,
    sessionId: close.sessionId,
    proposalId: close.proposalId,
    companyId: close.companyId,
    acceptedAt: close.decision?.acceptedAt,
    publicationId: close.decision?.publicationId,
    snapshotNumber: close.decision?.snapshotNumber,
    proposalVersion: close.decision?.proposalVersion,
  })
}

function invoiceBindingFromClose(close) {
  return makeCloseInvoiceBinding({
    closeId: close.id,
    sessionId: close.sessionId,
    proposalId: close.proposalId,
    companyId: close.companyId,
    acceptedAt: close.decision?.acceptedAt,
    publicationId: close.decision?.publicationId,
    snapshotNumber: close.decision?.snapshotNumber,
    proposalVersion: close.decision?.proposalVersion,
  })
}

function defaultClientParty(proposal) {
  return makeCloseSignatureParty({
    displayName: String(proposal?.clientName ?? '').trim() || 'Client',
    email: String(proposal?.clientEmail ?? '').trim(),
    role: CLOSE_SIGNATURE_PARTY_ROLE.CLIENT,
    required: true,
  })
}

function buildSignatureRequest(close, actorId, parties) {
  return makeCloseSignature({
    required: true,
    status: CLOSE_SIGNATURE_STATUS.PENDING,
    method: CLOSE_SIGNATURE_METHOD.INTERNAL,
    parties,
    request: makeCloseSignatureRequest({
      method: CLOSE_SIGNATURE_METHOD.INTERNAL,
      status: CLOSE_SIGNATURE_STATUS.PENDING,
      createdByActorId: actorId || null,
      binding: bindingFromClose(close),
    }),
    evidence: close.signature?.evidence ?? [],
    completedAt: null,
  })
}

function buildPaymentRequest(close, actorId, kind = CLOSE_PAYMENT_KIND.FULL) {
  const amounts = resolveClosePaymentAmounts(close.decision ?? {}, close.payment ?? {})
  return makeClosePaymentFromDecision(close, {
    required: true,
    status: CLOSE_PAYMENT_STATUS.PENDING,
    method: CLOSE_PAYMENT_METHOD.INTERNAL,
    kind: CLOSE_PAYMENT_KINDS.includes(kind) ? kind : CLOSE_PAYMENT_KIND.FULL,
    currency: amounts.currency,
    requiredAmount: amounts.requiredAmount,
    recordedAmount: amounts.recordedAmount,
    remainingAmount: amounts.remainingAmount,
    request: makeClosePaymentRequest({
      method: CLOSE_PAYMENT_METHOD.INTERNAL,
      status: CLOSE_PAYMENT_STATUS.PENDING,
      kind: CLOSE_PAYMENT_KINDS.includes(kind) ? kind : CLOSE_PAYMENT_KIND.FULL,
      currency: amounts.currency,
      requiredAmount: amounts.requiredAmount,
      remainingAmount: amounts.remainingAmount,
      createdByActorId: actorId || null,
      binding: paymentBindingFromClose(close),
    }),
    evidence: close.payment?.evidence ?? [],
    completedAt: null,
  })
}

function evidenceAlreadyRecorded(signature, input) {
  const list = signature?.evidence ?? []
  const legacyId = String(input.legacyProposalSignatureId ?? '').trim()
  const evidenceRef = String(input.evidenceRef ?? '').trim()
  if (legacyId && list.some((item) => item.legacyProposalSignatureId === legacyId)) {
    return true
  }
  if (evidenceRef && list.some((item) => item.evidenceRef === evidenceRef)) {
    return true
  }
  return false
}

function paymentEvidenceAlreadyRecorded(payment, input) {
  const list = payment?.evidence ?? []
  const legacyId = String(input.legacyProposalPaymentId ?? '').trim()
  const evidenceRef = String(input.evidenceRef ?? '').trim()
  const txn = String(input.transactionReference ?? '').trim()
  if (legacyId && list.some((item) => item.legacyProposalPaymentId === legacyId)) {
    return true
  }
  if (evidenceRef && list.some((item) => item.evidenceRef === evidenceRef)) {
    return true
  }
  if (txn && list.some((item) => item.transactionReference === txn)) {
    return true
  }
  return false
}

function emitSignatureEvent({ proposal, close, type, actorId, at, extra = {} }) {
  if (!proposal?.shareToken) return null
  try {
    const record = insertLivingEngagementEvent(
      makeLivingEngagementEvent({
        companyId: close.companyId,
        proposalId: close.proposalId,
        shareToken: proposal.shareToken,
        type,
        sessionId: close.sessionId,
        metadata: {
          closeId: close.id,
          source: 'commercial_close',
          method: CLOSE_SIGNATURE_METHOD.INTERNAL,
          actorId: actorId || null,
          ...extra,
        },
        at,
      }),
    )
    emitLivingEvent(type, {
      proposalId: close.proposalId,
      shareToken: proposal.shareToken,
      closeId: close.id,
      eventId: record.id,
    })
    return {
      id: record.id,
      type,
      at: record.at,
    }
  } catch {
    return null
  }
}

function emitPaymentEvent({ proposal, close, type, actorId, at, extra = {} }) {
  if (!proposal?.shareToken) return null
  try {
    const record = insertLivingEngagementEvent(
      makeLivingEngagementEvent({
        companyId: close.companyId,
        proposalId: close.proposalId,
        shareToken: proposal.shareToken,
        type,
        sessionId: close.sessionId,
        metadata: {
          closeId: close.id,
          source: 'commercial_close',
          method: CLOSE_PAYMENT_METHOD.INTERNAL,
          actorId: actorId || null,
          ...extra,
        },
        at,
      }),
    )
    emitLivingEvent(type, {
      proposalId: close.proposalId,
      shareToken: proposal.shareToken,
      closeId: close.id,
      eventId: record.id,
    })
    return {
      id: record.id,
      type,
      at: record.at,
    }
  } catch {
    return null
  }
}

function emitArtifactEvent({
  proposal,
  close,
  type,
  actorId,
  at,
  method,
  extra = {},
}) {
  if (!proposal?.shareToken) return null
  try {
    const record = insertLivingEngagementEvent(
      makeLivingEngagementEvent({
        companyId: close.companyId,
        proposalId: close.proposalId,
        shareToken: proposal.shareToken,
        type,
        sessionId: close.sessionId,
        metadata: {
          closeId: close.id,
          source: 'commercial_close',
          method: method || 'internal',
          actorId: actorId || null,
          ...extra,
        },
        at,
      }),
    )
    emitLivingEvent(type, {
      proposalId: close.proposalId,
      shareToken: proposal.shareToken,
      closeId: close.id,
      eventId: record.id,
    })
    return {
      id: record.id,
      type,
      at: record.at,
    }
  } catch {
    return null
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

function studioPayload(close) {
  return {
    close: presentCommercialClose(close),
    allowedTransitions: close
      ? allowedCommercialCloseTransitions(close.status)
      : [],
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
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

function emitCloseTransitionEvent({ proposal, close, from, to, actorId, at }) {
  if (!proposal?.shareToken) return null
  try {
    let type = LIVING_EVENT.CLOSE_STATE_CHANGED
    if (to === COMMERCIAL_CLOSE_STATUS.CLOSED) type = LIVING_EVENT.CLOSE_COMPLETED
    else if (to === COMMERCIAL_CLOSE_STATUS.CANCELLED) type = LIVING_EVENT.CLOSE_CANCELLED
    else if (to === COMMERCIAL_CLOSE_STATUS.EXPIRED) type = LIVING_EVENT.CLOSE_EXPIRED

    const record = insertLivingEngagementEvent(
      makeLivingEngagementEvent({
        companyId: close.companyId,
        proposalId: close.proposalId,
        shareToken: proposal.shareToken,
        type,
        sessionId: close.sessionId,
        metadata: {
          closeId: close.id,
          from,
          to,
          source: 'commercial_close',
          actorId: actorId || null,
        },
        at,
      }),
    )
    emitLivingEvent(type, {
      proposalId: close.proposalId,
      shareToken: proposal.shareToken,
      closeId: close.id,
      from,
      to,
      eventId: record.id,
    })
    return {
      id: record.id,
      type,
      from,
      to,
      at: record.at,
      event: COMMERCIAL_CLOSE_EVENT.STATE_CHANGED,
    }
  } catch {
    return null
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
  return studioPayload(close)
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
  return studioPayload(close)
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
      ...studioPayload(existing),
      created: false,
    }
  }

  const byProposal = findCommercialCloseByProposal(proposal.id, scoped)
  if (byProposal && !isTerminalCommercialCloseStatus(byProposal.status)) {
    if (
      byProposal.sessionId === session.id &&
      byProposal.decision?.acceptedAt === snapshot.acceptedAt
    ) {
      return {
        ...studioPayload(byProposal),
        created: false,
      }
    }
    throw new ValidationError('An active commercial close already exists for this proposal.', [
      { field: 'status', message: 'Only one active commercial close is allowed per proposal.' },
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
      statusHistory: [],
    }),
  )

  emitCloseOpenedEvent({
    proposal,
    session,
    close,
    actorId: user.id,
  })

  return {
    ...studioPayload(close),
    created: true,
  }
}

/**
 * Studio-only: transition commercial close status.
 * Never mutates proposal content or the immutable decision binding.
 * H15.3: transition to `signed` requires valid signature evidence.
 * H15.4: transition to `paid` requires valid payment evidence.
 */
export function transitionCommercialClose({
  companyId,
  closeId,
  actor,
  to,
} = {}) {
  assertStateMachine()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanTransitionCommercialClose(user)) {
    throw new ForbiddenError('You do not have permission to transition commercial closes.')
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }
  const target = String(to ?? '').trim()
  if (!target) {
    throw new ValidationError('Target status is required.', [
      { field: 'to', message: 'to is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  const from = existing.status
  assertCommercialCloseTransition(from, target)

  if (target === COMMERCIAL_CLOSE_STATUS.SIGNED) {
    assertSignaturePath()
    if (!hasValidSignatureEvidence(existing)) {
      throw new ValidationError(
        'Signed requires valid commercial-close signature evidence.',
        [
          {
            field: 'signature',
            message:
              'Complete an internal signature before transitioning to signed.',
          },
        ],
      )
    }
  }

  if (target === COMMERCIAL_CLOSE_STATUS.PAID) {
    assertPaymentPath()
    if (!hasValidPaymentEvidence(existing)) {
      throw new ValidationError(
        'Paid requires valid commercial-close payment evidence.',
        [
          {
            field: 'payment',
            message:
              'Record an internal payment before transitioning to paid.',
          },
        ],
      )
    }
  }

  // Decision binding must remain frozen.
  const decision = makeCloseDecisionBinding(existing.decision)
  const at = new Date().toISOString()
  const historyEntry = makeCloseStatusHistoryEntry({
    from,
    to: target,
    at,
    actorId: user.id,
  })

  let signature = makeCloseSignature(existing.signature)
  if (target === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING) {
    assertSignaturePath()
    const proposal = resolveLivingProposalById(existing.proposalId, scoped)
    if (
      !signature.request ||
      signature.status === CLOSE_SIGNATURE_STATUS.NOT_REQUESTED
    ) {
      signature = buildSignatureRequest(
        existing,
        user.id,
        signature.parties.length
          ? signature.parties
          : [defaultClientParty(proposal)],
      )
    } else {
      signature = makeCloseSignature({
        ...signature,
        required: true,
        status: CLOSE_SIGNATURE_STATUS.PENDING,
        method: CLOSE_SIGNATURE_METHOD.INTERNAL,
      })
    }
  }

  let payment = makeClosePaymentFromDecision(existing, existing.payment)
  if (target === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
    assertPaymentPath()
    if (
      !payment.request ||
      payment.status === CLOSE_PAYMENT_STATUS.NOT_REQUESTED
    ) {
      payment = buildPaymentRequest(existing, user.id, payment.kind)
    } else {
      payment = makeClosePaymentFromDecision(existing, {
        ...payment,
        required: true,
        status: CLOSE_PAYMENT_STATUS.PENDING,
        method: CLOSE_PAYMENT_METHOD.INTERNAL,
      })
    }
  }

  const patch = {
    ...existing,
    decision,
    signature,
    payment,
    status: target,
    statusHistory: [...existing.statusHistory, historyEntry],
    lastTransitionAt: at,
    lastTransitionByActorId: user.id,
    updatedAt: at,
  }
  if (target === COMMERCIAL_CLOSE_STATUS.CLOSED) patch.closedAt = at
  if (target === COMMERCIAL_CLOSE_STATUS.CANCELLED) patch.cancelledAt = at
  if (target === COMMERCIAL_CLOSE_STATUS.EXPIRED) patch.expiredAt = at

  const saved = replaceCommercialClose(existing.id, makeCommercialClose(patch))
  const proposal = resolveLivingProposalById(saved.proposalId, scoped)
  const transition = emitCloseTransitionEvent({
    proposal,
    close: saved,
    from,
    to: target,
    actorId: user.id,
    at,
  })

  if (target === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING) {
    emitSignatureEvent({
      proposal,
      close: saved,
      type: LIVING_EVENT.SIGNATURE_REQUESTED,
      actorId: user.id,
      at,
      extra: { requestId: saved.signature?.request?.id || null },
    })
  }

  if (target === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
    emitPaymentEvent({
      proposal,
      close: saved,
      type: LIVING_EVENT.PAYMENT_REQUESTED,
      actorId: user.id,
      at,
      extra: {
        requestId: saved.payment?.request?.id || null,
        requiredAmount: saved.payment?.requiredAmount,
        currency: saved.payment?.currency,
      },
    })
  }

  reconcileCommercialCloseFollowup({
    companyId: scoped,
    proposalId: saved.proposalId,
    closeId: saved.id,
    status: target,
    ownerActorId: user.id,
    now: at,
  })

  return {
    ...studioPayload(saved),
    transition: {
      from,
      to: target,
      at,
      actorId: user.id,
      event: transition,
    },
  }
}

/**
 * Public clients must never transition commercial close state.
 */
export function clientCommercialCloseTransitionDenied() {
  throw new ForbiddenError('Commercial close transitions are studio-only.')
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
      commercialCloseStateMachine: COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine,
      commercialCloseSignaturePath: COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath,
      commercialClosePaymentPath: COMMERCIAL_CLOSE_CAPABILITIES.commercialClosePaymentPath,
      digitalSignature: false,
      signatureVendors: false,
      paymentProcessing: false,
      paymentVendors: false,
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

/**
 * Apply internal signature evidence and move close toward signed.
 * Shared by studio complete + client bridge. Does not write proposals.json.
 *
 * @param {object} existing
 * @param {{
 *   signerDisplayName: string,
 *   signedAt?: string,
 *   evidenceRef?: string | null,
 *   legacyProposalSignatureId?: string | null,
 *   signerActorId?: string | null,
 *   transitionActorId?: string | null,
 * }} evidenceInput
 */
function applyInternalEvidenceAndSign(existing, evidenceInput) {
  const signerDisplayName = String(evidenceInput.signerDisplayName ?? '').trim()
  if (!signerDisplayName) {
    throw new ValidationError('Signer display name is required.', [
      { field: 'signerDisplayName', message: 'A signer name is required.' },
    ])
  }

  if (hasValidSignatureEvidence(existing)) {
    return {
      close: existing,
      created: false,
      duplicate: true,
    }
  }

  if (evidenceAlreadyRecorded(existing.signature, evidenceInput)) {
    throw new ValidationError('Signature evidence already recorded for this request.', [
      { field: 'evidence', message: 'Duplicate signature evidence is not allowed.' },
    ])
  }

  const at = asIsoOrNow(evidenceInput.signedAt)
  let working = existing
  const proposal = resolveLivingProposalById(working.proposalId, working.companyId)

  // Ensure a signature request exists (open → signature_pending).
  if (working.status === COMMERCIAL_CLOSE_STATUS.OPEN) {
    assertCommercialCloseTransition(
      working.status,
      COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
    )
    const signature = buildSignatureRequest(
      working,
      evidenceInput.transitionActorId || null,
      working.signature?.parties?.length
        ? working.signature.parties
        : [defaultClientParty(proposal)],
    )
    const historyEntry = makeCloseStatusHistoryEntry({
      from: working.status,
      to: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
      at,
      actorId: evidenceInput.transitionActorId || null,
    })
    working = replaceCommercialClose(
      working.id,
      makeCommercialClose({
        ...working,
        decision: makeCloseDecisionBinding(working.decision),
        signature,
        status: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
        statusHistory: [...working.statusHistory, historyEntry],
        lastTransitionAt: at,
        lastTransitionByActorId: evidenceInput.transitionActorId || null,
        updatedAt: at,
      }),
    )
    emitCloseTransitionEvent({
      proposal,
      close: working,
      from: COMMERCIAL_CLOSE_STATUS.OPEN,
      to: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
      actorId: evidenceInput.transitionActorId || null,
      at,
    })
    emitSignatureEvent({
      proposal,
      close: working,
      type: LIVING_EVENT.SIGNATURE_REQUESTED,
      actorId: evidenceInput.transitionActorId || null,
      at,
      extra: { requestId: working.signature?.request?.id || null },
    })
    reconcileCommercialCloseFollowup({
      companyId: working.companyId,
      proposalId: working.proposalId,
      closeId: working.id,
      status: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
      ownerActorId: evidenceInput.transitionActorId || undefined,
      now: at,
    })
  }

  if (working.status !== COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING) {
    throw new ValidationError('Commercial close is not awaiting signature.', [
      {
        field: 'status',
        message: `Cannot record signature while status is ${working.status}.`,
      },
    ])
  }

  const evidence = makeCloseSignatureEvidence({
    signerActorId: evidenceInput.signerActorId || null,
    signerDisplayName,
    signedAt: at,
    method: CLOSE_SIGNATURE_METHOD.INTERNAL,
    evidenceRef: evidenceInput.evidenceRef || null,
    legacyProposalSignatureId: evidenceInput.legacyProposalSignatureId || null,
    binding: bindingFromClose(working),
  })

  const signature = makeCloseSignature({
    ...working.signature,
    required: true,
    status: CLOSE_SIGNATURE_STATUS.COMPLETED,
    method: CLOSE_SIGNATURE_METHOD.INTERNAL,
    parties:
      working.signature?.parties?.length > 0
        ? working.signature.parties
        : [defaultClientParty(proposal)],
    request:
      working.signature?.request ||
      makeCloseSignatureRequest({
        method: CLOSE_SIGNATURE_METHOD.INTERNAL,
        status: CLOSE_SIGNATURE_STATUS.COMPLETED,
        createdByActorId: evidenceInput.transitionActorId || null,
        binding: bindingFromClose(working),
      }),
    evidence: [...(working.signature?.evidence ?? []), evidence],
    completedAt: at,
  })

  assertCommercialCloseTransition(
    working.status,
    COMMERCIAL_CLOSE_STATUS.SIGNED,
  )

  const historyEntry = makeCloseStatusHistoryEntry({
    from: working.status,
    to: COMMERCIAL_CLOSE_STATUS.SIGNED,
    at,
    actorId: evidenceInput.transitionActorId || null,
  })

  const saved = replaceCommercialClose(
    working.id,
    makeCommercialClose({
      ...working,
      decision: makeCloseDecisionBinding(working.decision),
      signature,
      status: COMMERCIAL_CLOSE_STATUS.SIGNED,
      statusHistory: [...working.statusHistory, historyEntry],
      lastTransitionAt: at,
      lastTransitionByActorId: evidenceInput.transitionActorId || null,
      updatedAt: at,
    }),
  )

  emitCloseTransitionEvent({
    proposal,
    close: saved,
    from: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
    to: COMMERCIAL_CLOSE_STATUS.SIGNED,
    actorId: evidenceInput.transitionActorId || null,
    at,
  })
  emitSignatureEvent({
    proposal,
    close: saved,
    type: LIVING_EVENT.SIGNATURE_COMPLETED,
    actorId: evidenceInput.transitionActorId || null,
    at,
    extra: {
      evidenceId: evidence.id,
      method: CLOSE_SIGNATURE_METHOD.INTERNAL,
    },
  })
  reconcileCommercialCloseFollowup({
    companyId: saved.companyId,
    proposalId: saved.proposalId,
    closeId: saved.id,
    status: COMMERCIAL_CLOSE_STATUS.SIGNED,
    ownerActorId: evidenceInput.transitionActorId || undefined,
    now: at,
  })

  return {
    close: saved,
    created: true,
    duplicate: false,
    evidence,
  }
}

function asIsoOrNow(value) {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

/**
 * Studio: create/update signature request and move to signature_pending.
 */
export function requestCommercialCloseSignature({
  companyId,
  closeId,
  actor,
  parties,
} = {}) {
  assertSignaturePath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialCloseSignature(user)) {
    throw new ForbiddenError(
      'You do not have permission to request commercial-close signatures.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  if (
    existing.status !== COMMERCIAL_CLOSE_STATUS.OPEN &&
    existing.status !== COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING
  ) {
    throw new ValidationError('Signature can only be requested from open or pending.', [
      {
        field: 'status',
        message: `Cannot request signature while status is ${existing.status}.`,
      },
    ])
  }

  if (Array.isArray(parties) && parties.length > 0) {
    const nextParties = parties.map((party) => makeCloseSignatureParty(party))
    const signature = buildSignatureRequest(existing, user.id, nextParties)
    replaceCommercialClose(
      existing.id,
      makeCommercialClose({
        ...existing,
        decision: makeCloseDecisionBinding(existing.decision),
        signature,
        updatedAt: new Date().toISOString(),
      }),
    )
  } else if (existing.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING) {
    return {
      ...studioPayload(existing),
      created: false,
    }
  }

  if (existing.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING) {
    const refreshed = findCommercialClose(existing.id)
    return {
      ...studioPayload(refreshed),
      created: false,
    }
  }

  return transitionCommercialClose({
    companyId: scoped,
    closeId: existing.id,
    actor: user,
    to: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
  })
}

/**
 * Studio: record internal signature evidence and transition to signed.
 */
export function completeInternalCommercialCloseSignature({
  companyId,
  closeId,
  actor,
  signerDisplayName,
  signedAt,
  evidenceRef,
  legacyProposalSignatureId,
} = {}) {
  assertSignaturePath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialCloseSignature(user)) {
    throw new ForbiddenError(
      'You do not have permission to complete commercial-close signatures.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  const provided =
    signerDisplayName === undefined || signerDisplayName === null
      ? null
      : String(signerDisplayName).trim()
  const name = provided || String(user.name ?? '').trim()
  if (!name) {
    throw new ValidationError('Signer display name is required.', [
      { field: 'signerDisplayName', message: 'A signer name is required.' },
    ])
  }
  // Explicit empty string is rejected even when the actor has a name.
  if (signerDisplayName != null && !String(signerDisplayName).trim()) {
    throw new ValidationError('Signer display name is required.', [
      { field: 'signerDisplayName', message: 'A signer name is required.' },
    ])
  }

  const result = applyInternalEvidenceAndSign(existing, {
    signerDisplayName: name,
    signedAt,
    evidenceRef,
    legacyProposalSignatureId,
    signerActorId: user.id,
    transitionActorId: user.id,
  })

  return {
    ...studioPayload(result.close),
    created: result.created,
    duplicate: result.duplicate,
    evidence: result.evidence
      ? presentCloseSignature(result.close.signature)?.evidence?.slice(-1)?.[0]
      : null,
  }
}

/**
 * Client bridge entry: record internal signature without studio actor auth.
 * Token-scoped callers must already have validated the share action.
 * Never writes proposals.json.
 */
export function recordClientBridgeSignature({
  companyId,
  proposalId,
  signerDisplayName,
  signedAt,
  evidenceRef,
  legacyProposalSignatureId,
} = {}) {
  assertSignaturePath()
  const scoped = scopedCompany(companyId)
  const pid = String(proposalId ?? '').trim()
  if (!pid) return null

  const closes = listCommercialClosesForProposal(pid, scoped)
  const active =
    closes.find(
      (item) =>
        !isTerminalCommercialCloseStatus(item.status) &&
        (item.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
          item.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING),
    ) ?? null

  if (!active) {
    const alreadySigned = closes.find(
      (item) =>
        item.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
        hasValidSignatureEvidence(item),
    )
    if (alreadySigned) {
      return {
        close: presentClientCommercialClose(alreadySigned),
        created: false,
        duplicate: true,
      }
    }
    return null
  }

  const result = applyInternalEvidenceAndSign(active, {
    signerDisplayName,
    signedAt,
    evidenceRef,
    legacyProposalSignatureId,
    signerActorId: null,
    transitionActorId: null,
  })

  return {
    close: presentClientCommercialClose(result.close),
    created: result.created,
    duplicate: result.duplicate,
  }
}

/**
 * Studio: retrieve signature evidence for a close.
 */
export function getCommercialCloseSignature({ companyId, closeId, actor } = {}) {
  assertSignaturePath()
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
    signature: presentCloseSignature(close.signature),
    closeId: close.id,
    status: close.status,
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}

/**
 * Apply internal payment evidence and move close toward paid.
 * Shared by studio complete + client bridge. Does not write proposals.json.
 * Amounts are anchored to the immutable CommercialClose decision.
 *
 * @param {object} existing
 * @param {{
 *   payerDisplayName?: string,
 *   payerReference?: string,
 *   amount?: number,
 *   currency?: string,
 *   paidAt?: string,
 *   kind?: string,
 *   transactionReference?: string | null,
 *   evidenceRef?: string | null,
 *   legacyProposalPaymentId?: string | null,
 *   payerActorId?: string | null,
 *   transitionActorId?: string | null,
 * }} evidenceInput
 */
function applyInternalPaymentEvidenceAndPay(existing, evidenceInput) {
  if (hasValidPaymentEvidence(existing)) {
    return {
      close: existing,
      created: false,
      duplicate: true,
    }
  }

  if (paymentEvidenceAlreadyRecorded(existing.payment, evidenceInput)) {
    throw new ValidationError('Payment evidence already recorded for this request.', [
      { field: 'evidence', message: 'Duplicate payment evidence is not allowed.' },
    ])
  }

  const at = asIsoOrNow(evidenceInput.paidAt)
  let working = existing
  const proposal = resolveLivingProposalById(working.proposalId, working.companyId)
  const decisionAmounts = resolveClosePaymentAmounts(
    working.decision ?? {},
    working.payment ?? {},
  )

  // Ensure a payment request exists (signed|open → payment_pending).
  if (
    working.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
    working.status === COMMERCIAL_CLOSE_STATUS.SIGNED
  ) {
    assertCommercialCloseTransition(
      working.status,
      COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
    )
    const fromStatus = working.status
    const kind = CLOSE_PAYMENT_KINDS.includes(evidenceInput.kind)
      ? evidenceInput.kind
      : CLOSE_PAYMENT_KIND.FULL
    const payment = buildPaymentRequest(
      working,
      evidenceInput.transitionActorId || null,
      kind,
    )
    const historyEntry = makeCloseStatusHistoryEntry({
      from: fromStatus,
      to: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
      at,
      actorId: evidenceInput.transitionActorId || null,
    })
    working = replaceCommercialClose(
      working.id,
      makeCommercialClose({
        ...working,
        decision: makeCloseDecisionBinding(working.decision),
        signature: makeCloseSignature(working.signature),
        payment,
        status: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
        statusHistory: [...working.statusHistory, historyEntry],
        lastTransitionAt: at,
        lastTransitionByActorId: evidenceInput.transitionActorId || null,
        updatedAt: at,
      }),
    )
    emitCloseTransitionEvent({
      proposal,
      close: working,
      from: fromStatus,
      to: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
      actorId: evidenceInput.transitionActorId || null,
      at,
    })
    emitPaymentEvent({
      proposal,
      close: working,
      type: LIVING_EVENT.PAYMENT_REQUESTED,
      actorId: evidenceInput.transitionActorId || null,
      at,
      extra: {
        requestId: working.payment?.request?.id || null,
        requiredAmount: working.payment?.requiredAmount,
        currency: working.payment?.currency,
      },
    })
    reconcileCommercialCloseFollowup({
      companyId: working.companyId,
      proposalId: working.proposalId,
      closeId: working.id,
      status: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
      ownerActorId: evidenceInput.transitionActorId || undefined,
      now: at,
    })
  }

  if (working.status !== COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
    throw new ValidationError('Commercial close is not awaiting payment.', [
      {
        field: 'status',
        message: `Cannot record payment while status is ${working.status}.`,
      },
    ])
  }

  const amounts = resolveClosePaymentAmounts(
    working.decision ?? {},
    working.payment ?? {},
  )
  const providedAmount =
    evidenceInput.amount == null || evidenceInput.amount === ''
      ? amounts.remainingAmount
      : Number(evidenceInput.amount)
  if (!Number.isFinite(providedAmount) || providedAmount <= 0) {
    throw new ValidationError('Payment amount must be a positive number.', [
      { field: 'amount', message: 'A positive payment amount is required.' },
    ])
  }

  const currency =
    amounts.currency ||
    String(evidenceInput.currency ?? '').trim() ||
    'USD'
  if (
    evidenceInput.currency != null &&
    String(evidenceInput.currency).trim() &&
    String(evidenceInput.currency).trim() !== currency
  ) {
    throw new ValidationError('Payment currency must match the close decision.', [
      {
        field: 'currency',
        message: `Expected ${currency} from the locked commercial decision.`,
      },
    ])
  }

  // Reject amounts that invent a different commercial total than the decision.
  if (providedAmount - amounts.remainingAmount > 1e-9) {
    throw new ValidationError(
      'Payment amount cannot exceed the remaining decision total.',
      [
        {
          field: 'amount',
          message: `Remaining amount bound to the decision is ${amounts.remainingAmount}.`,
        },
      ],
    )
  }

  const payerDisplayName =
    String(evidenceInput.payerDisplayName ?? '').trim() ||
    String(proposal?.clientName ?? '').trim() ||
    'Client'

  const kind = CLOSE_PAYMENT_KINDS.includes(evidenceInput.kind)
    ? evidenceInput.kind
    : working.payment?.kind || CLOSE_PAYMENT_KIND.FULL

  const evidence = makeClosePaymentEvidence({
    payerActorId: evidenceInput.payerActorId || null,
    payerDisplayName,
    payerReference: evidenceInput.payerReference || '',
    amount: providedAmount,
    currency,
    paidAt: at,
    method: CLOSE_PAYMENT_METHOD.INTERNAL,
    kind,
    transactionReference: evidenceInput.transactionReference || '',
    evidenceRef: evidenceInput.evidenceRef || null,
    legacyProposalPaymentId: evidenceInput.legacyProposalPaymentId || null,
    valid: true,
    binding: paymentBindingFromClose(working),
  })

  const nextEvidence = [...(working.payment?.evidence ?? []), evidence]
  const nextAmounts = resolveClosePaymentAmounts(working.decision ?? {}, {
    evidence: nextEvidence,
  })

  // H15.4: require full settlement against the decision total before paid.
  if (nextAmounts.remainingAmount > 1e-9) {
    const payment = makeClosePaymentFromDecision(working, {
      ...working.payment,
      required: true,
      status: CLOSE_PAYMENT_STATUS.PENDING,
      method: CLOSE_PAYMENT_METHOD.INTERNAL,
      kind,
      currency: nextAmounts.currency,
      requiredAmount: nextAmounts.requiredAmount,
      recordedAmount: nextAmounts.recordedAmount,
      remainingAmount: nextAmounts.remainingAmount,
      request:
        working.payment?.request ||
        makeClosePaymentRequest({
          method: CLOSE_PAYMENT_METHOD.INTERNAL,
          status: CLOSE_PAYMENT_STATUS.PENDING,
          kind,
          currency: nextAmounts.currency,
          requiredAmount: nextAmounts.requiredAmount,
          remainingAmount: nextAmounts.remainingAmount,
          createdByActorId: evidenceInput.transitionActorId || null,
          binding: paymentBindingFromClose(working),
        }),
      evidence: nextEvidence,
      completedAt: null,
    })
    const savedPartial = replaceCommercialClose(
      working.id,
      makeCommercialClose({
        ...working,
        decision: makeCloseDecisionBinding(working.decision),
        signature: makeCloseSignature(working.signature),
        payment,
        updatedAt: at,
      }),
    )
    return {
      close: savedPartial,
      created: true,
      duplicate: false,
      evidence,
      settled: false,
    }
  }

  const payment = makeClosePaymentFromDecision(working, {
    ...working.payment,
    required: true,
    status: CLOSE_PAYMENT_STATUS.COMPLETED,
    method: CLOSE_PAYMENT_METHOD.INTERNAL,
    kind,
    currency: nextAmounts.currency,
    requiredAmount: nextAmounts.requiredAmount,
    recordedAmount: nextAmounts.recordedAmount,
    remainingAmount: 0,
    request:
      working.payment?.request ||
      makeClosePaymentRequest({
        method: CLOSE_PAYMENT_METHOD.INTERNAL,
        status: CLOSE_PAYMENT_STATUS.COMPLETED,
        kind,
        currency: nextAmounts.currency,
        requiredAmount: nextAmounts.requiredAmount,
        remainingAmount: 0,
        createdByActorId: evidenceInput.transitionActorId || null,
        binding: paymentBindingFromClose(working),
      }),
    evidence: nextEvidence,
    completedAt: at,
  })

  assertCommercialCloseTransition(
    working.status,
    COMMERCIAL_CLOSE_STATUS.PAID,
  )

  const historyEntry = makeCloseStatusHistoryEntry({
    from: working.status,
    to: COMMERCIAL_CLOSE_STATUS.PAID,
    at,
    actorId: evidenceInput.transitionActorId || null,
  })

  const saved = replaceCommercialClose(
    working.id,
    makeCommercialClose({
      ...working,
      decision: makeCloseDecisionBinding(working.decision),
      signature: makeCloseSignature(working.signature),
      payment,
      status: COMMERCIAL_CLOSE_STATUS.PAID,
      statusHistory: [...working.statusHistory, historyEntry],
      lastTransitionAt: at,
      lastTransitionByActorId: evidenceInput.transitionActorId || null,
      updatedAt: at,
    }),
  )

  emitCloseTransitionEvent({
    proposal,
    close: saved,
    from: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
    to: COMMERCIAL_CLOSE_STATUS.PAID,
    actorId: evidenceInput.transitionActorId || null,
    at,
  })
  emitPaymentEvent({
    proposal,
    close: saved,
    type: LIVING_EVENT.PAYMENT_COMPLETED,
    actorId: evidenceInput.transitionActorId || null,
    at,
    extra: {
      evidenceId: evidence.id,
      method: CLOSE_PAYMENT_METHOD.INTERNAL,
      amount: evidence.amount,
      currency: evidence.currency,
      requiredAmount: decisionAmounts.requiredAmount,
    },
  })
  reconcileCommercialCloseFollowup({
    companyId: saved.companyId,
    proposalId: saved.proposalId,
    closeId: saved.id,
    status: COMMERCIAL_CLOSE_STATUS.PAID,
    ownerActorId: evidenceInput.transitionActorId || undefined,
    now: at,
  })

  return {
    close: saved,
    created: true,
    duplicate: false,
    evidence,
    settled: true,
  }
}

/**
 * Studio: create/update payment request and move to payment_pending.
 */
export function requestCommercialClosePayment({
  companyId,
  closeId,
  actor,
  kind,
} = {}) {
  assertPaymentPath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialClosePayment(user)) {
    throw new ForbiddenError(
      'You do not have permission to request commercial-close payments.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  if (
    existing.status !== COMMERCIAL_CLOSE_STATUS.OPEN &&
    existing.status !== COMMERCIAL_CLOSE_STATUS.SIGNED &&
    existing.status !== COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING
  ) {
    throw new ValidationError(
      'Payment can only be requested from open, signed, or payment pending.',
      [
        {
          field: 'status',
          message: `Cannot request payment while status is ${existing.status}.`,
        },
      ],
    )
  }

  const nextKind = CLOSE_PAYMENT_KINDS.includes(kind)
    ? kind
    : existing.payment?.kind || CLOSE_PAYMENT_KIND.FULL

  if (existing.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING) {
    const payment = buildPaymentRequest(existing, user.id, nextKind)
    const refreshed = replaceCommercialClose(
      existing.id,
      makeCommercialClose({
        ...existing,
        decision: makeCloseDecisionBinding(existing.decision),
        signature: makeCloseSignature(existing.signature),
        payment,
        updatedAt: new Date().toISOString(),
      }),
    )
    return {
      ...studioPayload(refreshed),
      created: false,
    }
  }

  // Seed request fields before transition so payment_pending carries them.
  const seeded = replaceCommercialClose(
    existing.id,
    makeCommercialClose({
      ...existing,
      decision: makeCloseDecisionBinding(existing.decision),
      signature: makeCloseSignature(existing.signature),
      payment: buildPaymentRequest(existing, user.id, nextKind),
      updatedAt: new Date().toISOString(),
    }),
  )

  return transitionCommercialClose({
    companyId: scoped,
    closeId: seeded.id,
    actor: user,
    to: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
  })
}

/**
 * Studio: record internal payment evidence and transition to paid when settled.
 */
export function completeInternalCommercialClosePayment({
  companyId,
  closeId,
  actor,
  payerDisplayName,
  payerReference,
  amount,
  currency,
  paidAt,
  kind,
  transactionReference,
  evidenceRef,
  legacyProposalPaymentId,
} = {}) {
  assertPaymentPath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialClosePayment(user)) {
    throw new ForbiddenError(
      'You do not have permission to complete commercial-close payments.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  const providedName =
    payerDisplayName === undefined || payerDisplayName === null
      ? null
      : String(payerDisplayName).trim()
  if (payerDisplayName != null && !String(payerDisplayName).trim()) {
    throw new ValidationError('Payer display name is required.', [
      { field: 'payerDisplayName', message: 'A payer name is required.' },
    ])
  }

  const result = applyInternalPaymentEvidenceAndPay(existing, {
    payerDisplayName:
      providedName || String(user.name ?? '').trim() || undefined,
    payerReference,
    amount,
    currency,
    paidAt,
    kind,
    transactionReference,
    evidenceRef,
    legacyProposalPaymentId,
    payerActorId: user.id,
    transitionActorId: user.id,
  })

  return {
    ...studioPayload(result.close),
    created: result.created,
    duplicate: result.duplicate,
    settled: result.settled !== false,
    evidence: result.evidence
      ? presentClosePayment(result.close.payment)?.evidence?.slice(-1)?.[0]
      : null,
  }
}

/**
 * Client bridge entry: record internal payment without studio actor auth.
 * Token-scoped callers must already have validated the share action.
 * Never writes proposals.json.
 */
export function recordClientBridgePayment({
  companyId,
  proposalId,
  payerDisplayName,
  payerReference,
  amount,
  currency,
  paidAt,
  kind,
  transactionReference,
  evidenceRef,
  legacyProposalPaymentId,
} = {}) {
  assertPaymentPath()
  const scoped = scopedCompany(companyId)
  const pid = String(proposalId ?? '').trim()
  if (!pid) return null

  const closes = listCommercialClosesForProposal(pid, scoped)
  const active =
    closes.find(
      (item) =>
        !isTerminalCommercialCloseStatus(item.status) &&
        (item.status === COMMERCIAL_CLOSE_STATUS.OPEN ||
          item.status === COMMERCIAL_CLOSE_STATUS.SIGNED ||
          item.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING),
    ) ?? null

  if (!active) {
    const alreadyPaid = closes.find(
      (item) =>
        (item.status === COMMERCIAL_CLOSE_STATUS.PAID ||
          item.status === COMMERCIAL_CLOSE_STATUS.CLOSED) &&
        hasValidPaymentEvidence(item),
    )
    if (alreadyPaid) {
      return {
        close: presentClientCommercialClose(alreadyPaid),
        created: false,
        duplicate: true,
      }
    }
    return null
  }

  const result = applyInternalPaymentEvidenceAndPay(active, {
    payerDisplayName,
    payerReference,
    amount,
    currency,
    paidAt,
    kind,
    transactionReference,
    evidenceRef,
    legacyProposalPaymentId,
    payerActorId: null,
    transitionActorId: null,
  })

  return {
    close: presentClientCommercialClose(result.close),
    created: result.created,
    duplicate: result.duplicate,
    settled: result.settled !== false,
  }
}

/**
 * Studio: retrieve payment evidence for a close.
 */
export function getCommercialClosePayment({ companyId, closeId, actor } = {}) {
  assertPaymentPath()
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
    payment: presentClosePayment(close.payment),
    closeId: close.id,
    status: close.status,
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}

function shortArtifactSuffix(closeId) {
  const raw = String(closeId ?? '').replace(/[^a-zA-Z0-9]/g, '')
  return (raw.slice(-6) || 'close').toUpperCase()
}

function buildContractRequest(close, actorId) {
  return makeCloseContractFromDecision(close, {
    required: true,
    status: CLOSE_CONTRACT_STATUS.DRAFT,
    method: CLOSE_CONTRACT_METHOD.INTERNAL,
    request: makeCloseContractRequest({
      method: CLOSE_CONTRACT_METHOD.INTERNAL,
      status: CLOSE_CONTRACT_STATUS.DRAFT,
      createdByActorId: actorId || null,
      binding: contractBindingFromClose(close),
    }),
    record: close.contract?.record ?? null,
    completedAt: null,
  })
}

function buildInvoiceRequest(close, actorId, kind = CLOSE_INVOICE_KIND.FULL) {
  const amounts = resolveClosePaymentAmounts(close.decision ?? {}, close.payment ?? {})
  const nextKind = CLOSE_INVOICE_KINDS.includes(kind) ? kind : CLOSE_INVOICE_KIND.FULL
  return makeCloseInvoiceFromDecision(close, {
    required: true,
    status: CLOSE_INVOICE_STATUS.DRAFT,
    method: CLOSE_INVOICE_METHOD.INTERNAL,
    kind: nextKind,
    request: makeCloseInvoiceRequest({
      method: CLOSE_INVOICE_METHOD.INTERNAL,
      status: CLOSE_INVOICE_STATUS.DRAFT,
      kind: nextKind,
      currency: amounts.currency,
      total: amounts.requiredAmount,
      createdByActorId: actorId || null,
      binding: invoiceBindingFromClose(close),
    }),
    record: close.invoice?.record ?? null,
    completedAt: null,
  })
}

/**
 * Studio: create/update contract draft request (no state-machine change).
 */
export function requestCommercialCloseContract({ companyId, closeId, actor } = {}) {
  assertContractPath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialCloseContract(user)) {
    throw new ForbiddenError(
      'You do not have permission to manage commercial-close contracts.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  if (isTerminalCommercialCloseStatus(existing.status)) {
    throw new ValidationError('Cannot request a contract on a terminal close.', [
      {
        field: 'status',
        message: `Cannot request contract while status is ${existing.status}.`,
      },
    ])
  }

  if (existing.contract?.status === CLOSE_CONTRACT_STATUS.ISSUED && existing.contract?.record) {
    return {
      ...studioPayload(existing),
      created: false,
      duplicate: true,
    }
  }

  const at = new Date().toISOString()
  const refreshed = replaceCommercialClose(
    existing.id,
    makeCommercialClose({
      ...existing,
      decision: makeCloseDecisionBinding(existing.decision),
      signature: makeCloseSignature(existing.signature),
      payment: makeClosePaymentFromDecision(existing, existing.payment),
      contract: buildContractRequest(existing, user.id),
      invoice: makeCloseInvoiceFromDecision(existing, existing.invoice),
      updatedAt: at,
    }),
  )

  return {
    ...studioPayload(refreshed),
    created: existing.contract?.status === CLOSE_CONTRACT_STATUS.NOT_REQUESTED,
    duplicate: false,
  }
}

/**
 * Studio: issue an immutable contractual-close record bound to the decision.
 */
export function issueCommercialCloseContract({
  companyId,
  closeId,
  actor,
  number,
  title,
  parties,
  effectiveAt,
} = {}) {
  assertContractPath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialCloseContract(user)) {
    throw new ForbiddenError(
      'You do not have permission to manage commercial-close contracts.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  if (isTerminalCommercialCloseStatus(existing.status)) {
    throw new ValidationError('Cannot issue a contract on a terminal close.', [
      {
        field: 'status',
        message: `Cannot issue contract while status is ${existing.status}.`,
      },
    ])
  }

  if (existing.contract?.status === CLOSE_CONTRACT_STATUS.ISSUED && existing.contract?.record) {
    return {
      ...studioPayload(existing),
      created: false,
      duplicate: true,
      contract: presentCloseContract(existing.contract),
    }
  }

  const proposal = requireProposal(scoped, existing.proposalId)
  const at = new Date().toISOString()
  const decisionTotal =
    existing.decision?.selectedTotal != null &&
    Number.isFinite(Number(existing.decision.selectedTotal))
      ? Number(existing.decision.selectedTotal)
      : 0
  const currency = String(existing.decision?.currency ?? 'USD').trim() || 'USD'

  const nextParties = Array.isArray(parties) && parties.length
    ? parties.map((party) => makeCloseContractParty(party))
    : [
        makeCloseContractParty({
          displayName: String(proposal?.clientName ?? '').trim() || 'Client',
          email: String(proposal?.clientEmail ?? '').trim(),
          role: CLOSE_CONTRACT_PARTY_ROLE.CLIENT,
        }),
        makeCloseContractParty({
          displayName: String(user.name ?? '').trim() || 'Studio',
          email: String(user.email ?? '').trim(),
          role: CLOSE_CONTRACT_PARTY_ROLE.STUDIO,
        }),
      ]

  const record = makeCloseContractRecord({
    number:
      String(number ?? '').trim() ||
      `CTR-${shortArtifactSuffix(existing.id)}`,
    title: String(title ?? '').trim() || 'Commercial close contract',
    status: CLOSE_CONTRACT_STATUS.ISSUED,
    method: CLOSE_CONTRACT_METHOD.INTERNAL,
    currency,
    totalAmount: decisionTotal,
    parties: nextParties,
    effectiveAt: effectiveAt || at,
    issuedAt: at,
    issuedByActorId: user.id,
    binding: contractBindingFromClose(existing),
  })

  const contract = makeCloseContractFromDecision(existing, {
    required: true,
    status: CLOSE_CONTRACT_STATUS.ISSUED,
    method: CLOSE_CONTRACT_METHOD.INTERNAL,
    request:
      existing.contract?.request ||
      makeCloseContractRequest({
        method: CLOSE_CONTRACT_METHOD.INTERNAL,
        status: CLOSE_CONTRACT_STATUS.ISSUED,
        createdByActorId: user.id,
        binding: contractBindingFromClose(existing),
      }),
    record,
    completedAt: at,
  })

  const saved = replaceCommercialClose(
    existing.id,
    makeCommercialClose({
      ...existing,
      decision: makeCloseDecisionBinding(existing.decision),
      signature: makeCloseSignature(existing.signature),
      payment: makeClosePaymentFromDecision(existing, existing.payment),
      contract,
      invoice: makeCloseInvoiceFromDecision(existing, existing.invoice),
      updatedAt: at,
    }),
  )

  emitArtifactEvent({
    proposal,
    close: saved,
    type: LIVING_EVENT.CONTRACT_CREATED,
    actorId: user.id,
    at,
    method: CLOSE_CONTRACT_METHOD.INTERNAL,
    extra: {
      contractId: record.id,
      contractNumber: record.number,
      totalAmount: record.totalAmount,
      currency: record.currency,
    },
  })

  return {
    ...studioPayload(saved),
    created: true,
    duplicate: false,
    contract: presentCloseContract(saved.contract),
  }
}

/**
 * Studio: retrieve contract record for a close.
 */
export function getCommercialCloseContract({ companyId, closeId, actor } = {}) {
  assertContractPath()
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
    contract: presentCloseContract(close.contract),
    closeId: close.id,
    status: close.status,
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}

/**
 * Studio: create/update invoice draft request (no state-machine change).
 */
export function requestCommercialCloseInvoice({
  companyId,
  closeId,
  actor,
  kind,
} = {}) {
  assertInvoicePath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialCloseInvoice(user)) {
    throw new ForbiddenError(
      'You do not have permission to manage commercial-close invoices.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  if (isTerminalCommercialCloseStatus(existing.status)) {
    throw new ValidationError('Cannot request an invoice on a terminal close.', [
      {
        field: 'status',
        message: `Cannot request invoice while status is ${existing.status}.`,
      },
    ])
  }

  if (existing.invoice?.status === CLOSE_INVOICE_STATUS.ISSUED && existing.invoice?.record) {
    return {
      ...studioPayload(existing),
      created: false,
      duplicate: true,
    }
  }

  const at = new Date().toISOString()
  const nextKind = CLOSE_INVOICE_KINDS.includes(kind)
    ? kind
    : existing.invoice?.kind || CLOSE_INVOICE_KIND.FULL
  const refreshed = replaceCommercialClose(
    existing.id,
    makeCommercialClose({
      ...existing,
      decision: makeCloseDecisionBinding(existing.decision),
      signature: makeCloseSignature(existing.signature),
      payment: makeClosePaymentFromDecision(existing, existing.payment),
      contract: makeCloseContractFromDecision(existing, existing.contract),
      invoice: buildInvoiceRequest(existing, user.id, nextKind),
      updatedAt: at,
    }),
  )

  return {
    ...studioPayload(refreshed),
    created: existing.invoice?.status === CLOSE_INVOICE_STATUS.NOT_REQUESTED,
    duplicate: false,
  }
}

/**
 * Studio: issue an invoice record bound to the immutable decision totals.
 */
export function issueCommercialCloseInvoice({
  companyId,
  closeId,
  actor,
  number,
  kind,
  dueAt,
  issuedAt,
} = {}) {
  assertInvoicePath()
  const scoped = scopedCompany(companyId)
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)
  if (!studioCanManageCommercialCloseInvoice(user)) {
    throw new ForbiddenError(
      'You do not have permission to manage commercial-close invoices.',
    )
  }

  const id = String(closeId ?? '').trim()
  if (!id) {
    throw new ValidationError('closeId is required.', [
      { field: 'closeId', message: 'closeId is required.' },
    ])
  }

  const existing = findCommercialClose(id)
  if (!existing || existing.companyId !== scoped) {
    throw new NotFoundError('Commercial close not found.')
  }

  if (isTerminalCommercialCloseStatus(existing.status)) {
    throw new ValidationError('Cannot issue an invoice on a terminal close.', [
      {
        field: 'status',
        message: `Cannot issue invoice while status is ${existing.status}.`,
      },
    ])
  }

  if (existing.invoice?.status === CLOSE_INVOICE_STATUS.ISSUED && existing.invoice?.record) {
    return {
      ...studioPayload(existing),
      created: false,
      duplicate: true,
      invoice: presentCloseInvoice(existing.invoice),
    }
  }

  const proposal = requireProposal(scoped, existing.proposalId)
  let at = new Date().toISOString()
  if (issuedAt != null && String(issuedAt).trim()) {
    const parsed = new Date(issuedAt)
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError('issuedAt is invalid.', [
        { field: 'issuedAt', message: 'issuedAt must be a valid date.' },
      ])
    }
    at = parsed.toISOString()
  }

  const amounts = resolveClosePaymentAmounts(existing.decision ?? {}, existing.payment ?? {})
  const nextKind = CLOSE_INVOICE_KINDS.includes(kind)
    ? kind
    : existing.invoice?.kind || CLOSE_INVOICE_KIND.FULL

  const record = makeCloseInvoiceRecord({
    number:
      String(number ?? '').trim() ||
      `INV-${shortArtifactSuffix(existing.id)}`,
    status: CLOSE_INVOICE_STATUS.ISSUED,
    method: CLOSE_INVOICE_METHOD.INTERNAL,
    kind: nextKind,
    currency: amounts.currency,
    total: amounts.requiredAmount,
    amountPaid: amounts.recordedAmount,
    amountRemaining: amounts.remainingAmount,
    issuedAt: at,
    dueAt: dueAt || null,
    issuedByActorId: user.id,
    binding: invoiceBindingFromClose(existing),
  })

  const invoice = makeCloseInvoiceFromDecision(existing, {
    required: true,
    status: CLOSE_INVOICE_STATUS.ISSUED,
    method: CLOSE_INVOICE_METHOD.INTERNAL,
    kind: nextKind,
    request:
      existing.invoice?.request ||
      makeCloseInvoiceRequest({
        method: CLOSE_INVOICE_METHOD.INTERNAL,
        status: CLOSE_INVOICE_STATUS.ISSUED,
        kind: nextKind,
        currency: amounts.currency,
        total: amounts.requiredAmount,
        createdByActorId: user.id,
        binding: invoiceBindingFromClose(existing),
      }),
    record,
    completedAt: at,
  })

  const saved = replaceCommercialClose(
    existing.id,
    makeCommercialClose({
      ...existing,
      decision: makeCloseDecisionBinding(existing.decision),
      signature: makeCloseSignature(existing.signature),
      payment: makeClosePaymentFromDecision(existing, existing.payment),
      contract: makeCloseContractFromDecision(existing, existing.contract),
      invoice,
      updatedAt: at,
    }),
  )

  emitArtifactEvent({
    proposal,
    close: saved,
    type: LIVING_EVENT.INVOICE_CREATED,
    actorId: user.id,
    at,
    method: CLOSE_INVOICE_METHOD.INTERNAL,
    extra: {
      invoiceId: record.id,
      invoiceNumber: record.number,
      total: record.total,
      amountPaid: record.amountPaid,
      amountRemaining: record.amountRemaining,
      currency: record.currency,
    },
  })

  return {
    ...studioPayload(saved),
    created: true,
    duplicate: false,
    invoice: presentCloseInvoice(saved.invoice),
  }
}

/**
 * Studio: retrieve invoice record for a close.
 */
export function getCommercialCloseInvoice({ companyId, closeId, actor } = {}) {
  assertInvoicePath()
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
    invoice: presentCloseInvoice(close.invoice),
    closeId: close.id,
    status: close.status,
    capabilities: COMMERCIAL_CLOSE_CAPABILITIES,
  }
}
