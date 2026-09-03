/**
 * Proposal types shown in the Create Proposal journey.
 *
 * Each type is a visual entry point. Selecting one copies its underlying
 * template into a new proposal. Templates remain a library — they are not
 * the create-proposal UI.
 */

export const PROPOSAL_TYPE = Object.freeze({
  ARCHITECTURE: 'architecture',
  MOTION_GRAPHICS: 'motion-graphics',
  MARKETING: 'marketing',
  CREATIVE_AGENCY: 'creative-agency',
  CONSTRUCTION: 'construction',
  SOFTWARE_DEVELOPMENT: 'software-development',
  PRODUCT_CATALOGUE: 'product-catalogue',
})

/**
 * @typedef {object} ProposalType
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} icon
 * @property {string} accent
 * @property {string} projectType
 * @property {string} templateId
 */

/** @type {readonly ProposalType[]} */
export const PROPOSAL_TYPES = Object.freeze([
  {
    id: PROPOSAL_TYPE.ARCHITECTURE,
    label: 'Architecture',
    description:
      'Schematic design, documentation and presentation packages for built work.',
    icon: 'typeArchitecture',
    accent: '#5b8def',
    projectType: 'Architecture',
    templateId: 'tpl-architecture',
  },
  {
    id: PROPOSAL_TYPE.MOTION_GRAPHICS,
    label: 'Motion Graphics',
    description:
      'Title sequences, explainer films and campaign motion for screen and social.',
    icon: 'typeMotion',
    accent: '#f472b6',
    projectType: 'Motion Graphics',
    templateId: 'tpl-motion',
  },
  {
    id: PROPOSAL_TYPE.MARKETING,
    label: 'Marketing',
    description:
      'Campaign strategy, content and digital launches with a clear measurement plan.',
    icon: 'typeMarketing',
    accent: '#14b8a6',
    projectType: 'Marketing',
    templateId: 'tpl-2002',
  },
  {
    id: PROPOSAL_TYPE.CREATIVE_AGENCY,
    label: 'Creative Agency',
    description:
      'Brand identity, art direction and a full creative engagement from discovery to guidelines.',
    icon: 'typeAgency',
    accent: '#a78bfa',
    projectType: 'Creative Agency',
    templateId: 'tpl-2001',
  },
  {
    id: PROPOSAL_TYPE.CONSTRUCTION,
    label: 'Construction',
    description:
      'Build scopes, programme and commercial terms for construction and fit-out work.',
    icon: 'typeConstruction',
    accent: '#fb923c',
    projectType: 'Construction',
    templateId: 'tpl-construction',
  },
  {
    id: PROPOSAL_TYPE.SOFTWARE_DEVELOPMENT,
    label: 'Software Development',
    description:
      'Product discovery, design and engineering for web and software platforms.',
    icon: 'typeSoftware',
    accent: '#38bdf8',
    projectType: 'Software Development',
    templateId: 'tpl-software',
  },
  {
    id: PROPOSAL_TYPE.PRODUCT_CATALOGUE,
    label: 'Product Catalogue',
    description:
      'Photography, layout and print-ready catalogues for product and collection launches.',
    icon: 'typeCatalogue',
    accent: '#fbbf24',
    projectType: 'Product Catalogue',
    templateId: 'tpl-catalogue',
  },
])

const TYPE_BY_ID = new Map(PROPOSAL_TYPES.map((type) => [type.id, type]))

/**
 * @param {string} id
 * @returns {ProposalType | undefined}
 */
export function getProposalType(id) {
  return TYPE_BY_ID.get(id)
}

/**
 * @param {string} [proposalType]
 * @returns {string}
 */
export function getProposalTypeLabel(proposalType) {
  return TYPE_BY_ID.get(proposalType)?.label ?? ''
}

/**
 * @param {import('./template.js').ProposalTemplate[]} templates
 * @param {ProposalType} type
 * @returns {import('./template.js').ProposalTemplate | undefined}
 */
export function findTemplateForType(templates, type) {
  return templates.find((template) => template.id === type.templateId)
}
