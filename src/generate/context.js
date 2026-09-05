import { resolveCompanyVoice } from '../coach/context.js'
import { isApprovedForContext } from '../knowledge/approvals.js'
import { KNOWLEDGE_STATUS } from '../knowledge/types.js'
import { buildFactLedger } from './facts.js'
import { normalizeProposalInputs } from './inputs.js'
import { retrieveGenerationKnowledge } from './knowledge.js'
import { planProposalSections } from './sections.js'

function publicKnowledge(item) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    content: item.content,
    category: item.category,
    source: item.source,
    status: item.status,
    companyId: item.companyId,
  }
}

function approvedForCompany(items, companyId) {
  return (items ?? []).filter(
    (item) =>
      isApprovedForContext(item) &&
      item.status === KNOWLEDGE_STATUS.APPROVED &&
      (!item.companyId || item.companyId === companyId),
  )
}

/**
 * Deterministic generation context. Only relevant approved knowledge.
 *
 * @param {{
 *   companyId?: string,
 *   proposalInputs?: object,
 *   knowledgeContext?: object,
 *   companyVoice?: object,
 *   optionalReferenceProposal?: object,
 * }} input
 */
export function buildProposalGenerationContext(input = {}) {
  const proposalInputs = normalizeProposalInputs(input)
  const knowledge =
    input.knowledgeContext && Array.isArray(input.knowledgeContext.items)
      ? {
          companyId: input.knowledgeContext.companyId ?? proposalInputs.companyId,
          query: input.knowledgeContext.query ?? '',
          items: input.knowledgeContext.items,
        }
      : retrieveGenerationKnowledge({
          companyId: proposalInputs.companyId,
          proposalInputs,
        })

  const scopedItems = approvedForCompany(knowledge.items, proposalInputs.companyId)
  const facts = buildFactLedger({
    proposalInputs,
    knowledgeItems: scopedItems,
  })
  const sectionPlan = planProposalSections({
    proposalType: proposalInputs.proposalType,
    industry: proposalInputs.industry,
    availableFacts: facts,
    availableKnowledge: scopedItems,
  })
  const voice = {
    ...resolveCompanyVoice({
      companyTone: proposalInputs.companyTone,
      brandVoice: proposalInputs.brandVoice,
      companyProfile: { tone: proposalInputs.companyTone, voice: proposalInputs.brandVoice },
    }),
    companyTone: proposalInputs.companyTone,
    brandVoice: proposalInputs.brandVoice,
  }

  return {
    companyId: proposalInputs.companyId,
    mode: proposalInputs.mode,
    proposalInputs,
    facts,
    knowledge: {
      companyId: knowledge.companyId ?? proposalInputs.companyId,
      query: knowledge.query ?? '',
      items: scopedItems.map(publicKnowledge),
    },
    companyVoice: {
      companyTone: voice.companyTone,
      brandVoice: voice.brandVoice,
      hasVoice: Boolean(voice.companyTone || voice.brandVoice),
      companyName: proposalInputs.companyName,
    },
    sectionPlan,
    referenceProposal: proposalInputs.referenceProposal,
    knowledgeIds: scopedItems.map((item) => item.id),
  }
}
