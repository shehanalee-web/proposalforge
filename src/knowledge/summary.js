import { listCompanyKnowledge } from './repository.js'
import { KNOWLEDGE_STATUS, KNOWLEDGE_STATUS_LABELS, KNOWLEDGE_TYPE_LABELS } from './types.js'

/**
 * Compact workspace summary. Not a dashboard and not a scoring system.
 *
 * @param {{ companyId: string }} input
 */
export function summarizeCompanyKnowledge({ companyId } = {}) {
  const items = listCompanyKnowledge({ companyId, includeArchived: true })
  const counts = {
    total: items.length,
    draft: 0,
    approved: 0,
    archived: 0,
  }

  for (const item of items) {
    if (item.status === KNOWLEDGE_STATUS.DRAFT) counts.draft += 1
    else if (item.status === KNOWLEDGE_STATUS.APPROVED) counts.approved += 1
    else if (item.status === KNOWLEDGE_STATUS.ARCHIVED) counts.archived += 1
  }

  const types = {}
  for (const item of items) {
    const label = KNOWLEDGE_TYPE_LABELS[item.type] ?? item.type
    types[label] = (types[label] ?? 0) + 1
  }

  return {
    companyId,
    counts,
    statusLabels: KNOWLEDGE_STATUS_LABELS,
    types,
    capabilitiesNote: 'Approved records only are eligible for future AI context.',
  }
}
