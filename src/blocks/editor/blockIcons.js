import { BLOCK_TYPE } from '../ids.js'

/** Map every block type to its Icon name. */
const BLOCK_ICON = {
  [BLOCK_TYPE.COVER]: 'blockCover',
  [BLOCK_TYPE.EXECUTIVE_SUMMARY]: 'blockText',
  [BLOCK_TYPE.RICH_TEXT]: 'blockText',
  [BLOCK_TYPE.GALLERY]: 'blockGallery',
  [BLOCK_TYPE.PRICING]: 'blockPricing',
  [BLOCK_TYPE.TIMELINE]: 'blockTimeline',
  [BLOCK_TYPE.DELIVERABLES]: 'blockDeliverables',
  [BLOCK_TYPE.SPECIFICATIONS]: 'blockSpecs',
  [BLOCK_TYPE.TEAM]: 'blockTeam',
  [BLOCK_TYPE.TESTIMONIALS]: 'blockTestimonials',
  [BLOCK_TYPE.FAQ]: 'blockFaq',
  [BLOCK_TYPE.TERMS]: 'blockTerms',
  [BLOCK_TYPE.SIGNATURE]: 'blockSignature',
  [BLOCK_TYPE.ATTACHMENTS]: 'blockAttachments',
  [BLOCK_TYPE.CUSTOM]: 'blockCustom',
}

export function getBlockIcon(type) {
  return BLOCK_ICON[type] ?? 'blockCustom'
}
