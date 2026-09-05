/**
 * Horizon 9 Proposal Generator identifiers.
 *
 * Future RAG / cloning / Forge flags stay explicit and off.
 */

export const GENERATION_STATUS = Object.freeze({
  IDLE: 'idle',
  PREPARING: 'preparing',
  RETRIEVING_KNOWLEDGE: 'retrieving_knowledge',
  GENERATING: 'generating',
  VALIDATING: 'validating',
  CREATING_PROPOSAL: 'creating_proposal',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
})

export const GENERATION_STATUSES = Object.freeze(Object.values(GENERATION_STATUS))

export const GENERATION_STATUS_LABELS = Object.freeze({
  [GENERATION_STATUS.IDLE]: 'Idle',
  [GENERATION_STATUS.PREPARING]: 'Preparing',
  [GENERATION_STATUS.RETRIEVING_KNOWLEDGE]: 'Retrieving knowledge',
  [GENERATION_STATUS.GENERATING]: 'Generating',
  [GENERATION_STATUS.VALIDATING]: 'Validating',
  [GENERATION_STATUS.CREATING_PROPOSAL]: 'Creating proposal',
  [GENERATION_STATUS.COMPLETE]: 'Complete',
  [GENERATION_STATUS.FAILED]: 'Failed',
  [GENERATION_STATUS.CANCELLED]: 'Cancelled',
})

export const GENERATION_MODE = Object.freeze({
  FROM_SCRATCH: 'from_scratch',
  FROM_KNOWLEDGE: 'from_knowledge',
  FROM_PROPOSAL: 'from_proposal',
})

export const GENERATION_MODES = Object.freeze(Object.values(GENERATION_MODE))

export const FACT_SOURCE = Object.freeze({
  USER: 'user',
  KNOWLEDGE: 'knowledge',
})

export const FACT_CONFIDENCE = Object.freeze({
  EXPLICIT: 'explicit',
})

export const UNRESOLVED_FACT = 'To be confirmed'

export const GENERATOR_SECTION = Object.freeze({
  COVER: 'cover',
  EXECUTIVE_SUMMARY: 'executive_summary',
  CLIENT_OBJECTIVES: 'client_objectives',
  APPROACH: 'approach',
  SCOPE: 'scope',
  DELIVERABLES: 'deliverables',
  TIMELINE: 'timeline',
  PRICING: 'pricing',
  ASSUMPTIONS: 'assumptions',
  EXCLUSIONS: 'exclusions',
  WARRANTY: 'warranty',
  TERMS: 'terms',
  ABOUT_COMPANY: 'about_company',
  CASE_STUDIES: 'case_studies',
  TESTIMONIALS: 'testimonials',
  NEXT_STEPS: 'next_steps',
  SPECIFICATIONS: 'specifications',
})

export const GENERATOR_SECTIONS = Object.freeze(Object.values(GENERATOR_SECTION))

export const GENERATOR_SECTION_LABELS = Object.freeze({
  [GENERATOR_SECTION.COVER]: 'Cover',
  [GENERATOR_SECTION.EXECUTIVE_SUMMARY]: 'Executive summary',
  [GENERATOR_SECTION.CLIENT_OBJECTIVES]: 'Objectives',
  [GENERATOR_SECTION.APPROACH]: 'Approach',
  [GENERATOR_SECTION.SCOPE]: 'Scope',
  [GENERATOR_SECTION.DELIVERABLES]: 'Deliverables',
  [GENERATOR_SECTION.TIMELINE]: 'Timeline',
  [GENERATOR_SECTION.PRICING]: 'Pricing',
  [GENERATOR_SECTION.ASSUMPTIONS]: 'Assumptions',
  [GENERATOR_SECTION.EXCLUSIONS]: 'Exclusions',
  [GENERATOR_SECTION.WARRANTY]: 'Warranty',
  [GENERATOR_SECTION.TERMS]: 'Terms',
  [GENERATOR_SECTION.ABOUT_COMPANY]: 'Company / capabilities',
  [GENERATOR_SECTION.CASE_STUDIES]: 'Case studies',
  [GENERATOR_SECTION.TESTIMONIALS]: 'Testimonials',
  [GENERATOR_SECTION.NEXT_STEPS]: 'Next steps',
  [GENERATOR_SECTION.SPECIFICATIONS]: 'Specifications',
})

export const GENERATOR_PROPOSAL_TYPES = Object.freeze([
  'Architectural Model',
  'Brand Identity',
  'Fabrication',
  'Architecture',
  'Branding',
  'Consulting',
  'Web Development',
  'Marketing',
  'Construction',
  'Software Development',
  'Other',
])

/** Future Horizons. All remain off in Horizon 9. */
export const GENERATOR_CAPABILITIES = Object.freeze({
  rag: false,
  embeddings: false,
  vectorSearch: false,
  proposalCloning: false,
  versionGeneration: false,
  multipleAlternatives: false,
  industrySpecificGenerators: false,
  clientSpecificMemory: false,
  crmContext: false,
  websiteContext: false,
  externalDocuments: false,
  proposalPerformanceFeedback: false,
  automaticFollowUps: false,
  emailGeneration: false,
  forge: false,
})

export const GENERATOR_EVENT = Object.freeze({
  PROPOSAL_GENERATED: 'proposal.generated',
})
