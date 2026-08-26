import { createRecordId, EMAIL_PATTERN } from './ids.js'

/**
 * Brand Kit model.
 *
 * One kit per workspace. Renderers (preview, client portal, PDF) should
 * resolve identity from here rather than copying logos or colours onto a
 * proposal. CRUD is not wired yet — this is the shape later features fill.
 */

export const COVER_STYLE = Object.freeze({
  FULL_BLEED: 'full-bleed',
  SPLIT: 'split',
  MINIMAL: 'minimal',
})

export const COVER_STYLES = Object.freeze(Object.values(COVER_STYLE))

export const HEADER_STYLE = Object.freeze({
  STANDARD: 'standard',
  MINIMAL: 'minimal',
  CENTERED: 'centered',
})

export const HEADER_STYLES = Object.freeze(Object.values(HEADER_STYLE))

export const FOOTER_STYLE = Object.freeze({
  STANDARD: 'standard',
  MINIMAL: 'minimal',
  CONTACT: 'contact',
})

export const FOOTER_STYLES = Object.freeze(Object.values(FOOTER_STYLE))

export const SPACING_SCALE = Object.freeze({
  COMPACT: 'compact',
  DEFAULT: 'default',
  RELAXED: 'relaxed',
})

export const SPACING_SCALES = Object.freeze(Object.values(SPACING_SCALE))

export const PAGE_NUMBER_POSITION = Object.freeze({
  HIDDEN: 'hidden',
  FOOTER_CENTER: 'footer-center',
  FOOTER_RIGHT: 'footer-right',
})

export const PAGE_NUMBER_POSITIONS = Object.freeze(
  Object.values(PAGE_NUMBER_POSITION),
)

/**
 * @typedef {object} BrandLogos
 * @property {string | null} primary
 * @property {string | null} light
 * @property {string | null} dark
 * @property {string | null} mark
 */

/**
 * @typedef {object} BrandColors
 * @property {string} primary
 * @property {string} secondary
 * @property {string} accent
 * @property {string} background
 * @property {string} text
 */

/**
 * @typedef {object} BrandTypography
 * @property {string} headingFont
 * @property {string} bodyFont
 * @property {string} scale
 */

/**
 * @typedef {object} BrandContact
 * @property {string} legalName
 * @property {string} email
 * @property {string} phone
 * @property {string} website
 * @property {string} address
 */

/**
 * @typedef {object} BrandKit
 * @property {string} id
 * @property {BrandLogos} logos
 * @property {BrandColors} colors
 * @property {BrandTypography} typography
 * @property {BrandContact} contact
 * @property {string} coverStyle
 * @property {string} headerStyle
 * @property {string} footerStyle
 * @property {boolean} watermarkEnabled
 * @property {string} watermarkText
 * @property {string | null} watermarkAssetId
 * @property {string} pageNumberPosition
 * @property {string} spacing
 * @property {string} documentBorder
 * @property {string} cornerRadius
 * @property {string} buttonStyle
 * @property {string} iconStyle
 * @property {string} updatedAt
 */

function makeLogos(input = {}) {
  return {
    primary: input.primary ?? null,
    light: input.light ?? null,
    dark: input.dark ?? null,
    mark: input.mark ?? null,
  }
}

function makeColors(input = {}) {
  return {
    primary: input.primary ?? '',
    secondary: input.secondary ?? '',
    accent: input.accent ?? '',
    background: input.background ?? '',
    text: input.text ?? '',
  }
}

function makeTypography(input = {}) {
  return {
    headingFont: input.headingFont ?? '',
    bodyFont: input.bodyFont ?? '',
    scale: input.scale ?? 'default',
  }
}

function makeContact(input = {}) {
  return {
    legalName: input.legalName ?? '',
    email: input.email ?? '',
    phone: input.phone ?? '',
    website: input.website ?? '',
    address: input.address ?? '',
  }
}

/**
 * @param {Partial<BrandKit>} [input]
 * @returns {BrandKit}
 */
export function makeBrandKit(input = {}) {
  return {
    id: input.id ?? createRecordId('brand'),
    logos: makeLogos(input.logos),
    colors: makeColors(input.colors),
    typography: makeTypography(input.typography),
    contact: makeContact(input.contact),
    coverStyle: input.coverStyle ?? COVER_STYLE.MINIMAL,
    headerStyle: input.headerStyle ?? HEADER_STYLE.STANDARD,
    footerStyle: input.footerStyle ?? FOOTER_STYLE.STANDARD,
    watermarkEnabled: Boolean(input.watermarkEnabled),
    watermarkText: input.watermarkText ?? '',
    watermarkAssetId: input.watermarkAssetId ?? null,
    pageNumberPosition: input.pageNumberPosition ?? PAGE_NUMBER_POSITION.FOOTER_RIGHT,
    spacing: input.spacing ?? SPACING_SCALE.DEFAULT,
    documentBorder: input.documentBorder ?? '',
    cornerRadius: input.cornerRadius ?? '',
    buttonStyle: input.buttonStyle ?? '',
    iconStyle: input.iconStyle ?? '',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

/**
 * @param {Partial<BrandKit>} kit
 * @returns {{ field: string, message: string }[]}
 */
export function validateBrandKit(kit) {
  const errors = []
  const contact = kit.contact ?? {}

  if (kit.coverStyle && !COVER_STYLES.includes(kit.coverStyle)) {
    errors.push({ field: 'coverStyle', message: 'Cover style is not recognised.' })
  }

  if (kit.headerStyle && !HEADER_STYLES.includes(kit.headerStyle)) {
    errors.push({ field: 'headerStyle', message: 'Header style is not recognised.' })
  }

  if (kit.footerStyle && !FOOTER_STYLES.includes(kit.footerStyle)) {
    errors.push({ field: 'footerStyle', message: 'Footer style is not recognised.' })
  }

  if (kit.spacing && !SPACING_SCALES.includes(kit.spacing)) {
    errors.push({ field: 'spacing', message: 'Spacing scale is not recognised.' })
  }

  if (
    kit.pageNumberPosition &&
    !PAGE_NUMBER_POSITIONS.includes(kit.pageNumberPosition)
  ) {
    errors.push({
      field: 'pageNumberPosition',
      message: 'Page number position is not recognised.',
    })
  }

  if (contact.email && !EMAIL_PATTERN.test(contact.email)) {
    errors.push({ field: 'contact.email', message: 'Contact email is not valid.' })
  }

  return errors
}
