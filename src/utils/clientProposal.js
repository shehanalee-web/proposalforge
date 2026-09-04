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

function shareGateKey(token) {
  return `proposalforge.shareGate.${token}`
}

/**
 * Session unlock for a gated client link. Cleared when the tab closes.
 *
 * @param {string} token
 * @returns {{ password: string, email: string }}
 */
export function readShareGate(token) {
  if (!token || typeof sessionStorage === 'undefined') {
    return { password: '', email: '' }
  }
  try {
    const raw = sessionStorage.getItem(shareGateKey(token))
    if (!raw) return { password: '', email: '' }
    const parsed = JSON.parse(raw)
    return {
      password: String(parsed?.password ?? ''),
      email: String(parsed?.email ?? ''),
    }
  } catch {
    return { password: '', email: '' }
  }
}

export function writeShareGate(token, credentials = {}) {
  if (!token || typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(
    shareGateKey(token),
    JSON.stringify({
      password: String(credentials.password ?? ''),
      email: String(credentials.email ?? ''),
    }),
  )
}

export function clearShareGate(token) {
  if (!token || typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(shareGateKey(token))
}
