import { getKnowledgeContext } from '../knowledge/context.js'
import { isApprovedForContext } from '../knowledge/approvals.js'
import { KNOWLEDGE_STATUS } from '../knowledge/types.js'

/**
 * Retrieve only relevant APPROVED knowledge via the Horizon 8 context API.
 * Draft and archived records never enter automatic generation context.
 *
 * @param {{
 *   companyId: string,
 *   proposalInputs?: object,
 *   limit?: number,
 * }} input
 */
export function retrieveGenerationKnowledge({ companyId, proposalInputs = {}, limit } = {}) {
  const query = [
    proposalInputs.primaryObjective,
    proposalInputs.scope,
    proposalInputs.projectDescription,
    proposalInputs.proposalType,
    proposalInputs.industry,
    (proposalInputs.deliverables ?? []).join(' '),
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')

  const context = getKnowledgeContext({
    companyId,
    query,
    limit,
  })

  const items = (context.items ?? []).filter(
    (item) =>
      isApprovedForContext(item) &&
      item.status === KNOWLEDGE_STATUS.APPROVED &&
      (!item.companyId || item.companyId === companyId),
  )

  return {
    companyId: context.companyId,
    query: context.query,
    items,
  }
}
