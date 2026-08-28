import { createRecordId, EMAIL_PATTERN } from './ids.js'

/**
 * Brand Kit — the workspace Company Identity.
 *
 * Filled once. Proposals and templates resolve it at render time rather than
 * cloning logos, colours, legal copy, team or testimonials onto every document.
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

export const SOCIAL_NETWORK = Object.freeze({
  LINKEDIN: 'linkedin',
  INSTAGRAM: 'instagram',
  X: 'x',
  FACEBOOK: 'facebook',
  YOUTUBE: 'youtube',
  BEHANCE: 'behance',
  DRIBBBLE: 'dribbble',
  OTHER: 'other',
})

export const SOCIAL_NETWORKS = Object.freeze(Object.values(SOCIAL_NETWORK))

export const SOCIAL_NETWORK_LABELS = Object.freeze({
  [SOCIAL_NETWORK.LINKEDIN]: 'LinkedIn',
  [SOCIAL_NETWORK.INSTAGRAM]: 'Instagram',
  [SOCIAL_NETWORK.X]: 'X',
  [SOCIAL_NETWORK.FACEBOOK]: 'Facebook',
  [SOCIAL_NETWORK.YOUTUBE]: 'YouTube',
  [SOCIAL_NETWORK.BEHANCE]: 'Behance',
  [SOCIAL_NETWORK.DRIBBBLE]: 'Dribbble',
  [SOCIAL_NETWORK.OTHER]: 'Other',
})

export const TAX_MODE = Object.freeze({
  NONE: 'none',
  EXCLUSIVE: 'exclusive',
  INCLUSIVE: 'inclusive',
})

export const TAX_MODES = Object.freeze(Object.values(TAX_MODE))

export const BRAND_FONTS = Object.freeze([
  {
    id: 'inter',
    label: 'Inter',
    stack:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    stack: "'DM Sans', Inter, sans-serif",
  },
  {
    id: 'outfit',
    label: 'Outfit',
    stack: 'Outfit, Inter, sans-serif',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    stack: "Georgia, 'Times New Roman', serif",
  },
  {
    id: 'garamond',
    label: 'Garamond',
    stack: "Garamond, 'Palatino Linotype', Palatino, serif",
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    stack: "'Playfair Display', Georgia, serif",
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    stack: 'Merriweather, Georgia, serif',
  },
  {
    id: 'helvetica',
    label: 'Helvetica',
    stack: 'Helvetica, Arial, sans-serif',
  },
  {
    id: 'system',
    label: 'System UI',
    stack: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
])

const FONT_BY_ID = new Map(BRAND_FONTS.map((font) => [font.id, font]))

export const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * @typedef {object} BrandAssetRef
 * @property {string | null} assetId
 * @property {string} url
 */

/**
 * @typedef {object} BrandLogos
 * @property {BrandAssetRef} primary
 * @property {BrandAssetRef} light
 * @property {BrandAssetRef} dark
 * @property {BrandAssetRef} favicon
 * @property {BrandAssetRef} cover
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
 * @property {string} fontFamily
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
 * @typedef {object} BrandSocialLink
 * @property {string} id
 * @property {string} network
 * @property {string} handle
 */

/**
 * @typedef {object} BrandSignature
 * @property {string} name
 * @property {string} role
 * @property {BrandAssetRef} image
 */

/**
 * @typedef {object} BrandTeamMember
 * @property {string} id
 * @property {string} name
 * @property {string} role
 * @property {string} bio
 * @property {BrandAssetRef} portrait
 */

/**
 * @typedef {object} BrandTestimonial
 * @property {string} id
 * @property {string} quote
 * @property {string} authorName
 * @property {string} authorRole
 * @property {string} company
 * @property {BrandAssetRef} portrait
 */

/**
 * @typedef {object} BrandBank
 * @property {string} accountName
 * @property {string} bankName
 * @property {string} accountNumber
 * @property {string} sortCode
 * @property {string} iban
 * @property {string} swift
 */

/**
 * @typedef {object} BrandTax
 * @property {boolean} registered
 * @property {string} taxId
 * @property {string} rate
 * @property {string} mode
 */

/**
 * @typedef {object} BrandKit
 * @property {string} id
 * @property {string} companyName
 * @property {string} description
 * @property {BrandLogos} logos
 * @property {BrandColors} colors
 * @property {BrandTypography} typography
 * @property {BrandContact} contact
 * @property {BrandSocialLink[]} socialLinks
 * @property {BrandSignature} signature
 * @property {BrandTeamMember[]} teamMembers
 * @property {BrandTestimonial[]} testimonials
 * @property {string} terms
 * @property {string} paymentTerms
 * @property {BrandBank} bank
 * @property {string} vatNumber
 * @property {BrandTax} tax
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

/**
 * @param {Partial<BrandAssetRef> | string | null | undefined} input
 * @returns {BrandAssetRef}
 */
export function makeAssetRef(input = null) {
  if (!input) {
    return { assetId: null, url: '' }
  }

  if (typeof input === 'string') {
    if (
      input.startsWith('blob:') ||
      input.startsWith('data:') ||
      /^https?:/i.test(input)
    ) {
      return { assetId: null, url: input }
    }

    return { assetId: input, url: '' }
  }

  return {
    assetId: input.assetId ?? input.id ?? null,
    url: input.url ?? '',
  }
}

export function assetRefUrl(ref) {
  if (!ref) return ''
  if (typeof ref === 'string') return ref
  return ref.url?.trim() || ''
}

export function fontStackFor(fontFamily) {
  return FONT_BY_ID.get(fontFamily)?.stack ?? BRAND_FONTS[0].stack
}

function makeLogos(input = {}) {
  return {
    primary: makeAssetRef(input.primary ?? input.mark),
    light: makeAssetRef(input.light),
    dark: makeAssetRef(input.dark),
    favicon: makeAssetRef(input.favicon ?? input.mark),
    cover: makeAssetRef(input.cover),
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
  const fontFamily = input.fontFamily || 'inter'
  const stack = input.headingFont || fontStackFor(fontFamily)

  return {
    fontFamily,
    headingFont: input.headingFont || stack,
    bodyFont: input.bodyFont || stack,
    scale: input.scale ?? 'default',
  }
}

function makeContact(input = {}, companyName = '') {
  return {
    legalName: input.legalName || companyName || '',
    email: input.email ?? '',
    phone: input.phone ?? '',
    website: input.website ?? '',
    address: input.address ?? '',
  }
}

/**
 * @param {Partial<BrandSocialLink>} [input]
 * @returns {BrandSocialLink}
 */
export function makeSocialLink(input = {}) {
  const network = SOCIAL_NETWORKS.includes(input.network)
    ? input.network
    : SOCIAL_NETWORK.LINKEDIN

  return {
    id: input.id ?? createRecordId('social'),
    network,
    handle: input.handle ?? '',
  }
}

function makeSignature(input = {}) {
  return {
    name: input.name ?? '',
    role: input.role ?? '',
    image: makeAssetRef(input.image),
  }
}

/**
 * @param {Partial<BrandTeamMember>} [input]
 * @returns {BrandTeamMember}
 */
export function makeBrandTeamMember(input = {}) {
  return {
    id: input.id ?? createRecordId('member'),
    name: input.name ?? '',
    role: input.role ?? '',
    bio: input.bio ?? '',
    portrait: makeAssetRef(input.portrait ?? input.portraitAssetId),
  }
}

/**
 * @param {Partial<BrandTestimonial>} [input]
 * @returns {BrandTestimonial}
 */
export function makeBrandTestimonial(input = {}) {
  return {
    id: input.id ?? createRecordId('quote'),
    quote: input.quote ?? '',
    authorName: input.authorName ?? '',
    authorRole: input.authorRole ?? '',
    company: input.company ?? '',
    portrait: makeAssetRef(input.portrait ?? input.portraitAssetId),
  }
}

function makeBank(input = {}) {
  return {
    accountName: input.accountName ?? '',
    bankName: input.bankName ?? '',
    accountNumber: input.accountNumber ?? '',
    sortCode: input.sortCode ?? '',
    iban: input.iban ?? '',
    swift: input.swift ?? '',
  }
}

function makeTax(input = {}) {
  const mode = TAX_MODES.includes(input.mode) ? input.mode : TAX_MODE.EXCLUSIVE

  return {
    registered: Boolean(input.registered),
    taxId: input.taxId ?? '',
    rate: input.rate == null ? '' : String(input.rate),
    mode,
  }
}

/**
 * @param {Partial<BrandKit>} [input]
 * @returns {BrandKit}
 */
export function makeBrandKit(input = {}) {
  const companyName = input.companyName ?? input.contact?.legalName ?? ''

  return {
    id: input.id ?? createRecordId('brand'),
    companyName,
    description: input.description ?? '',
    logos: makeLogos(input.logos),
    colors: makeColors(input.colors),
    typography: makeTypography(input.typography),
    contact: makeContact(input.contact, companyName),
    socialLinks: (input.socialLinks ?? []).map(makeSocialLink),
    signature: makeSignature(input.signature),
    teamMembers: (input.teamMembers ?? []).map(makeBrandTeamMember),
    testimonials: (input.testimonials ?? []).map(makeBrandTestimonial),
    terms: input.terms ?? '',
    paymentTerms: input.paymentTerms ?? '',
    bank: makeBank(input.bank),
    vatNumber: input.vatNumber ?? '',
    tax: makeTax(input.tax),
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

function validateHex(field, value, errors) {
  if (!value) return
  if (!HEX_COLOR_PATTERN.test(value.trim())) {
    errors.push({ field, message: 'Use a hex colour such as #14b8a6.' })
  }
}

/**
 * @param {Partial<BrandKit>} kit
 * @returns {{ field: string, message: string }[]}
 */
export function validateBrandKit(kit) {
  const errors = []
  const contact = kit.contact ?? {}
  const colors = kit.colors ?? {}
  const tax = kit.tax ?? {}

  if (!kit.companyName || !kit.companyName.trim()) {
    errors.push({ field: 'companyName', message: 'Company name is required.' })
  }

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

  validateHex('colors.primary', colors.primary, errors)
  validateHex('colors.secondary', colors.secondary, errors)
  validateHex('colors.accent', colors.accent, errors)

  if (kit.typography?.fontFamily && !FONT_BY_ID.has(kit.typography.fontFamily)) {
    errors.push({ field: 'typography.fontFamily', message: 'Font is not recognised.' })
  }

  ;(kit.socialLinks ?? []).forEach((link, index) => {
    if (link.network && !SOCIAL_NETWORKS.includes(link.network)) {
      errors.push({
        field: `socialLinks.${index}.network`,
        message: 'Social network is not recognised.',
      })
    }
  })

  ;(kit.teamMembers ?? []).forEach((member, index) => {
    if (!member.name?.trim()) {
      errors.push({
        field: `teamMembers.${index}.name`,
        message: 'Team member name is required.',
      })
    }
  })

  ;(kit.testimonials ?? []).forEach((item, index) => {
    if (!item.quote?.trim()) {
      errors.push({
        field: `testimonials.${index}.quote`,
        message: 'Testimonial quote is required.',
      })
    }

    if (!item.authorName?.trim()) {
      errors.push({
        field: `testimonials.${index}.authorName`,
        message: 'Author name is required.',
      })
    }
  })

  if (tax.mode && !TAX_MODES.includes(tax.mode)) {
    errors.push({ field: 'tax.mode', message: 'Tax mode is not recognised.' })
  }

  if (tax.rate) {
    const rate = Number(tax.rate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      errors.push({
        field: 'tax.rate',
        message: 'Tax rate must be between 0 and 100.',
      })
    }
  }

  return errors
}
