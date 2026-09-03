import { BRAND_FONTS } from '../models/brandKit.js'
import { alpha, deepMerge, mixHex, setPath } from './color.js'
import { getTheme } from './registry.js'
import { makeTokens, MOTION_PRESETS, stackFor } from './tokens.js'

function asUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.url ?? ''
}

export function seedFromProposal(proposal) {
  const doc = proposal && typeof proposal === 'object' ? proposal : {}
  return {
    metadata: {
      number: doc.id ? `PF-${String(doc.id).replace(/\D/g, '') || '0000'}` : '',
      version: String(doc.currentVersion ?? 1),
      issueDate: doc.createdAt?.slice?.(0, 10) ?? '',
      expiryDate: doc.validUntil?.slice?.(0, 10) ?? '',
      preparedFor: doc.clientName || doc.company || '',
      preparedBy: '',
    },
  }
}

export function seedFromBrand(brand) {
  const kit = brand && typeof brand === 'object' ? brand : {}
  return {
    branding: {
      logo: asUrl(kit.logos?.primary),
      logoLight: asUrl(kit.logos?.light),
      logoDark: asUrl(kit.logos?.dark),
      icon: asUrl(kit.logos?.mark),
      favicon: asUrl(kit.logos?.favicon),
    },
    colors: {
      accent: kit.colors?.accent || undefined,
      text: kit.colors?.text || undefined,
      background: kit.colors?.background || undefined,
    },
    typography: {
      headingFont: matchFont(kit.typography?.headingFont) || undefined,
      bodyFont: matchFont(kit.typography?.bodyFont) || undefined,
    },
  }
}

function matchFont(stack) {
  if (!stack) return ''
  const found = BRAND_FONTS.find(
    (font) => stack.includes(font.label) || stack === font.stack || stack === font.id,
  )
  return found?.id ?? ''
}

/**
 * Merge layers into a complete settings object.
 *
 * Later layers win. Future features inject a layer here — UI stays the same:
 * 1. Theme preset
 * 2. Workspace defaults (future)
 * 3. Organization defaults (future)
 * 4. Brand Kit seed
 * 5. Proposal metadata seed
 * 6. Saved design (manual / AI / API / import)
 */
export function resolveDesign(saved, proposal, brand, extras = {}) {
  const source = saved && typeof saved === 'object' ? saved : {}
  const themeId = source.themeId ?? 'modern'
  const preset = getTheme(themeId).tokens
  const merged = deepMerge(
    preset,
    deepMerge(
      extras.workspace ?? {},
      deepMerge(
        extras.organization ?? {},
        deepMerge(seedFromBrand(brand), deepMerge(seedFromProposal(proposal), source)),
      ),
    ),
  )
  return makeTokens({ ...merged, themeId })
}

export function applyThemeId(current, themeId) {
  const preset = getTheme(themeId).tokens
  return makeTokens({
    ...preset,
    themeId,
    branding: current?.branding,
    metadata: current?.metadata,
    chrome: current?.chrome,
    page: current?.page,
  })
}

export function patchDesign(design, path, value) {
  if (path === 'motion.speed') {
    const preset = MOTION_PRESETS[value] ?? MOTION_PRESETS.normal
    return setPath(
      { ...design, motion: { ...preset, speed: value, button: preset.base, card: preset.hover } },
      'motion.speed',
      value,
    )
  }

  let next = setPath(design, path, value)
  if (path === 'colors.accent') {
    if (design.colors.buttonPrimary === design.colors.accent) {
      next = setPath(next, 'colors.buttonPrimary', value)
    }
    if (design.colors.link === design.colors.accent) {
      next = setPath(next, 'colors.link', value)
    }
    next = setPath(next, 'colors.hover', mixHex(value, '#ffffff', 0.18))
  }
  return next
}

export function tokensToCssVars(tokens) {
  const heading = stackFor(tokens.typography.headingFont)
  const body = stackFor(tokens.typography.bodyFont)
  const radius = `${tokens.layout.radius}px`
  const shadow = tokens.elevation.md
  const overlay = alpha('#000000', tokens.cover.overlay)
  const align =
    tokens.cover.align === 'center'
      ? 'center'
      : tokens.cover.align === 'end'
        ? 'end'
        : 'start'
  const logoAlign =
    tokens.branding.logoAlign === 'center'
      ? 'center'
      : tokens.branding.logoAlign === 'end'
        ? 'flex-end'
        : 'flex-start'
  const card = tokens.components.card
  const button = tokens.components.button

  return {
    '--pf-theme': tokens.themeId,
    '--color-bg': tokens.colors.background,
    '--color-surface': tokens.colors.surface,
    '--color-surface-raised': tokens.colors.card,
    '--color-surface-hover': mixHex(tokens.colors.card, '#ffffff', 0.06),
    '--color-border': tokens.colors.border,
    '--color-text': tokens.colors.text,
    '--color-text-secondary': mixHex(tokens.colors.text, tokens.colors.muted, 0.45),
    '--color-text-muted': tokens.colors.muted,
    '--color-accent': tokens.colors.accent,
    '--color-accent-hover': tokens.colors.hover,
    '--color-accent-contrast': tokens.colors.contrast,
    '--color-accent-soft': tokens.colors.accentSoft,
    '--color-accent-border': tokens.colors.accentBorder,
    '--color-success': tokens.colors.success,
    '--color-warning': tokens.colors.warning,
    '--color-danger': tokens.colors.error,
    '--color-overlay': tokens.colors.overlay,
    '--color-link': tokens.colors.link,
    '--color-button-primary': button.primaryBg,
    '--color-button-secondary': button.secondaryBg,
    '--doc-accent': tokens.colors.accent,
    '--doc-primary': tokens.colors.accent,
    '--doc-secondary': tokens.colors.border,
    '--doc-heading-font': heading,
    '--doc-body-font': body,
    '--font-sans': body,
    '--radius-sm': `${Math.max(4, tokens.layout.radius - 8)}px`,
    '--radius-md': `${Math.max(6, tokens.layout.radius - 4)}px`,
    '--radius-lg': radius,
    '--radius-xl': `${tokens.layout.radius + 6}px`,
    '--shadow-md': shadow,
    '--shadow-lg': tokens.elevation.lg,
    '--shadow-accent': `0 4px 16px ${tokens.colors.accentSoft}`,
    '--transition-fast': tokens.motion.hover,
    '--transition-base': tokens.motion.base,
    '--pf-logo-size': `${tokens.branding.logoSize}px`,
    '--pf-logo-align': logoAlign,
    '--pf-logo-spacing': `${tokens.branding.logoSpacing}px`,
    '--pf-cover-padding': `${tokens.cover.padding}px`,
    '--pf-cover-overlay': overlay,
    '--pf-cover-bg-image': tokens.cover.backgroundImage
      ? `url("${tokens.cover.backgroundImage}")`
      : 'none',
    '--pf-cover-align': align,
    '--pf-cover-width': `${tokens.cover.contentWidth}%`,
    '--pf-cover-image-size': `${tokens.cover.imageSize}%`,
    '--pf-section-gap': `${tokens.layout.sectionSpacing}px`,
    '--pf-content-gap': `${tokens.layout.contentSpacing}px`,
    '--pf-container': `${tokens.layout.containerWidth}rem`,
    '--pf-measure': `${tokens.layout.columnWidth}ch`,
    '--pf-grid-gap': `${tokens.layout.gridGap}px`,
    '--pf-doc-margin': `${tokens.layout.margin}px`,
    '--pf-doc-padding': `${tokens.layout.padding}px`,
    '--pf-type-scale': String(tokens.typography.scale),
    '--pf-letter-spacing': `${tokens.typography.letterSpacing}em`,
    '--pf-line-height': String(tokens.typography.lineHeight),
    '--pf-paragraph': `${tokens.typography.paragraphSpacing}em`,
    '--pf-button-weight': String(tokens.typography.buttonWeight),
    '--pf-motion-reveal': tokens.motion.reveal,
    '--pf-motion-page': tokens.motion.page,
    '--pf-motion-hover': tokens.motion.hover,
    '--pf-motion-button': tokens.motion.button,
    '--pf-motion-card': tokens.motion.card,
    '--pf-chrome-gap': `${tokens.chrome.spacing}px`,
    '--pf-card-bg': card.background,
    '--pf-card-radius': `${card.radius}px`,
    '--pf-card-padding': `${card.padding}px`,
    '--pf-btn-radius': `${button.radius}px`,
    '--pf-btn-weight': String(button.weight),
    '--pf-badge-bg': tokens.components.badge.background,
    '--pf-badge-fg': tokens.components.badge.color,
    '--pf-icon-color': tokens.components.icon.color,
    '--pf-gallery-radius': `${tokens.components.gallery.radius}px`,
  }
}
