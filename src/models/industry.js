/**
 * Industries used to browse services when creating a proposal.
 *
 * This is the platform taxonomy. Add entries here as the product expands;
 * Create Proposal always lists the full set. Services for each industry live
 * in catalogue seed data, not in this file.
 */

export const INDUSTRY = Object.freeze({
  ALL: '',
  ARCHITECTURE: 'architecture',
  CONSTRUCTION: 'construction',
  MANUFACTURING: 'manufacturing',
  PRINTING_3D: '3d-printing',
  INTERIOR_DESIGN: 'interior-design',
  CREATIVE: 'creative',
  MARKETING: 'marketing',
  BRANDING: 'branding',
  ADVERTISING: 'advertising',
  DIGITAL: 'digital',
  SOFTWARE: 'software',
  FINANCE: 'finance',
  LEGAL: 'legal',
  HEALTHCARE: 'healthcare',
  EDUCATION: 'education',
  REAL_ESTATE: 'real-estate',
  HOSPITALITY: 'hospitality',
  RETAIL: 'retail',
  EVENTS: 'events',
  ENGINEERING: 'engineering',
  CONSULTING: 'consulting',
  HR: 'hr',
  GOVERNMENT: 'government',
  LOGISTICS: 'logistics',
  ENERGY: 'energy',
  TELECOMMUNICATIONS: 'telecommunications',
  AUTOMOTIVE: 'automotive',
  BEAUTY: 'beauty',
  NONPROFIT: 'nonprofit',
  AGRICULTURE: 'agriculture',
  MEDIA: 'media',
  TECHNOLOGY: 'technology',
})

/**
 * @typedef {object} Industry
 * @property {string} id
 * @property {string} label
 * @property {string} color  Accent hex used in the industry picker.
 * @property {string} icon   Icon name from the workspace icon set.
 */

/** @type {readonly Industry[]} */
export const INDUSTRIES = Object.freeze([
  { id: INDUSTRY.ALL,           label: 'All Industries', color: '#71717a', icon: 'services' },
  { id: INDUSTRY.ARCHITECTURE,  label: 'Architecture',   color: '#5b8def', icon: 'typeArchitecture' },
  { id: INDUSTRY.CONSTRUCTION,  label: 'Construction',   color: '#fb923c', icon: 'typeConstruction' },
  { id: INDUSTRY.MANUFACTURING, label: 'Manufacturing',  color: '#f97316', icon: 'settings' },
  { id: INDUSTRY.PRINTING_3D,   label: '3D Printing',    color: '#a78bfa', icon: 'typeArchitecture' },
  { id: INDUSTRY.INTERIOR_DESIGN, label: 'Interior Design', color: '#e879f9', icon: 'brand' },
  { id: INDUSTRY.CREATIVE,      label: 'Creative',       color: '#a78bfa', icon: 'typeAgency' },
  { id: INDUSTRY.MARKETING,     label: 'Marketing',      color: '#14b8a6', icon: 'typeMarketing' },
  { id: INDUSTRY.BRANDING,      label: 'Branding',       color: '#f472b6', icon: 'typeAgency' },
  { id: INDUSTRY.ADVERTISING,   label: 'Advertising',    color: '#fbbf24', icon: 'typeMarketing' },
  { id: INDUSTRY.DIGITAL,       label: 'Digital',        color: '#38bdf8', icon: 'typeSoftware' },
  { id: INDUSTRY.SOFTWARE,      label: 'Software',       color: '#38bdf8', icon: 'typeSoftware' },
  { id: INDUSTRY.FINANCE,       label: 'Finance',        color: '#4ade80', icon: 'settings' },
  { id: INDUSTRY.LEGAL,         label: 'Legal',          color: '#94a3b8', icon: 'proposals' },
  { id: INDUSTRY.HEALTHCARE,    label: 'Healthcare',     color: '#f87171', icon: 'team' },
  { id: INDUSTRY.EDUCATION,     label: 'Education',      color: '#60a5fa', icon: 'content' },
  { id: INDUSTRY.REAL_ESTATE,   label: 'Real Estate',    color: '#34d399', icon: 'typeConstruction' },
  { id: INDUSTRY.HOSPITALITY,   label: 'Hospitality',    color: '#fcd34d', icon: 'brand' },
  { id: INDUSTRY.RETAIL,        label: 'Retail',         color: '#fb923c', icon: 'typeCatalogue' },
  { id: INDUSTRY.EVENTS,        label: 'Events',         color: '#c084fc', icon: 'typeAgency' },
  { id: INDUSTRY.ENGINEERING,   label: 'Engineering',    color: '#67e8f9', icon: 'typeConstruction' },
  { id: INDUSTRY.CONSULTING,    label: 'Consulting',     color: '#a3e635', icon: 'proposals' },
  { id: INDUSTRY.HR,            label: 'HR',             color: '#f9a8d4', icon: 'team' },
  { id: INDUSTRY.GOVERNMENT,    label: 'Government',     color: '#93c5fd', icon: 'proposals' },
  { id: INDUSTRY.LOGISTICS,     label: 'Logistics',      color: '#fdba74', icon: 'assets' },
  { id: INDUSTRY.ENERGY,        label: 'Energy',         color: '#facc15', icon: 'settings' },
  { id: INDUSTRY.TELECOMMUNICATIONS, label: 'Telecommunications', color: '#22d3ee', icon: 'typeSoftware' },
  { id: INDUSTRY.AUTOMOTIVE,    label: 'Automotive',     color: '#fb7185', icon: 'assets' },
  { id: INDUSTRY.BEAUTY,        label: 'Beauty',         color: '#e879f9', icon: 'brand' },
  { id: INDUSTRY.NONPROFIT,     label: 'Non-profit',     color: '#86efac', icon: 'team' },
  { id: INDUSTRY.AGRICULTURE,   label: 'Agriculture',    color: '#84cc16', icon: 'content' },
  { id: INDUSTRY.MEDIA,         label: 'Media',          color: '#c084fc', icon: 'typeMotion' },
  { id: INDUSTRY.TECHNOLOGY,    label: 'Technology',     color: '#818cf8', icon: 'typeSoftware' },
])

const INDUSTRY_BY_ID = new Map(INDUSTRIES.map((industry) => [industry.id, industry]))

/**
 * @param {string} [id]
 * @returns {string}
 */
export function getIndustryLabel(id) {
  return INDUSTRY_BY_ID.get(id ?? '')?.label ?? ''
}

/**
 * Match a service title onto a known industry without a catalog override.
 * Title-only so marketing copy like "digital launches" does not mis-tag.
 *
 * @param {string} [title]
 * @returns {string}
 */
export function inferIndustry(title) {
  const text = String(title ?? '').trim().toLowerCase()
  if (!text) return INDUSTRY.ALL

  for (const industry of INDUSTRIES) {
    if (!industry.id) continue

    const label = industry.label.toLowerCase()
    const slug = industry.id.replace(/-/g, ' ')

    if (text.includes(label) || text.includes(slug)) {
      return industry.id
    }
  }

  return INDUSTRY.ALL
}
