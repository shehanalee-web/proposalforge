/**
 * Seed workspaces for the Create Proposal journey.
 *
 * The product is currently a single-tenant studio. Display name is overlaid
 * from Brand Kit at render time. Replaced when a real accounts API exists.
 *
 * @type {readonly { id: string, name: string, summary: string }[]}
 */
export const MOCK_WORKSPACES = Object.freeze([
  {
    id: 'ws-studio',
    name: 'Studio workspace',
    summary: 'Proposals, templates and Brand Kit for this company.',
  },
])
