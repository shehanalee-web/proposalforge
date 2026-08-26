import { createRecordId } from './ids.js'

/**
 * Content Library (Component Library) model.
 *
 * Block *types* are a platform catalog — new industries add types here,
 * not a new proposal schema. Saved *instances* (workspace-authored blocks)
 * will use `makeContentBlock` in a later CRUD phase.
 *
 * Layout Engine block ids remain presentation slots. They consume these
 * types; they do not duplicate this catalog.
 */

export const CONTENT_BLOCK_TYPE = Object.freeze({
  COVER: 'cover',
  EXECUTIVE_SUMMARY: 'executive-summary',
  RICH_TEXT: 'rich-text',
  GALLERY: 'gallery',
  VIDEO: 'video',
  BEFORE_AFTER: 'before-after',
  PRICING: 'pricing',
  OPTIONAL_PRICING: 'optional-pricing',
  ALTERNATIVES: 'alternatives',
  TABLE: 'table',
  SPECIFICATIONS: 'specifications',
  TECHNICAL_DRAWINGS: 'technical-drawings',
  DOWNLOADS: 'downloads',
  ATTACHMENTS: 'attachments',
  TIMELINE: 'timeline',
  MILESTONES: 'milestones',
  DELIVERABLES: 'deliverables',
  TEAM: 'team',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  WARRANTY: 'warranty',
  TERMS: 'terms',
  SIGNATURE: 'signature',
  APPENDICES: 'appendices',
  COMPANY_PROFILE: 'company-profile',
  MAPS: 'maps',
  QR_CODES: 'qr-codes',
  CUSTOM: 'custom',
})

export const CONTENT_BLOCK_TYPES = Object.freeze(Object.values(CONTENT_BLOCK_TYPE))

export const CONTENT_BLOCK_TYPE_LABELS = Object.freeze({
  [CONTENT_BLOCK_TYPE.COVER]: 'Cover / Hero',
  [CONTENT_BLOCK_TYPE.EXECUTIVE_SUMMARY]: 'Executive summary',
  [CONTENT_BLOCK_TYPE.RICH_TEXT]: 'Rich text',
  [CONTENT_BLOCK_TYPE.GALLERY]: 'Image gallery',
  [CONTENT_BLOCK_TYPE.VIDEO]: 'Video',
  [CONTENT_BLOCK_TYPE.BEFORE_AFTER]: 'Before / after',
  [CONTENT_BLOCK_TYPE.PRICING]: 'Pricing table',
  [CONTENT_BLOCK_TYPE.OPTIONAL_PRICING]: 'Optional pricing',
  [CONTENT_BLOCK_TYPE.ALTERNATIVES]: 'Alternatives',
  [CONTENT_BLOCK_TYPE.TABLE]: 'Table',
  [CONTENT_BLOCK_TYPE.SPECIFICATIONS]: 'Specifications',
  [CONTENT_BLOCK_TYPE.TECHNICAL_DRAWINGS]: 'Technical drawings',
  [CONTENT_BLOCK_TYPE.DOWNLOADS]: 'Downloads',
  [CONTENT_BLOCK_TYPE.ATTACHMENTS]: 'Attachments',
  [CONTENT_BLOCK_TYPE.TIMELINE]: 'Timeline',
  [CONTENT_BLOCK_TYPE.MILESTONES]: 'Milestones',
  [CONTENT_BLOCK_TYPE.DELIVERABLES]: 'Deliverables',
  [CONTENT_BLOCK_TYPE.TEAM]: 'Team',
  [CONTENT_BLOCK_TYPE.TESTIMONIALS]: 'Testimonials',
  [CONTENT_BLOCK_TYPE.FAQ]: 'FAQs',
  [CONTENT_BLOCK_TYPE.WARRANTY]: 'Warranty',
  [CONTENT_BLOCK_TYPE.TERMS]: 'Terms & conditions',
  [CONTENT_BLOCK_TYPE.SIGNATURE]: 'Signature',
  [CONTENT_BLOCK_TYPE.APPENDICES]: 'Appendices',
  [CONTENT_BLOCK_TYPE.COMPANY_PROFILE]: 'Company profile',
  [CONTENT_BLOCK_TYPE.MAPS]: 'Maps',
  [CONTENT_BLOCK_TYPE.QR_CODES]: 'QR codes',
  [CONTENT_BLOCK_TYPE.CUSTOM]: 'Custom block',
})

/**
 * @typedef {object} ContentBlock
 * @property {string} id
 * @property {string} type
 * @property {string} title
 * @property {string} body
 * @property {string[]} assetIds
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<ContentBlock>} [input]
 * @returns {ContentBlock}
 */
export function makeContentBlock(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createRecordId('block'),
    type: input.type ?? CONTENT_BLOCK_TYPE.CUSTOM,
    title: input.title ?? '',
    body: input.body ?? '',
    assetIds: [...(input.assetIds ?? [])],
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

export function listContentBlockTypes() {
  return CONTENT_BLOCK_TYPES.map((type) => ({
    type,
    label: CONTENT_BLOCK_TYPE_LABELS[type],
  }))
}

/**
 * @param {Partial<ContentBlock>} block
 * @returns {{ field: string, message: string }[]}
 */
export function validateContentBlock(block) {
  const errors = []

  if (block.type && !CONTENT_BLOCK_TYPES.includes(block.type)) {
    errors.push({
      field: 'type',
      message: `Type must be one of: ${CONTENT_BLOCK_TYPES.join(', ')}.`,
    })
  }

  return errors
}
