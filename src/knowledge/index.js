/**
 * Company Knowledge public API.
 *
 * Deterministic, company-scoped, approval-aware. No LLM. No embeddings.
 * UI and future AI features should call these functions rather than the store.
 */

export {
  DEFAULT_COMPANY_ID,
  KNOWLEDGE_CAPABILITIES,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_CONTEXT_LIMITS,
  KNOWLEDGE_LIST_PAGE_SIZE,
  KNOWLEDGE_SEARCH_LIMIT,
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_SOURCES,
  KNOWLEDGE_SOURCE_LABELS,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUSES,
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_TRUST,
  KNOWLEDGE_TYPE,
  KNOWLEDGE_TYPE_LABELS,
  KNOWLEDGE_TYPES,
} from './types.js'

export { makeKnowledgeItem, validateKnowledgeItem } from './schema.js'
export { isApprovedForContext } from './approvals.js'
export {
  draftFieldsFromProposalBlock,
  extractBlockText,
  knowledgeTypeFromBlockType,
} from './sources.js'
export { DEMO_ISOLATION_COMPANY_ID, DEMO_KNOWLEDGE } from './demo.js'
export { resetKnowledgeStore, seedKnowledgeRecords } from './store.js'

export {
  approveKnowledgeItem,
  archiveKnowledgeItem,
  createKnowledgeItem,
  deleteKnowledgeItem,
  findPossibleDuplicates,
  getCompanyKnowledgeItem,
  listCompanyKnowledge,
  recordKnowledgeUsage,
  restoreKnowledgeItem,
  saveKnowledgeDraft,
  saveProposalContentAsKnowledge,
  searchCompanyKnowledge,
  updateKnowledgeItem,
} from './repository.js'

export { buildKnowledgeContext, getKnowledgeContext } from './context.js'
export { summarizeCompanyKnowledge } from './summary.js'

import { listCompanyKnowledge, searchCompanyKnowledge } from './repository.js'
import { getKnowledgeContext } from './context.js'

export function getCompanyKnowledge(input = {}) {
  return listCompanyKnowledge(input)
}

export const knowledgeApi = Object.freeze({
  getCompanyKnowledge,
  searchCompanyKnowledge,
  getKnowledgeContext,
})
