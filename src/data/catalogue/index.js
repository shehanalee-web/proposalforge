import { makeCategory } from '../../models/category.js'
import { buildCatalogue } from './buildCatalogue.js'
import { CATALOGUE_SEED } from './seed.js'

const built = buildCatalogue(CATALOGUE_SEED)

/**
 * Flattened catalogue. Create Proposal, search and filters read these arrays.
 * Add entries in seed data only — do not hardcode cards in React.
 */
export const CATALOGUE_CATEGORIES = built.categories.map(makeCategory)
export const CATALOGUE_SERVICES = built.services
export const CATALOGUE_TEMPLATES = built.templates
