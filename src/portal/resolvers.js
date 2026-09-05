import { WORKFLOW_STATUS } from '../workflow/types.js'
import { findWorkflowByProposal } from '../workflow/store.js'

let proposalLookup = null
let workflowStatusLookup = null

export function configurePortalResolvers({ getProposal, getWorkflowStatus } = {}) {
  proposalLookup = typeof getProposal === 'function' ? getProposal : null
  workflowStatusLookup = typeof getWorkflowStatus === 'function' ? getWorkflowStatus : null
}

export function resetPortalResolvers() {
  proposalLookup = null
  workflowStatusLookup = null
}

export function resolvePortalProposal(proposalId, companyId) {
  if (!proposalLookup) return null
  return proposalLookup(proposalId, companyId) ?? null
}

export function resolveWorkflowStatus(companyId, proposalId) {
  if (workflowStatusLookup) {
    return workflowStatusLookup(companyId, proposalId) ?? WORKFLOW_STATUS.DRAFT
  }
  const workflow = findWorkflowByProposal(companyId, proposalId)
  return workflow?.status ?? WORKFLOW_STATUS.DRAFT
}
