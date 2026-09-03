import { INDUSTRY, getIndustryLabel, inferIndustry } from '../models/industry.js'
import { PROPOSAL_TYPE } from '../models/proposalType.js'

/**
 * @typedef {object} ServiceDiscoveryItem
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} industry
 * @property {string[]} keywords
 */

/**
 * Discovery overlay for existing library services.
 *
 * New services can be registered here without changing the Service store.
 * Unknown ids still get a record from the live service name and description.
 *
 * @type {Readonly<Record<string, { industry: string, keywords?: string[] }>>}
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

/**
 * Build the discovery record used to search and filter a service.
 *
 * @param {import('../models/service.js').Service} service
 * @returns {ServiceDiscoveryItem}
 */
export function toServiceDiscoveryItem(service) {
  const overlay = SERVICE_DISCOVERY[service.id] ?? {}
  const title = service.name ?? ''
  const description = service.description ?? ''
  const keywords = [
    ...new Set([
      ...(overlay.keywords ?? []),
      ...tokenize(title),
      ...tokenize(description),
    ]),
  ]

  return {
    id: service.id,
    title,
    description,
    industry: overlay.industry ?? inferIndustry(title),
    keywords,
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
    item.description,
    item.industry,
    getIndustryLabel(item.industry),
    ...(item.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

/**
 * @param {ServiceDiscoveryItem} item
 * @param {string} industry
 * @returns {boolean}
 */
function matchesIndustry(item, industry) {
  if (!industry) return true
  return item.industry === industry
}

/**
 * Filter library services by search text and industry.
 * Both constraints apply together. Safe for hundreds of records.
 *
 * @param {import('../models/service.js').Service[]} services
 * @param {{ search?: string, industry?: string }} [options]
 * @returns {import('../models/service.js').Service[]}
 */
export function filterServices(services, options = {}) {
  const search = String(options.search ?? '').trim().toLowerCase()
  const industry = String(options.industry ?? '').trim()

  if (!Array.isArray(services) || services.length === 0) return []
  if (!search && !industry) return services

  return services.filter((service) => {
    const item = toServiceDiscoveryItem(service)
    return matchesIndustry(item, industry) && matchesSearch(item, search)
  })
}
