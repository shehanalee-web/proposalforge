import { stackFor } from './tokens.js'

/**
 * Overlay proposal design tokens onto the resolved Brand Kit.
 * Screen and PDF renderers keep reading `brand` — no layout change required
 * when a future API writes the same design object.
 */
export function applyDesignToBrand(brand, design) {
  if (!brand || !design) return brand

  return {
    ...brand,
    logos: {
      ...brand.logos,
      primary: design.branding.logo || brand.logos.primary,
      light: design.branding.logoLight || brand.logos.light,
      dark: design.branding.logoDark || brand.logos.dark,
      mark: design.branding.icon || brand.logos.mark,
      favicon: design.branding.favicon || brand.logos.favicon,
      cover: design.cover.backgroundImage || brand.logos.cover,
    },
    colors: {
      ...brand.colors,
      accent: design.colors.accent || brand.colors.accent,
      primary: design.colors.accent || brand.colors.primary,
      text: design.colors.text || brand.colors.text,
      background: design.colors.background || brand.colors.background,
    },
    typography: {
      ...brand.typography,
      headingFont: stackFor(design.typography.headingFont) || brand.typography.headingFont,
      bodyFont: stackFor(design.typography.bodyFont) || brand.typography.bodyFont,
    },
  }
}
