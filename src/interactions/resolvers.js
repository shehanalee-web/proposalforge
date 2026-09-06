import { findPortalRecord } from '../portal/store.js'

let proposalLookup = null
let proposalByShareTokenLookup = null
let portalLookup = null

export function configureInteractionResolvers({
  getProposal,
  getProposalByShareToken,
  getPortal,
} = {}) {
  proposalLookup = typeof getProposal === 'function' ? getProposal : null
  proposalByShareTokenLookup =
    typeof getProposalByShareToken === 'function' ? getProposalByShareToken : null
  portalLookup = typeof getPortal === 'function' ? getPortal : null
}

export function resetInteractionResolvers() {
  proposalLookup = null
  proposalByShareTokenLookup = null
  portalLookup = null
}

export function resolveInteractionProposal(proposalId, companyId) {
  if (!proposalLookup) return null
  return proposalLookup(proposalId, companyId) ?? null
}

export function resolveInteractionProposalByShareToken(shareToken) {
  if (!proposalByShareTokenLookup) return null
  return proposalByShareTokenLookup(shareToken) ?? null
}

export function resolveInteractionPortal(portalId) {
  if (portalLookup) return portalLookup(portalId) ?? null
  return findPortalRecord(portalId) ?? null
}
