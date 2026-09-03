import { SCREEN_BLOCK } from './ids.js'
import CoverBlock from './CoverBlock.jsx'
import SummaryBlock from './SummaryBlock.jsx'
import SectionRenderer from './SectionRenderer.jsx'
import PricingTable from './PricingTable.jsx'
import ImageGallery from './ImageGallery.jsx'
import TermsBlock from './TermsBlock.jsx'
import NotesBlock from './NotesBlock.jsx'
import SignatureBlock from './SignatureBlock.jsx'
import TagsBlock from './TagsBlock.jsx'

const COMPONENTS = {
  [SCREEN_BLOCK.COVER]: CoverBlock,
  [SCREEN_BLOCK.SUMMARY]: SummaryBlock,
  [SCREEN_BLOCK.SECTIONS]: SectionRenderer,
  [SCREEN_BLOCK.PRICING]: PricingTable,
  [SCREEN_BLOCK.GALLERY]: ImageGallery,
  [SCREEN_BLOCK.TERMS]: TermsBlock,
  [SCREEN_BLOCK.NOTES]: NotesBlock,
  [SCREEN_BLOCK.SIGNATURE]: SignatureBlock,
  [SCREEN_BLOCK.TAGS]: TagsBlock,
}

/**
 * @param {string} id
 * @returns {import('react').ComponentType<object> | null}
 */
export function getScreenBlock(id) {
  return COMPONENTS[id] ?? null
}
