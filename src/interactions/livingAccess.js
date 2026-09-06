import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import {
  findPortalByProposal,
  insertPortalRecord,
  replacePortalRecord,
} from '../portal/store.js'
import { makePortalRecord } from '../portal/schema.js'
import { PORTAL_STATUS } from '../portal/types.js'
import { LIVING_CAPABILITIES, LIVING_EVENT } from '../living/types.js'
import { recordLivingEngagementEvent } from '../living/eventRepository.js'
import { createClientInteraction, listClientInteractions } from './repository.js'
import { resolveInteractionProposalByShareToken } from './resolvers.js'
import { assertClientSafeInteraction } from './projection.js'
import { INTERACTION_TYPE } from './types.js'

function deny(message, { notFound = true } = {}) {
  const error = notFound ? new NotFoundError(message) : new ForbiddenError(message)
  error.reason = 'living_interaction_unavailable'
  throw error
}

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

/**
 * Resolve living share token → authored proposal. Token is the only identity.
 */
export function resolveProposalForLivingToken(shareToken) {
  const token = String(shareToken ?? '').trim()
  if (!token) deny('This proposal is not available.')
  const proposal = resolveInteractionProposalByShareToken(token)
  if (!proposal) deny('This proposal is not available.')
  if (proposal.shareToken && proposal.shareToken !== token) {
    deny('This proposal is not available.')
  }
  return proposal
}

/**
 * Ensure an H11 portal record exists for H12 scoping.
 * Living share access is the client gate — portal is the interaction key only.
 * Never writes proposals.json.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 */
export function ensurePortalForLivingProposal(proposal) {
  const companyId = scopedCompany(proposal.companyId)
  const existing = findPortalByProposal(companyId, proposal.id)
  if (existing) {
    if (existing.status === PORTAL_STATUS.PUBLISHED) return existing
    if (existing.status === PORTAL_STATUS.REVOKED) {
      deny('This proposal is no longer available.', { notFound: false })
    }
    const publishedAt = existing.publishedAt || new Date().toISOString()
    return (
      replacePortalRecord(existing.id, {
        ...existing,
        status: PORTAL_STATUS.PUBLISHED,
        publishedAt,
        revokedAt: null,
        expiresAt: null,
      }) ?? existing
    )
  }

  const now = new Date().toISOString()
  return insertPortalRecord(
    makePortalRecord({
      companyId,
      proposalId: proposal.id,
      status: PORTAL_STATUS.PUBLISHED,
      publishedAt: now,
      clientFacing: { label: 'Living share' },
    }),
  )
}

/**
 * Map share token to H12 portal context. Creates published portal when missing.
 *
 * @param {string} shareToken
 */
export function resolveLivingInteractionContext(shareToken) {
  if (!LIVING_CAPABILITIES.h12Interactions) {
    throw new ValidationError('Living H12 interactions are not enabled.', [
      { field: 'h12Interactions', message: 'h12Interactions capability is off.' },
    ])
  }
  const proposal = resolveProposalForLivingToken(shareToken)
  const portal = ensurePortalForLivingProposal(proposal)
  return { proposal, portal, shareToken: proposal.shareToken }
}

function livingEventTypeFor(interactionType) {
  if (interactionType === INTERACTION_TYPE.COMMENT) return LIVING_EVENT.COMMENT_ADDED
  if (interactionType === INTERACTION_TYPE.CHANGE_REQUEST) {
    return LIVING_EVENT.CHANGE_REQUESTED
  }
  if (interactionType === INTERACTION_TYPE.QUESTION) {
    return LIVING_EVENT.QUESTION_ANSWERED
  }
  return null
}

function emitLivingEventForInteraction(shareToken, interaction) {
  if (!LIVING_CAPABILITIES.commercialEvents) return null
  const type = livingEventTypeFor(interaction?.type)
  if (!type) return null
  try {
    return recordLivingEngagementEvent({
      shareToken,
      type,
      blockId: interaction.blockId || null,
      metadata: {
        interactionId: interaction.id,
        interactionType: interaction.type,
      },
    })
  } catch {
    // Living event persistence is best-effort — interaction record is SoT for feedback.
    return null
  }
}

/**
 * Client list via living share token.
 * Ignores any client-supplied proposalId / companyId for identity.
 */
export function listLivingClientInteractions({ shareToken } = {}) {
  const { portal, proposal } = resolveLivingInteractionContext(shareToken)
  const result = listClientInteractions({ portalId: portal.id })
  return {
    ...result,
    living: {
      shareToken: proposal.shareToken,
      proposalId: proposal.id,
      portalId: portal.id,
    },
  }
}

/**
 * Client create via living share token.
 * Token establishes proposal identity — body.proposalId cannot override it.
 */
export function createLivingClientInteraction({
  shareToken,
  type,
  message,
  blockId,
  proposalId,
  companyId,
} = {}) {
  const { portal, proposal } = resolveLivingInteractionContext(shareToken)

  if (companyId != null && String(companyId).trim()) {
    const claimed = scopedCompany(companyId)
    if (claimed !== scopedCompany(proposal.companyId)) {
      deny('This proposal is not available.', { notFound: false })
    }
  }

  if (proposalId != null && String(proposalId).trim()) {
    if (String(proposalId).trim() !== proposal.id) {
      throw new ValidationError('The proposal does not match this share link.', [
        { field: 'proposalId', message: 'proposalId does not match the share token.' },
      ])
    }
  }

  const interaction = createClientInteraction({
    portalId: portal.id,
    type,
    message,
    blockId,
    proposalId: proposal.id,
    companyId: scopedCompany(proposal.companyId),
  })

  emitLivingEventForInteraction(proposal.shareToken, interaction)

  if (!assertClientSafeInteraction(interaction)) {
    throw new Error('Client interaction projection leaked internal fields.')
  }

  return interaction
}

/**
 * Studio-facing summary for living projection (client-safe counts only).
 */
export function presentLivingInteractionState({ shareToken } = {}) {
  if (!LIVING_CAPABILITIES.h12Interactions) {
    return null
  }
  try {
    const listed = listLivingClientInteractions({ shareToken })
    const open = listed.interactions.filter((item) => item.status === 'open').length
    return {
      enabled: true,
      count: listed.interactions.length,
      openCount: open,
      targets: listed.targets,
    }
  } catch {
    return {
      enabled: true,
      count: 0,
      openCount: 0,
      targets: [],
    }
  }
}
