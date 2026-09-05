import { isApprovedForContext } from './approvals.js'
import { listCompanyKnowledge, requireCompanyId, searchCompanyKnowledge } from './repository.js'
import { KNOWLEDGE_CONTEXT_LIMITS, KNOWLEDGE_STATUS } from './types.js'

function clampLimit(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return KNOWLEDGE_CONTEXT_LIMITS.default
  return Math.min(KNOWLEDGE_CONTEXT_LIMITS.max, Math.max(KNOWLEDGE_CONTEXT_LIMITS.min, Math.floor(n)))
}

/**
 * Approved-only context for later AI systems. No LLM. No embeddings.
 *
 * Draft and archived records never appear here.
 *
 * @param {{
 *   companyId: string,
 *   query?: string,
 *   categories?: string[],
 *   category?: string,
 *   proposalType?: string,
 *   industry?: string,
 *   limit?: number,
 * }} input
 */
export function buildKnowledgeContext(input = {}) {
  const companyId = requireCompanyId(input.companyId)
  const limit = clampLimit(input.limit)
  const categories = [
    ...(Array.isArray(input.categories) ? input.categories : []),
    input.category,
    input.proposalType,
    input.industry,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)

  const queryParts = [input.query, input.proposalType, input.industry]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
  const query = queryParts.join(' ')

  const found = query
    ? searchCompanyKnowledge({
        companyId,
        query,
        categories: categories.length ? categories : undefined,
        status: KNOWLEDGE_STATUS.APPROVED,
        includeArchived: false,
        limit,
      })
    : listCompanyKnowledge({
        companyId,
        categories: categories.length ? categories : undefined,
        status: KNOWLEDGE_STATUS.APPROVED,
        includeArchived: false,
        limit,
      })

  const items = found
    .filter((item) => isApprovedForContext(item))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      content: item.content,
      category: item.category,
      source: item.source,
      sourceId: item.sourceId,
      status: item.status,
      relevance: item.relevance ?? { score: 0, match: null },
      metadata: {
        trust: item.metadata?.trust ?? 'company-approved',
        demo: Boolean(item.metadata?.demo),
      },
    }))

  return {
    companyId,
    query,
    limit,
    items,
  }
}

export function getKnowledgeContext(input = {}) {
  return buildKnowledgeContext(input)
}
