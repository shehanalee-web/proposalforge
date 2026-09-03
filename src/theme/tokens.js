import { BRAND_FONTS, fontStackFor } from '../models/brandKit.js'
import { alpha, contrastText, mixHex } from './color.js'

export const MOTION_PRESETS = Object.freeze({
  fast: { hover: '120ms', base: '140ms', reveal: '160ms', page: '180ms' },
  normal: { hover: '160ms', base: '180ms', reveal: '200ms', page: '220ms' },
  slow: { hover: '200ms', base: '220ms', reveal: '220ms', page: '220ms' },
})

export const FONT_OPTIONS = BRAND_FONTS

export function stackFor(fontId) {
  return fontStackFor(fontId)
}

function motionFrom(input = {}) {
  const speed = input.speed ?? 'normal'
  const preset = MOTION_PRESETS[speed] ?? MOTION_PRESETS.normal
  return {
    speed,
    hover: input.hover ?? preset.hover,
    base: input.base ?? preset.base,
    reveal: input.reveal ?? preset.reveal,
    page: input.page ?? preset.page,
    button: input.button ?? preset.base,
    card: input.card ?? preset.hover,
  }
}

/**
 * Canonical token tree consumed by documents.
 * Components read CSS variables generated from this object — never the theme id.
 *
 * Future AI / Brand Kits / workspace defaults / API payloads should patch this
 * object (or a layer merged in resolveDesign). UI components stay unchanged.
 */
export function makeTokens(input = {}) {
  const colors = input.colors ?? {}
  const accent = colors.accent ?? '#14b8a6'
  const background = colors.background ?? '#111111'
  const surface = colors.surface ?? '#171717'
  const card = colors.card ?? '#1c1c1c'
  const text = colors.text ?? '#f4f4f5'
  const muted = colors.muted ?? '#71717a'
  const border = colors.border ?? '#262626'
  const buttonPrimary = colors.buttonPrimary ?? accent
  const hover = colors.hover ?? mixHex(accent, '#ffffff', 0.18)
  const radius = input.layout?.radius ?? 14
  const shadow = input.layout?.shadow ?? 0.35
  const gridGap = input.layout?.gridGap ?? 16
  const pad = input.layout?.padding ?? 24
  const motion = motionFrom(input.motion)
  const components = input.components ?? {}

  return {
    themeId: input.themeId ?? 'modern',
    branding: {
      logo: input.branding?.logo ?? '',
      logoDark: input.branding?.logoDark ?? '',
      logoLight: input.branding?.logoLight ?? '',
      icon: input.branding?.icon ?? '',
      favicon: input.branding?.favicon ?? '',
      logoSize: input.branding?.logoSize ?? 36,
      logoAlign: input.branding?.logoAlign ?? 'start',
      logoSpacing: input.branding?.logoSpacing ?? 12,
    },
    colors: {
      background,
      surface,
      card,
      accent,
      buttonPrimary,
      buttonSecondary: colors.buttonSecondary ?? mixHex(surface, '#ffffff', 0.08),
      text,
      muted,
      link: colors.link ?? accent,
      border,
      success: colors.success ?? '#22c55e',
      warning: colors.warning ?? '#f59e0b',
      error: colors.error ?? '#ef4444',
      hover,
      accentSoft: alpha(accent, 0.12),
      accentBorder: alpha(accent, 0.32),
      overlay: colors.overlay ?? 'rgba(0, 0, 0, 0.62)',
      contrast: contrastText(buttonPrimary),
    },
    typography: {
      headingFont: input.typography?.headingFont ?? 'inter',
      bodyFont: input.typography?.bodyFont ?? 'inter',
      scale: input.typography?.scale ?? 1,
      letterSpacing: input.typography?.letterSpacing ?? -0.02,
      paragraphSpacing: input.typography?.paragraphSpacing ?? 1,
      lineHeight: input.typography?.lineHeight ?? 1.6,
      buttonWeight: input.typography?.buttonWeight ?? 650,
    },
    cover: {
      layout: input.cover?.layout ?? 'stacked',
      imagePosition: input.cover?.imagePosition ?? 'bottom',
      imageSize: input.cover?.imageSize ?? 100,
      overlay: input.cover?.overlay ?? 0.18,
      backgroundImage: input.cover?.backgroundImage ?? '',
      gradient: input.cover?.gradient ?? false,
      pattern: input.cover?.pattern ?? 'none',
      align: input.cover?.align ?? 'start',
      contentWidth: input.cover?.contentWidth ?? 100,
      padding: input.cover?.padding ?? 32,
    },
    chrome: {
      showLogo: input.chrome?.showLogo ?? true,
      showCompany: input.chrome?.showCompany ?? true,
      showNumber: input.chrome?.showNumber ?? true,
      showPageNumbers: input.chrome?.showPageNumbers ?? true,
      showFooterNotes: input.chrome?.showFooterNotes ?? true,
      showConfidential: input.chrome?.showConfidential ?? false,
      showExpiry: input.chrome?.showExpiry ?? true,
      footerAlign: input.chrome?.footerAlign ?? 'space-between',
      spacing: input.chrome?.spacing ?? 16,
    },
    layout: {
      containerWidth: input.layout?.containerWidth ?? 52,
      sectionSpacing: input.layout?.sectionSpacing ?? 48,
      contentSpacing: input.layout?.contentSpacing ?? 16,
      radius,
      shadow,
      gridGap,
      columnWidth: input.layout?.columnWidth ?? 68,
      motionDensity: input.layout?.motionDensity ?? 'normal',
      margin: input.layout?.margin ?? 24,
      padding: pad,
    },
    motion,
    page: {
      stickyHeader: input.page?.stickyHeader ?? true,
      showProgress: input.page?.showProgress ?? true,
      compactMobile: input.page?.compactMobile ?? true,
    },
    metadata: {
      number: input.metadata?.number ?? '',
      version: input.metadata?.version ?? '1',
      issueDate: input.metadata?.issueDate ?? '',
      expiryDate: input.metadata?.expiryDate ?? '',
      preparedBy: input.metadata?.preparedBy ?? '',
      preparedFor: input.metadata?.preparedFor ?? '',
      confidential: input.metadata?.confidential ?? false,
      draftWatermark: input.metadata?.draftWatermark ?? false,
      internalNotes: input.metadata?.internalNotes ?? '',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 40,
      section: input.layout?.sectionSpacing ?? 48,
      content: input.layout?.contentSpacing ?? 16,
    },
    elevation: {
      none: 'none',
      sm: `0 4px 12px rgba(0, 0, 0, ${Math.max(0.08, shadow * 0.45)})`,
      md: `0 12px 32px rgba(0, 0, 0, ${shadow})`,
      lg: `0 24px 48px rgba(0, 0, 0, ${Math.min(0.7, shadow + 0.12)})`,
    },
    components: {
      card: {
        background: components.card?.background ?? card,
        border: components.card?.border ?? border,
        radius: components.card?.radius ?? radius,
        padding: components.card?.padding ?? pad,
        shadow: components.card?.shadow ?? shadow,
      },
      button: {
        radius: components.button?.radius ?? Math.max(6, radius - 4),
        weight: components.button?.weight ?? (input.typography?.buttonWeight ?? 650),
        primaryBg: components.button?.primaryBg ?? buttonPrimary,
        secondaryBg: components.button?.secondaryBg ?? mixHex(surface, '#ffffff', 0.08),
        text: components.button?.text ?? contrastText(buttonPrimary),
        paddingX: components.button?.paddingX ?? 16,
        paddingY: components.button?.paddingY ?? 10,
      },
      pricing: {
        accent: components.pricing?.accent ?? accent,
        radius: components.pricing?.radius ?? radius,
        background: components.pricing?.background ?? card,
      },
      testimonial: {
        background: components.testimonial?.background ?? surface,
        border: components.testimonial?.border ?? border,
        radius: components.testimonial?.radius ?? radius,
      },
      timeline: {
        accent: components.timeline?.accent ?? accent,
        line: components.timeline?.line ?? border,
      },
      faq: {
        border: components.faq?.border ?? border,
        radius: components.faq?.radius ?? radius,
        background: components.faq?.background ?? surface,
      },
      table: {
        border: components.table?.border ?? border,
        header: components.table?.header ?? muted,
        radius: components.table?.radius ?? Math.max(4, radius - 8),
      },
      image: {
        radius: components.image?.radius ?? Math.max(6, radius - 4),
      },
      gallery: {
        gap: components.gallery?.gap ?? gridGap,
        radius: components.gallery?.radius ?? radius,
      },
      badge: {
        background: components.badge?.background ?? alpha(accent, 0.12),
        color: components.badge?.color ?? accent,
        radius: components.badge?.radius ?? 999,
      },
      icon: {
        color: components.icon?.color ?? accent,
        size: components.icon?.size ?? 18,
      },
      form: {
        background: components.form?.background ?? surface,
        border: components.form?.border ?? border,
        radius: components.form?.radius ?? Math.max(6, radius - 4),
      },
      navigation: {
        background: components.navigation?.background ?? surface,
        border: components.navigation?.border ?? border,
        height: components.navigation?.height ?? 56,
      },
    },
  }
}
