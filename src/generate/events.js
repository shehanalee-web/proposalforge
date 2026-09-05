import { GENERATOR_EVENT } from './types.js'

/**
 * Future Forge event. Horizon 9 records the shape; Forge is not implemented.
 *
 * @param {object} input
 */
export function makeProposalGeneratedEvent({
  proposalId,
  companyId,
  knowledgeIds = [],
  warnings = [],
  generation = {},
} = {}) {
  return {
    type: GENERATOR_EVENT.PROPOSAL_GENERATED,
    proposalId: proposalId ?? null,
    companyId: companyId ?? '',
    knowledgeIds: [...knowledgeIds],
    warnings: warnings.map((entry) => entry.code ?? entry.message).filter(Boolean),
    generation: {
      provider: generation.provider ?? '',
      model: generation.model ?? '',
      generatedAt: generation.generatedAt ?? '',
      reviewRequired: Boolean(generation.reviewRequired),
    },
  }
}
