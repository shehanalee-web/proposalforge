import { findPortalByProposal } from '../portal/store.js'
import { findWorkflowByProposal } from '../workflow/store.js'
import { listInteractionsForProposal } from '../interactions/store.js'

let proposalLookup = null
let workflowLookup = null
let portalLookup = null
let interactionLookup = null
let proposalListLookup = null

export function configureFollowupResolvers({
  getProposal,
  getWorkflow,
  getPortal,
  getInteractions,
  listProposals,
} = {}) {
  proposalLookup = typeof getProposal === 'function' ? getProposal : null
  workflowLookup = typeof getWorkflow === 'function' ? getWorkflow : null
  portalLookup = typeof getPortal === 'function' ? getPortal : null
  interactionLookup = typeof getInteractions === 'function' ? getInteractions : null
  proposalListLookup = typeof listProposals === 'function' ? listProposals : null
}

export function resetFollowupResolvers() {
  proposalLookup = null
  workflowLookup = null
  portalLookup = null
  interactionLookup = null
  proposalListLookup = null
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
