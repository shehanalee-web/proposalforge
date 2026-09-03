import { BLOCK_TYPE } from '../blocks/ids.js'
import { isBlockDataEmpty } from '../blocks/schemas.js'

const TITLES = {
  [BLOCK_TYPE.COVER]: 'Cover',
  [BLOCK_TYPE.EXECUTIVE_SUMMARY]: 'Executive Summary',
  [BLOCK_TYPE.RICH_TEXT]: 'Details',
  [BLOCK_TYPE.GALLERY]: 'Gallery',
  [BLOCK_TYPE.PRICING]: 'Pricing',
  [BLOCK_TYPE.TIMELINE]: 'Timeline',
  [BLOCK_TYPE.DELIVERABLES]: 'Deliverables',
  [BLOCK_TYPE.SPECIFICATIONS]: 'Specifications',
  [BLOCK_TYPE.TEAM]: 'Team',
  [BLOCK_TYPE.TESTIMONIALS]: 'Testimonials',
  [BLOCK_TYPE.FAQ]: 'FAQ',
  [BLOCK_TYPE.TERMS]: 'Terms',
  [BLOCK_TYPE.SIGNATURE]: 'Signature',
  [BLOCK_TYPE.ATTACHMENTS]: 'Attachments',
  [BLOCK_TYPE.CUSTOM]: 'More',
}

export function getViewerSectionTitle(block) {
  const heading = block.data?.heading?.trim()
  if (
    heading &&
    (block.type === BLOCK_TYPE.RICH_TEXT || block.type === BLOCK_TYPE.CUSTOM)
  ) {
    return heading
  }
  return TITLES[block.type] ?? 'Section'
}

export function listViewerSections(blocks = []) {
  return blocks
    .filter((block) => block.enabled !== false)
    .filter((block) => {
      if (block.type === BLOCK_TYPE.COVER) return true
      if (block.type === BLOCK_TYPE.SIGNATURE) return true
      return !isBlockDataEmpty(block.type, block.data)
    })
    .map((block) => ({
      id: block.id,
      type: block.type,
      title: getViewerSectionTitle(block),
    }))
}

export function sectionElementId(id) {
  return `viewer-section-${id}`
}
