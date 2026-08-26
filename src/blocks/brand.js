import { makeBrandKit } from '../models/brandKit.js'

const DEFAULT_ACCENT = '#14b8a6'

/**
 * Resolve Brand Kit for document renderers.
 *
 * Settings fill identity until Brand Kit CRUD owns those fields. Empty kit
 * values inherit product defaults so every block is branded automatically.
 *
 * @param {import('../models/settings.js').Settings | null | undefined} settings
 * @param {Partial<import('../models/brandKit.js').BrandKit> | null | undefined} kit
 */
export function resolveBrand(settings, kit) {
  const base = makeBrandKit(kit ?? {})

  return makeBrandKit({
    ...base,
    contact: {
      ...base.contact,
      legalName: base.contact.legalName || settings?.studioName || 'ProposalForge',
      email: base.contact.email || settings?.contactEmail || '',
    },
    colors: {
      ...base.colors,
      accent: base.colors.accent || DEFAULT_ACCENT,
      primary: base.colors.primary || DEFAULT_ACCENT,
      text: base.colors.text || '',
      background: base.colors.background || '',
    },
  })
}

export function brandToCssVars(brand) {
  const heading = brand.typography.headingFont?.trim()
  const body = brand.typography.bodyFont?.trim()

  return {
    '--doc-accent': brand.colors.accent,
    '--doc-primary': brand.colors.primary,
    '--doc-heading-font': heading || 'inherit',
    '--doc-body-font': body || 'inherit',
  }
}

export function studioNameFromBrand(brand, settings) {
  return (
    brand?.contact?.legalName?.trim() ||
    settings?.studioName?.trim() ||
    'ProposalForge'
  )
}
