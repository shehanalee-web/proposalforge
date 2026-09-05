import { normalizeText, tokenize } from './normalize.js'

/**
 * Deterministic relevance ranking. Higher score wins.
 *
 * Exact title > exact phrase > tag > category > token/content.
 *
 * @param {import('./schema.js').KnowledgeItem} item
 * @param {string} query
 * @returns {{ score: number, match: string | null }}
 */
export function rankKnowledgeItem(item, query) {
  const raw = String(query ?? '').trim()
  if (!raw) return { score: 0, match: null }

  const q = raw.toLowerCase()
  const title = String(item.title ?? '').toLowerCase()
  const content = String(item.content ?? '').toLowerCase()
  const category = String(item.category ?? '').toLowerCase()
  const tags = (item.tags ?? []).map((tag) => String(tag).toLowerCase())
  const terminology = item.type === 'terminology'
    ? `${title} ${content}`
    : `${title} ${content} ${tags.join(' ')}`

  if (title === q) return { score: 1000, match: 'title' }

  if (content.includes(q) || terminology.toLowerCase().includes(q)) {
    if (q.length >= 2) return { score: 800, match: 'phrase' }
  }

  if (tags.some((tag) => tag === q || tag.includes(q))) {
    return { score: 600, match: 'tag' }
  }

  if (category === q) return { score: 400, match: 'category' }

  const queryTokens = tokenize(q)
  if (queryTokens.length === 0) return { score: 0, match: null }

  const titleTokens = new Set(tokenize(title))
  const contentTokens = new Set(tokenize(`${content} ${terminology}`))
  let titleHits = 0
  let contentHits = 0
  for (const token of queryTokens) {
    if (titleTokens.has(token)) titleHits += 1
    else if (contentTokens.has(token)) contentHits += 1
  }

  if (titleHits === 0 && contentHits === 0) return { score: 0, match: null }

  const score = Math.round(
    (titleHits / queryTokens.length) * 180 + (contentHits / queryTokens.length) * 80,
  )
  return { score: Math.max(1, score), match: 'token' }
}

/**
 * @param {Array<{ item: import('./schema.js').KnowledgeItem, score: number, match: string | null }>} ranked
 */
export function sortRanked(ranked) {
  return [...ranked].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const updated = String(b.item.updatedAt).localeCompare(String(a.item.updatedAt))
    if (updated !== 0) return updated
    return String(a.item.id).localeCompare(String(b.item.id))
  })
}

export { normalizeText }
