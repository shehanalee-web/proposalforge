import { makeTokens } from './tokens.js'

function theme(id, label, description, patch) {
  return {
    id,
    label,
    description,
    tokens: makeTokens({ themeId: id, ...patch }),
  }
}

export const THEME_PRESETS = Object.freeze([
  theme('modern', 'Modern', 'ProposalForge default — dark, teal, precise.', {
    colors: {
      background: '#111111',
      surface: '#171717',
      card: '#1c1c1c',
      accent: '#14b8a6',
      text: '#f4f4f5',
      muted: '#71717a',
      border: '#262626',
    },
  }),
  theme('luxury', 'Luxury', 'Warm gold on near-black with editorial serif.', {
    typography: { headingFont: 'playfair', bodyFont: 'garamond', letterSpacing: -0.03, lineHeight: 1.65 },
    colors: {
      background: '#0c0a09',
      surface: '#14110f',
      card: '#1c1814',
      accent: '#d4af37',
      text: '#f5ecd7',
      muted: '#a8a29e',
      border: '#3f3a32',
    },
    layout: { radius: 8, sectionSpacing: 56 },
  }),
  theme('minimal', 'Minimal', 'Quiet surfaces, wide type, almost no chrome.', {
    typography: { headingFont: 'helvetica', bodyFont: 'helvetica', scale: 1.05, letterSpacing: -0.04 },
    colors: {
      background: '#fafafa',
      surface: '#ffffff',
      card: '#f4f4f5',
      accent: '#18181b',
      text: '#18181b',
      muted: '#71717a',
      border: '#e4e4e7',
    },
    layout: { radius: 4, shadow: 0.08, sectionSpacing: 64 },
    cover: { layout: 'minimal', overlay: 0 },
  }),
  theme('corporate', 'Corporate', 'Navy structure with a confident blue accent.', {
    typography: { headingFont: 'inter', bodyFont: 'inter' },
    colors: {
      background: '#0b1220',
      surface: '#111827',
      card: '#1e293b',
      accent: '#3b82f6',
      text: '#f8fafc',
      muted: '#94a3b8',
      border: '#1e293b',
    },
  }),
  theme('creative', 'Creative', 'Saturated violet and generous radius.', {
    typography: { headingFont: 'outfit', bodyFont: 'dm-sans' },
    colors: {
      background: '#120018',
      surface: '#1a0524',
      card: '#241333',
      accent: '#d946ef',
      text: '#fdf4ff',
      muted: '#c4b5fd',
      border: '#4c1d95',
    },
    layout: { radius: 22 },
  }),
  theme('architect', 'Architect', 'Stone, graphite, and measured serif headings.', {
    typography: { headingFont: 'georgia', bodyFont: 'inter', lineHeight: 1.7 },
    colors: {
      background: '#161412',
      surface: '#1c1a17',
      card: '#24211c',
      accent: '#b45309',
      text: '#f5f0e8',
      muted: '#a8a29e',
      border: '#3f3a32',
    },
    cover: { layout: 'split' },
  }),
  theme('construction', 'Construction', 'High-contrast safety orange on charcoal.', {
    typography: { headingFont: 'outfit', bodyFont: 'inter' },
    colors: {
      background: '#0f0f10',
      surface: '#18181b',
      card: '#27272a',
      accent: '#f97316',
      text: '#fafafa',
      muted: '#a1a1aa',
      border: '#3f3f46',
    },
  }),
  theme('agency', 'Agency', 'Sharp black with a punchy rose accent.', {
    typography: { headingFont: 'dm-sans', bodyFont: 'dm-sans', letterSpacing: -0.045 },
    colors: {
      background: '#09090b',
      surface: '#121214',
      card: '#1c1c1f',
      accent: '#fb7185',
      text: '#fafafa',
      muted: '#a1a1aa',
      border: '#27272a',
    },
    layout: { radius: 18 },
  }),
  theme('consulting', 'Consulting', 'Slate, serif body, restrained motion.', {
    typography: { headingFont: 'merriweather', bodyFont: 'georgia', lineHeight: 1.75 },
    colors: {
      background: '#0f172a',
      surface: '#1e293b',
      card: '#334155',
      accent: '#38bdf8',
      text: '#f1f5f9',
      muted: '#94a3b8',
      border: '#334155',
    },
    motion: { speed: 'slow' },
  }),
  theme('technology', 'Technology', 'Cool cyan on a dense dark canvas.', {
    typography: { headingFont: 'outfit', bodyFont: 'system' },
    colors: {
      background: '#020617',
      surface: '#0b1220',
      card: '#111827',
      accent: '#22d3ee',
      text: '#ecfeff',
      muted: '#67e8f9',
      border: '#164e63',
    },
  }),
])

const BY_ID = new Map(THEME_PRESETS.map((preset) => [preset.id, preset]))

export function listThemes() {
  return THEME_PRESETS
}

export function getTheme(id) {
  return BY_ID.get(id) ?? BY_ID.get('modern')
}
