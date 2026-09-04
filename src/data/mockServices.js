import { CATALOGUE_SERVICES } from './catalogue/index.js'

/**
 * Service Library seed. Cards on Create Proposal are rendered from this list.
 * Add offerings in `src/data/catalogue` seed files, not in React.
 *
 * @type {Partial<import('../models/service.js').Service>[]}
 */
export const MOCK_SERVICES = CATALOGUE_SERVICES

export { CATALOGUE_CATEGORIES as MOCK_CATEGORIES } from './catalogue/index.js'
