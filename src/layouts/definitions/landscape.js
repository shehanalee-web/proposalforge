import { LAYOUT_ID } from '../ids.js'
import { PDF_BLOCK, SCREEN_BLOCK } from '../blocks/ids.js'
import { BLOCK_TYPE } from '../../blocks/ids.js'

/**
 * A4 landscape / presentation proposal.
 *
 * Same proposal blocks as portrait; regions regroup types without rewriting
 * the document.
 *
 * @type {import('../registry.js').LayoutDefinition}
 */
export const landscapeLayout = {
  id: LAYOUT_ID.LANDSCAPE,
  label: 'Landscape',
  description: 'A4 landscape / presentation — wider page, pricing up front.',
  pageSize: 'A4',
  orientation: 'landscape',
  screen: {
    maxWidth: '1100px',
    variant: 'landscape',
    regions: [
      {
        id: 'hero',
        columns: 1,
        accept: [BLOCK_TYPE.COVER],
        blocks: [SCREEN_BLOCK.COVER],
      },
      {
        id: 'split',
        columns: 2,
        accept: [BLOCK_TYPE.EXECUTIVE_SUMMARY, BLOCK_TYPE.PRICING],
        blocks: [SCREEN_BLOCK.SUMMARY, SCREEN_BLOCK.PRICING],
      },
      {
        id: 'body',
        columns: 1,
        accept: ['*'],
        blocks: [SCREEN_BLOCK.SECTIONS, SCREEN_BLOCK.GALLERY],
      },
      {
        id: 'close',
        columns: 2,
        accept: [BLOCK_TYPE.TERMS, BLOCK_TYPE.SIGNATURE],
        blocks: [SCREEN_BLOCK.TERMS, SCREEN_BLOCK.SIGNATURE],
      },
      {
        id: 'meta',
        columns: 1,
        chrome: [SCREEN_BLOCK.NOTES, SCREEN_BLOCK.TAGS],
        blocks: [SCREEN_BLOCK.NOTES, SCREEN_BLOCK.TAGS],
      },
    ],
  },
  pdf: {
    size: 'A4',
    orientation: 'landscape',
    sequence: [
      { type: 'stack', chrome: [PDF_BLOCK.HEADER], blocks: [PDF_BLOCK.HEADER] },
      {
        type: 'row',
        chrome: [PDF_BLOCK.CLIENT],
        accept: [BLOCK_TYPE.PRICING],
        blocks: [PDF_BLOCK.CLIENT, PDF_BLOCK.PRICING],
      },
      {
        type: 'content',
        accept: ['*'],
        skip: [BLOCK_TYPE.COVER, BLOCK_TYPE.PRICING],
        blocks: [
          PDF_BLOCK.DESCRIPTION,
          PDF_BLOCK.GALLERY,
          PDF_BLOCK.TERMS,
          PDF_BLOCK.NOTES,
          PDF_BLOCK.SIGNATURE,
          PDF_BLOCK.FOOTER,
        ],
      },
      { type: 'stack', chrome: [PDF_BLOCK.FOOTER] },
    ],
  },
}