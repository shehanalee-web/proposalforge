/**
 * Canonical studio routes.
 *
 * `/new` is the Create Proposal journey. Generate with AI continues at
 * `/proposal-ai` as the structured Proposal Generator. The editor at
 * `/proposals/:id/edit` owns document editing after a proposal exists.
 */

export const PATH = Object.freeze({
  DASHBOARD: '/',
  PROPOSALS: '/proposals',
  FOLLOWUPS: '/followups',
  NEW_PROPOSAL: '/new',
  PROPOSAL_AI: '/proposal-ai',
  TEMPLATES: '/templates',
  NEW_TEMPLATE: '/templates/new',
  BRAND_KIT: '/brand-kit',
  SERVICES: '/services',
  NEW_SERVICE: '/services/new',
  ASSETS: '/assets',
  CONTENT_LIBRARY: '/content-library',
  NEW_CONTENT_BLOCK: '/content-library/new',
  KNOWLEDGE: '/knowledge',
  NEW_KNOWLEDGE: '/knowledge/new',
  CASE_STUDIES: '/case-studies',
  TESTIMONIALS: '/testimonials',
  TEAM: '/team',
  SETTINGS: '/settings',
})

export function portalPath(portalId) {
  return `/portal/${encodeURIComponent(String(portalId ?? '').trim())}`
}

/**
 * Canonical Living Proposal URL. `/p/share/:token` remains an alias.
 *
 * @param {string} shareToken
 */
export function clientProposalPath(shareToken) {
  const token = String(shareToken ?? '').trim()
  if (!token) return '/p/'
  return `/p/${encodeURIComponent(token)}`
}

/**
 * Legacy share-token alias. Redirects to {@link clientProposalPath}.
 *
 * @param {string} shareToken
 */
export function clientProposalShareAliasPath(shareToken) {
  const token = String(shareToken ?? '').trim()
  if (!token) return '/p/share/'
  return `/p/share/${encodeURIComponent(token)}`
}

export function proposalPath(id) {
  return `${PATH.PROPOSALS}/${id}`
}

export function proposalEditPath(id) {
  return `${PATH.PROPOSALS}/${id}/edit`
}

export function templateEditPath(id) {
  return `${PATH.TEMPLATES}/${id}/edit`
}

export function contentBlockEditPath(id) {
  return `${PATH.CONTENT_LIBRARY}/${id}/edit`
}

export function knowledgePath(id) {
  return `${PATH.KNOWLEDGE}/${id}`
}

export function knowledgeEditPath(id) {
  return `${PATH.KNOWLEDGE}/${id}/edit`
}

export function serviceEditPath(id) {
  return `${PATH.SERVICES}/${id}/edit`
}
