/**
 * Canonical studio routes.
 *
 * `/new` is the Create Proposal journey. The editor at
 * `/proposals/:id/edit` owns document editing after a proposal exists.
 */

export const PATH = Object.freeze({
  DASHBOARD: '/',
  PROPOSALS: '/proposals',
  NEW_PROPOSAL: '/new',
  TEMPLATES: '/templates',
  NEW_TEMPLATE: '/templates/new',
  BRAND_KIT: '/brand-kit',
  SERVICES: '/services',
  ASSETS: '/assets',
  CONTENT_LIBRARY: '/content-library',
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
