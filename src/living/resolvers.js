/**
 * Living domain resolvers. Wired by the server plugin — same pattern as
 * portal / interactions. Never imports follow-up or analytics persistence.
 */

let getProposalByShareToken = null
let getProposalById = null

export function configureLivingResolvers({
  getProposalByShareToken: byToken,
  getProposalById: byId,
} = {}) {
  getProposalByShareToken = typeof byToken === 'function' ? byToken : null
  getProposalById = typeof byId === 'function' ? byId : null
}

export function resolveLivingProposalByShareToken(shareToken) {
  if (!getProposalByShareToken) return null
  return getProposalByShareToken(shareToken) ?? null
}

export function resolveLivingProposalById(proposalId, companyId) {
  if (!getProposalById) return null
  return getProposalById(proposalId, companyId) ?? null
}
