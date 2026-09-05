import { findPortalRecord } from '../portal/store.js'

let proposalLookup = null
let portalLookup = null

export function configureInteractionResolvers({ getProposal, getPortal } = {}) {
  proposalLookup = typeof getProposal === 'function' ? getProposal : null
  portalLookup = typeof getPortal === 'function' ? getPortal : null
}

export function resetInteractionResolvers() {
  proposalLookup = null
  portalLookup = null
}

export function resolveInteractionProposal(proposalId, companyId) {
  if (!proposalLookup) return null
  return proposalLookup(proposalId, companyId) ?? null
}

export function resolveInteractionPortal(portalId) {
  if (portalLookup) return portalLookup(portalId) ?? null
  return findPortalRecord(portalId) ?? null
}
