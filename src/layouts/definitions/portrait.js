import { LAYOUT_ID } from '../ids.js'
import { PDF_BLOCK, SCREEN_BLOCK } from '../blocks/ids.js'
import { BLOCK_TYPE } from '../../blocks/ids.js'

/**
 * Classic A4 portrait proposal.
 *
 * `accept: ['*']` paints enabled Block Engine instances in document order.
 * Chrome (notes, tags) still reads leftover proposal fields.
 *
 * @type {import('../registry.js').LayoutDefinition}
 */
export const portraitLayout = {
  id: LAYOUT_ID.PORTRAIT,
  label: 'Portrait',
  description: 'A4 document — the default proposal page.',
  pageSize: 'A4',
  orientation: 'portrait',
  screen: {
    maxWidth: '800px',
    variant: 'portrait',
    regions: [
      {
        id: 'document',
        columns: 1,
        accept: ['*'],
        chrome: [SCREEN_BLOCK.NOTES, SCREEN_BLOCK.TAGS],
        blocks: [
          SCREEN_BLOCK.COVER,
          SCREEN_BLOCK.SUMMARY,
          SCREEN_BLOCK.SECTIONS,
          SCREEN_BLOCK.PRICING,
          SCREEN_BLOCK.GALLERY,
          SCREEN_BLOCK.TERMS,
          SCREEN_BLOCK.NOTES,
          SCREEN_BLOCK.SIGNATURE,
          SCREEN_BLOCK.TAGS,
        ],
      },
    ],
  },
  pdf: {
    size: 'A4',
    orientation: 'portrait',
    sequence: [
      {
        type: 'content',
        accept: [BLOCK_TYPE.COVER],
      },
      {
        type: 'stack',
        chrome: [PDF_BLOCK.HEADER, PDF_BLOCK.CLIENT],
        blocks: [
          PDF_BLOCK.HEADER,
          PDF_BLOCK.CLIENT,
          PDF_BLOCK.DESCRIPTION,
          PDF_BLOCK.PRICING,
          PDF_BLOCK.GALLERY,
          PDF_BLOCK.TERMS,
          PDF_BLOCK.NOTES,
          PDF_BLOCK.SIGNATURE,
          PDF_BLOCK.FOOTER,
        ],
      },
      {
        type: 'content',
        accept: ['*'],
        skip: [BLOCK_TYPE.COVER],
      },
      {
        type: 'stack',
        chrome: [PDF_BLOCK.FOOTER],
      },
    ],
  },
}