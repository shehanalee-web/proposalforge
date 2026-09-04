/**
 * Resolve the document a client should see.
 *
 * The live proposal is the current working copy. Version history is studio-only
 * and is stripped before a record reaches the portal, so this returns the
 * proposal as presented — never a draft overlay, restore, or compare payload.
 *
 * @param {import('../models/proposal.js').Proposal} proposal
 * @returns {import('../models/proposal.js').Proposal}
 */
export function getActiveProposal(proposal) {
  return proposal
}

/**
 * @param {string} shareToken
 * @returns {string}
 */
export function getClientPortalPath(shareToken) {
  return `/p/share/${shareToken}`
}

/**
 * @param {string} shareToken
 * @returns {string}
 */
export function getClientPortalUrl(shareToken) {
  const path = getClientPortalPath(shareToken)

  if (typeof window === 'undefined' || !window.location?.origin) {
    return path
  }

  return `${window.location.origin}${path}`
}
