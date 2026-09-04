import { INDUSTRY, getIndustryLabel, inferIndustry } from '../models/industry.js'
import { getCategoryLabel } from '../models/category.js'
import { PROPOSAL_TYPE } from '../models/proposalType.js'

/**
 * @typedef {object} ServiceDiscoveryItem
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} description
 * @property {string} industry
 * @property {string[]} industries
 * @property {string} categoryId
 * @property {string} categoryLabel
 * @property {string[]} keywords
 * @property {string[]} tags
 * @property {string[]} proposalSections
 */

/**
 * Fallback overlay for untagged custom services. Catalogue seed fields win.
 *
 * @type {Readonly<Record<string, { industry: string, industries?: string[], keywords?: string[] }>>}
 */
export const SERVICE_DISCOVERY = Object.freeze({
  [PROPOSAL_TYPE.ARCHITECTURE]: {
    industry: INDUSTRY.ARCHITECTURE,
    keywords: [
      'architecture',
      'schematic',
      'design',
      'documentation',
      'presentation',
      'built',
      'buildings',
    ],
  },
  [PROPOSAL_TYPE.MOTION_GRAPHICS]: {
    industry: INDUSTRY.CREATIVE,
    keywords: [
      'motion',
      'graphics',
      'animation',
      'film',
      'title',
      'explainer',
      'social',
      'screen',
      'campaign',
    ],
  },
  [PROPOSAL_TYPE.MARKETING]: {
    industry: INDUSTRY.MARKETING,
    keywords: [
      'marketing',
      'campaign',
      'content',
      'digital',
      'launch',
      'measurement',
      'strategy',
    ],
  },
  [PROPOSAL_TYPE.CREATIVE_AGENCY]: {
    industry: INDUSTRY.CREATIVE,
    industries: [INDUSTRY.CREATIVE, INDUSTRY.BRANDING],
    keywords: [
      'brand',
      'branding',
      'identity',
      'creative',
      'agency',
      'art direction',
      'guidelines',
      'discovery',
    ],
  },
  [PROPOSAL_TYPE.CONSTRUCTION]: {
    industry: INDUSTRY.CONSTRUCTION,
    keywords: [
      'construction',
      'build',
      'fit-out',
      'programme',
      'scope',
      'commercial',
      'terms',
    ],
  },
  [PROPOSAL_TYPE.SOFTWARE_DEVELOPMENT]: {
    industry: INDUSTRY.SOFTWARE,
    keywords: [
      'software',
      'development',
      'product',
      'engineering',
      'web',
      'platform',
      'digital',
      'design',
    ],
  },
  [PROPOSAL_TYPE.PRODUCT_CATALOGUE]: {
    industry: INDUSTRY.RETAIL,
    keywords: [
      'catalogue',
      'catalog',
      'product',
      'photography',
      'print',
      'collection',
      'retail',
      'layout',
    ],
  },
})

/**
 * @param {string} [value]
 * @returns {string[]}
 */
function tokenize(value) {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

/**
 * Build the discovery record used to search and filter a service.
 *
 * @param {import('../models/service.js').Service} service
 * @param {import('../models/category.js').ServiceCategory[]} [categories]
 * @returns {ServiceDiscoveryItem}
 */
export function toServiceDiscoveryItem(service, categories = []) {
  const overlay = SERVICE_DISCOVERY[service.id] ?? {}
  const title = service.name ?? ''
  const subtitle = service.subtitle ?? ''
  const description = service.description ?? ''
  const categoryId = service.categoryId ?? ''
  const categoryLabel = getCategoryLabel(categories, categoryId)
  const keywords = unique([
    ...(service.keywords ?? []),
    ...(overlay.keywords ?? []),
    ...tokenize(title),
    ...tokenize(subtitle),
    ...tokenize(description),
  ])
  const tags = unique([...(service.tags ?? []), ...tokenize(categoryLabel)])
  const proposalSections = [...(service.proposalSections ?? [])]

  const primary =
    service.industry || overlay.industry || inferIndustry(title)
  const industries = unique([
    ...(service.industries ?? []),
    ...(overlay.industries ?? []),
    primary,
  ]).filter((id) => id && id !== INDUSTRY.ALL)

  return {
    id: service.id,
    title,
    subtitle,
    description,
    industry: primary,
    industries,
    categoryId,
    categoryLabel,
    keywords,
    tags,
    proposalSections,
  }
}

/**
 * @param {ServiceDiscoveryItem} item
 * @param {string} query
 * @returns {boolean}
 */
function matchesSearch(item, query) {
  if (!query) return true

  const haystack = [
    item.title,
    item.subtitle,
    item.description,
    item.industry,
    item.categoryId,
    item.categoryLabel,
    getIndustryLabel(item.industry),
    ...industryIdsFor(item).map((id) => getIndustryLabel(id)),
    ...(item.keywords ?? []),
    ...(item.tags ?? []),
    ...(item.proposalSections ?? []),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function industryIdsFor(item) {
  if (Array.isArray(item.industries) && item.industries.length > 0) {
    return item.industries
  }
  return item.industry ? [item.industry] : []
}

/**
 * @param {ServiceDiscoveryItem} item
 * @param {string} industry
 * @returns {boolean}
 */
function matchesIndustry(item, industry) {
  if (!industry) return true
  return industryIdsFor(item).includes(industry)
}

/**
 * @param {ServiceDiscoveryItem} item
 * @param {string} category
 * @returns {boolean}
 */
function matchesCategory(item, category) {
  if (!category) return true
  return item.categoryId === category
}

/**
 * Filter library services by search, industry and category together.
 * Safe for hundreds of records. One code path for the catalogue.
 *
 * @param {import('../models/service.js').Service[]} services
 * @param {{ search?: string, industry?: string, category?: string, categories?: import('../models/category.js').ServiceCategory[] }} [options]
 * @returns {import('../models/service.js').Service[]}
 */
export function filterServices(services, options = {}) {
  const search = String(options.search ?? '').trim().toLowerCase()
  const industry = String(options.industry ?? '').trim()
  const category = String(options.category ?? '').trim()
  const categories = options.categories ?? []

  if (!Array.isArray(services) || services.length === 0) return []
  if (!search && !industry && !category) return services

  return services.filter((service) => {
    const item = toServiceDiscoveryItem(service, categories)
    return (
      matchesIndustry(item, industry) &&
      matchesCategory(item, category) &&
      matchesSearch(item, search)
    )
  })
}
