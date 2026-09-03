/**
 * Workspace module identifiers.
 *
 * The studio shell is a set of registered modules. New product surfaces are
 * added here and in `modules.js` — they do not grow out of the proposal editor.
 */

export const WORKSPACE_MODULE = Object.freeze({
  DASHBOARD: 'dashboard',
  CREATE_PROPOSAL: 'create-proposal',
  PROPOSALS: 'proposals',
  TEMPLATES: 'templates',
  BRAND_KIT: 'brand-kit',
  SERVICES: 'services',
  ASSETS: 'assets',
  CONTENT_LIBRARY: 'content-library',
  CASE_STUDIES: 'case-studies',
  TESTIMONIALS: 'testimonials',
  TEAM: 'team',
  SETTINGS: 'settings',
})

export const WORKSPACE_GROUP = Object.freeze({
  WORKSPACE: 'workspace',
  LIBRARIES: 'libraries',
  ACCOUNT: 'account',
})

export const WORKSPACE_GROUPS = Object.freeze([
  { id: WORKSPACE_GROUP.WORKSPACE, label: 'Workspace' },
  { id: WORKSPACE_GROUP.LIBRARIES, label: 'Libraries' },
  { id: WORKSPACE_GROUP.ACCOUNT, label: 'Account' },
])
