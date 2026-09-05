import { rankKnowledgeItem, sortRanked } from './ranking.js'
import { KNOWLEDGE_SEARCH_LIMIT, KNOWLEDGE_STATUS } from './types.js'

/**
 * @param {import('./schema.js').KnowledgeItem[]} items
 * @param {{ query?: string, categories?: string[], status?: string | string[], includeArchived?: boolean, limit?: number }} [options]
 */
export function filterKnowledgeItems(items, options = {}) {
  const categories = normalizeList(options.categories)
  const statuses = normalizeList(options.status)
  const includeArchived = Boolean(options.includeArchived)

  return items.filter((item) => {
    if (!includeArchived && item.status === KNOWLEDGE_STATUS.ARCHIVED && statuses.length === 0) {
      return false
    }
    if (statuses.length > 0 && !statuses.includes(item.status)) return false
    if (categories.length > 0 && !categories.includes(item.category) && !categories.includes(item.type)) {
      return false
    }
    return true
  })
}

/**
 * Search already-scoped records. Does not fabricate or mutate items.
 *
 * @param {import('./schema.js').KnowledgeItem[]} items
 * @param {string} query
 * @param {{ categories?: string[], status?: string | string[], includeArchived?: boolean, limit?: number }} [options]
 */
export function searchKnowledgeItems(items, query, options = {}) {
  const filtered = filterKnowledgeItems(items, options)
  const q = String(query ?? '').trim()
  const limit = clampLimit(options.limit, KNOWLEDGE_SEARCH_LIMIT)

  if (!q) {
    return filtered.slice(0, limit).map((item) => ({
      item,
      score: 0,
      match: null,
    }))
  }

  const ranked = []
  for (const item of filtered) {
    const relevance = rankKnowledgeItem(item, q)
    if (relevance.score <= 0) continue
    ranked.push({ item, score: relevance.score, match: relevance.match })
  }

  return sortRanked(ranked).slice(0, limit)
}

function normalizeList(value) {
  if (value == null || value === '' || value === 'all') return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.map((entry) => String(entry).trim()).filter(Boolean)
}

function clampLimit(value, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(100, Math.floor(n))
}
