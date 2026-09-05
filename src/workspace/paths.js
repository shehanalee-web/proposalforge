/**
 * Canonical studio routes.
 *
 * `/new` is the Create Proposal journey. Generate with AI continues at
 * `/proposal-ai`. The editor at `/proposals/:id/edit` owns document editing
 * after a proposal exists.
 */

export const PATH = Object.freeze({
  DASHBOARD: '/',
  PROPOSALS: '/proposals',
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
