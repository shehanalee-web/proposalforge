import { Font } from '@react-pdf/renderer'

/**
 * PDF typeface resolution for Brand Kit.
 *
 * Screen/portal use CSS stacks. @react-pdf cannot. This module maps the
 * persisted `typography.fontFamily` id onto a PDF family name and registers
 * file-backed faces for the Google/webfont ids.
 *
 * Built-in Helvetica and Times-Roman stay engine fonts. Unknown ids fall
 * back to Helvetica without mutating Brand Kit.
 */

const FONTSOURCE = 'https://cdn.jsdelivr.net/npm/@fontsource'

const BUILTIN_FAMILY = Object.freeze({
  helvetica: 'Helvetica',
  system: 'Helvetica',
  georgia: 'Times-Roman',
  garamond: 'Times-Roman',
})

const REGISTERED_FAMILY = Object.freeze({
  inter: 'Inter',
  'dm-sans': 'DM Sans',
  outfit: 'Outfit',
  playfair: 'Playfair Display',
  merriweather: 'Merriweather',
})

const REGISTERED_FILES = Object.freeze({
  Inter: {
    packageName: 'inter',
    version: '5.3.0',
    regular: 'inter-latin-400-normal.woff',
    bold: 'inter-latin-700-normal.woff',
  },
  'DM Sans': {
    packageName: 'dm-sans',
    version: '5.3.0',
    regular: 'dm-sans-latin-400-normal.woff',
    bold: 'dm-sans-latin-700-normal.woff',
  },
  Outfit: {
    packageName: 'outfit',
    version: '5.3.0',
    regular: 'outfit-latin-400-normal.woff',
    bold: 'outfit-latin-700-normal.woff',
  },
  'Playfair Display': {
    packageName: 'playfair-display',
    version: '5.3.0',
    regular: 'playfair-display-latin-400-normal.woff',
    bold: 'playfair-display-latin-700-normal.woff',
  },
  Merriweather: {
    packageName: 'merriweather',
    version: '5.3.0',
    regular: 'merriweather-latin-400-normal.woff',
    bold: 'merriweather-latin-700-normal.woff',
  },
})

let registered = false

function fontFileUrl(entry, file) {
  return `${FONTSOURCE}/${entry.packageName}@${entry.version}/files/${file}`
}

/**
 * @param {string | null | undefined} fontFamilyId
 * @returns {string}
 */
export function resolvePdfFontFamily(fontFamilyId) {
  const id = String(fontFamilyId ?? '').trim()
  return REGISTERED_FAMILY[id] || BUILTIN_FAMILY[id] || 'Helvetica'
}

/**
 * Register Brand Kit webfonts with @react-pdf. Safe to call more than once.
 * Built-in Helvetica / Times-Roman are already in the font store.
 */
export function registerPdfFonts() {
  if (registered) return
  registered = true

  for (const [family, entry] of Object.entries(REGISTERED_FILES)) {
    Font.register({
      family,
      fonts: [
        { src: fontFileUrl(entry, entry.regular), fontWeight: 400 },
        { src: fontFileUrl(entry, entry.bold), fontWeight: 700 },
      ],
    })
  }
}
