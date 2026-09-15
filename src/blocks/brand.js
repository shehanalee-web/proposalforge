import {
  assetRefUrl,
  fontStackFor,
  makeBrandKit,
  SOCIAL_NETWORK,
  SOCIAL_NETWORK_LABELS,
} from '../models/brandKit.js'

const DEFAULT_ACCENT = '#14b8a6'

const SOCIAL_HREF = Object.freeze({
  [SOCIAL_NETWORK.LINKEDIN]: (handle) => `https://www.linkedin.com/in/${handle}`,
  [SOCIAL_NETWORK.INSTAGRAM]: (handle) => `https://www.instagram.com/${handle}`,
  [SOCIAL_NETWORK.X]: (handle) => `https://x.com/${handle}`,
  [SOCIAL_NETWORK.FACEBOOK]: (handle) => `https://www.facebook.com/${handle}`,
  [SOCIAL_NETWORK.YOUTUBE]: (handle) => `https://www.youtube.com/@${handle}`,
  [SOCIAL_NETWORK.BEHANCE]: (handle) => `https://www.behance.net/${handle}`,
  [SOCIAL_NETWORK.DRIBBBLE]: (handle) => `https://dribbble.com/${handle}`,
})

function logoUrl(kit, key) {
  return assetRefUrl(kit?.logos?.[key])
}

function socialHref(network, handle) {
  const trimmed = handle?.trim?.() ?? ''
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const build = SOCIAL_HREF[network]
  if (!build) return ''

  const slug = trimmed.replace(/^@+/, '')
  if (!slug) return ''
  return build(slug)
}

/**
 * Resolve Brand Kit social links for document renderers.
 *
 * Authored http(s) handles are kept as-is. Other handles are mapped from
 * SOCIAL_NETWORK. Blank handles and networks with no canonical host are omitted.
 *
 * @param {Partial<import('../models/brandKit.js').BrandKit> | null | undefined} brand
 * @returns {{ id: string, network: string, handle: string, href: string, label: string }[]}
 */
export function resolveSocialLinks(brand) {
  return (brand?.socialLinks ?? [])
    .map((link) => {
      const handle = link?.handle?.trim?.() ?? ''
      const href = socialHref(link?.network, handle)
      const label = SOCIAL_NETWORK_LABELS[link?.network]
      if (!href || !label) return null

      return {
        id: link.id,
        network: link.network,
        handle,
        href,
        label,
      }
    })
    .filter(Boolean)
}

/**
 * Resolve Brand Kit for document renderers.
 *
 * Company Identity is the source of truth. Settings fill empty name/email/
 * description until they are set on the kit. Logo fields are flattened to
 * display URLs so screen and PDF blocks can consume them as strings.
 *
 * @param {import('../models/settings.js').Settings | null | undefined} settings
 * @param {Partial<import('../models/brandKit.js').BrandKit> | null | undefined} kit
 */
export function resolveBrand(settings, kit) {
  const base = makeBrandKit(kit ?? {})
  const companyName =
    base.companyName.trim() ||
    base.contact.legalName.trim() ||
    settings?.studioName?.trim() ||
    'ProposalForge'
  const stack = fontStackFor(base.typography.fontFamily)

  return {
    ...base,
    companyName,
    description: base.description.trim() || settings?.about?.trim() || '',
    contact: {
      ...base.contact,
      legalName: companyName,
      email: base.contact.email.trim() || settings?.contactEmail?.trim() || '',
    },
    logos: {
      primary: logoUrl(base, 'primary'),
      light: logoUrl(base, 'light'),
      dark: logoUrl(base, 'dark'),
      mark: logoUrl(base, 'favicon') || logoUrl(base, 'primary'),
      favicon: logoUrl(base, 'favicon'),
      cover: logoUrl(base, 'cover'),
    },
    colors: {
      ...base.colors,
      accent: base.colors.accent || DEFAULT_ACCENT,
      primary: base.colors.primary || DEFAULT_ACCENT,
      secondary: base.colors.secondary || '',
      text: base.colors.text || '',
      background: base.colors.background || '',
    },
    typography: {
      ...base.typography,
      headingFont: base.typography.headingFont || stack,
      bodyFont: base.typography.bodyFont || stack,
    },
    signature: {
      ...base.signature,
      imageUrl: assetRefUrl(base.signature.image),
    },
    teamMembers: base.teamMembers.map((member) => ({
      ...member,
      photoUrl: assetRefUrl(member.portrait),
    })),
    testimonials: base.testimonials.map((item) => ({
      ...item,
      portraitUrl: assetRefUrl(item.portrait),
    })),
  }
}

export function brandToCssVars(brand) {
  const heading = brand.typography.headingFont?.trim()
  const body = brand.typography.bodyFont?.trim()

  return {
    '--doc-accent': brand.colors.accent,
    '--doc-primary': brand.colors.primary,
    '--doc-secondary': brand.colors.secondary || brand.colors.primary,
    '--doc-heading-font': heading || 'inherit',
    '--doc-body-font': body || 'inherit',
  }
}

export function studioNameFromBrand(brand, settings) {
  return (
    brand?.companyName?.trim() ||
    brand?.contact?.legalName?.trim() ||
    settings?.studioName?.trim() ||
    'ProposalForge'
  )
}

export function signatoryFromBrand(brand, settings) {
  const name = brand?.signature?.name?.trim()
  if (name) return name
  return studioNameFromBrand(brand, settings)
}

export function resolveLogoUrl(brand, surface = 'light') {
  if (surface === 'dark') {
    return brand?.logos?.dark || brand?.logos?.primary || ''
  }

  return brand?.logos?.light || brand?.logos?.primary || ''
}

export function resolveCoverImage(instance, brand) {
  return instance?.data?.imageUrl?.trim() || brand?.logos?.cover || ''
}

export function resolveTermsBody(instance, proposal, brand) {
  return (
    instance?.data?.body?.trim() ||
    proposal?.terms?.trim() ||
    brand?.terms?.trim() ||
    ''
  )
}

export function resolvePaymentTerms(instance, proposal, brand) {
  const custom =
    Boolean(instance?.data?.body?.trim()) || Boolean(proposal?.terms?.trim())

  if (custom) return ''
  return brand?.paymentTerms?.trim() || ''
}

export function resolveTeamMembers(instance, brand) {
  const local = (instance?.data?.members ?? []).filter((member) =>
    member.name?.trim(),
  )

  if (local.length > 0) return local

  return (brand?.teamMembers ?? [])
    .filter((member) => member.name?.trim())
    .map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      bio: member.bio,
      photoUrl: member.photoUrl || assetRefUrl(member.portrait),
    }))
}

export function resolveTestimonials(instance, brand) {
  const local = (instance?.data?.items ?? []).filter((item) =>
    item.quote?.trim(),
  )

  if (local.length > 0) return local

  return (brand?.testimonials ?? [])
    .filter((item) => item.quote?.trim())
    .map((item) => ({
      id: item.id,
      quote: item.quote,
      authorName: item.authorName,
      authorRole: item.authorRole,
      company: item.company,
      portraitUrl: item.portraitUrl || assetRefUrl(item.portrait),
    }))
}
