/**
 * Screen and PDF block ids.
 *
 * Layout definitions compose documents from these ids. A new layout rearranges
 * or restyles the same blocks; it does not copy proposal content or business
 * logic.
 */
export const SCREEN_BLOCK = Object.freeze({
  COVER: 'cover',
  SUMMARY: 'summary',
  SECTIONS: 'sections',
  PRICING: 'pricing',
  GALLERY: 'gallery',
  TERMS: 'terms',
  NOTES: 'notes',
  SIGNATURE: 'signature',
  TAGS: 'tags',
})

export const PDF_BLOCK = Object.freeze({
  HEADER: 'header',
  CLIENT: 'client',
  DESCRIPTION: 'description',
  PRICING: 'pricing',
  GALLERY: 'gallery',
  TERMS: 'terms',
  NOTES: 'notes',
  SIGNATURE: 'signature',
  FOOTER: 'footer',
})
