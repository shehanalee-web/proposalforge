import { PROJECT_TYPES } from '../models/proposal.js'

/**
 * Seed studio profile for development.
 *
 * Hard-coded so the Settings page is populated on every reload. Replaced when
 * a real account API exists. Not persisted — reload restores this seed.
 *
 * @type {Partial<import('../models/settings.js').Settings>}
 */
export const MOCK_SETTINGS = {
  studioName: 'ProposalForge Studio',
  contactEmail: 'hello@proposalforge.studio',
  defaultProjectType: PROJECT_TYPES[0],
  about:
    'Independent studio producing proposals for agencies, fabricators and creative teams.',
  updatedAt: '2026-08-20T09:00:00.000Z',
}
