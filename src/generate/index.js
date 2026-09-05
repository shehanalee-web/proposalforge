/**
 * Proposal Generator public API.
 *
 * Structured facts first. Existing provider, knowledge, and proposal systems
 * stay in place. No Forge. No RAG.
 */

export {
  FACT_CONFIDENCE,
  FACT_SOURCE,
  GENERATION_MODE,
  GENERATION_MODES,
  GENERATION_STATUS,
  GENERATION_STATUSES,
  GENERATION_STATUS_LABELS,
  GENERATOR_CAPABILITIES,
  GENERATOR_EVENT,
  GENERATOR_PROPOSAL_TYPES,
  GENERATOR_SECTION,
  GENERATOR_SECTION_LABELS,
  GENERATOR_SECTIONS,
  UNRESOLVED_FACT,
} from './types.js'

export { normalizeProposalInputs, requiredInputErrors, assertRequiredInputs } from './inputs.js'
export { buildFactLedger, factValue, hasFact } from './facts.js'
export { retrieveGenerationKnowledge } from './knowledge.js'
export { planProposalSections } from './sections.js'
export { buildProposalGenerationContext } from './context.js'
export { buildProposalGenerationPrompt, GENERATOR_OUTPUT_SCHEMA } from './prompt.js'
export { parseGeneratedProposal } from './schema.js'
export { validateGeneratedFacts, collectGenerationWarnings } from './validate.js'
export { buildMockGeneratedDraft } from './mock.js'
export { proposalFromGeneratedDraft } from './assemble.js'
export { generateProposal } from './ai.js'
export { sanitizeGenerationMetadata } from './metadata.js'
export { makeProposalGeneratedEvent } from './events.js'
