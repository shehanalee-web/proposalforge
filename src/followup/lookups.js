import { findPortalByProposal } from '../portal/store.js'
import { findWorkflowByProposal } from '../workflow/store.js'
import { listInteractionsForProposal } from '../interactions/store.js'
import {
  findLivingSessionByShareToken,
  listLivingSessionsForProposal,
} from '../living/store.js'

let proposalLookup = null
let workflowLookup = null
let portalLookup = null
let interactionLookup = null
let proposalListLookup = null
let livingSessionLookup = null

export function configureFollowupResolvers({
  getProposal,
  getWorkflow,
  getPortal,
  getInteractions,
  listProposals,
  getLivingSession,
} = {}) {
  proposalLookup = typeof getProposal === 'function' ? getProposal : null
  workflowLookup = typeof getWorkflow === 'function' ? getWorkflow : null
  portalLookup = typeof getPortal === 'function' ? getPortal : null
  interactionLookup = typeof getInteractions === 'function' ? getInteractions : null
  proposalListLookup = typeof listProposals === 'function' ? listProposals : null
  livingSessionLookup = typeof getLivingSession === 'function' ? getLivingSession : null
}

export function resetFollowupResolvers() {
  proposalLookup = null
  workflowLookup = null
  portalLookup = null
  interactionLookup = null
  proposalListLookup = null
  livingSessionLookup = null
}

export function resolveFollowupProposal(proposalId, companyId) {
  if (!proposalLookup) return null
  return proposalLookup(proposalId, companyId) ?? null
}

export function resolveFollowupWorkflow(companyId, proposalId) {
  if (workflowLookup) return workflowLookup(companyId, proposalId) ?? null
  return findWorkflowByProposal(companyId, proposalId) ?? null
}

export function resolveFollowupPortal(companyId, proposalId) {
  if (portalLookup) return portalLookup(companyId, proposalId) ?? null
  return findPortalByProposal(companyId, proposalId) ?? null
}

export function resolveFollowupInteractions(companyId, proposalId) {
  if (interactionLookup) return interactionLookup(companyId, proposalId) ?? []
  return listInteractionsForProposal(companyId, proposalId)
}

export function resolveFollowupProposals(companyId) {
  if (!proposalListLookup) return []
  return proposalListLookup(companyId) ?? []
}

/**
 * Living commercial session for a proposal (share-token scoped).
 * Prefer the configured lookup; fall back to the living store.
 */
export function resolveFollowupLivingSession(companyId, proposalId, proposal = null) {
  const scoped = String(companyId ?? '').trim()
  const pid = String(proposalId ?? '').trim()
  if (livingSessionLookup) {
    return livingSessionLookup(scoped, pid) ?? null
  }
  if (proposal?.shareToken) {
    const byToken = findLivingSessionByShareToken(proposal.shareToken)
    if (byToken && byToken.proposalId === pid) {
      if (!scoped || byToken.companyId === scoped) return byToken
    }
  }
  const sessions = listLivingSessionsForProposal(pid)
  return (
    sessions.find((item) => !scoped || item.companyId === scoped) ??
    sessions[0] ??
    null
  )
}
