/**
 * Stable Company Knowledge identifiers.
 *
 * Future RAG / embeddings / Forge flags stay explicit and off. Do not treat a
 * missing flag as a partial implementation.
 */

export const DEFAULT_COMPANY_ID = 'company-studio'

export const KNOWLEDGE_TYPE = Object.freeze({
  COMPANY_PROFILE: 'company_profile',
  POSITIONING: 'positioning',
  SERVICE: 'service',
  CAPABILITY: 'capability',
  DELIVERABLE: 'deliverable',
  EXCLUSION: 'exclusion',
  ASSUMPTION: 'assumption',
  WARRANTY: 'warranty',
  TERMS: 'terms',
  TERMINOLOGY: 'terminology',
  APPROVED_SECTION: 'approved_section',
  PROPOSAL_BLOCK: 'proposal_block',
  CASE_STUDY: 'case_study',
  TESTIMONIAL: 'testimonial',
  FAQ: 'faq',
  INDUSTRY_NOTE: 'industry_note',
  BRAND_GUIDANCE: 'brand_guidance',
})

export const KNOWLEDGE_TYPES = Object.freeze(Object.values(KNOWLEDGE_TYPE))

export const KNOWLEDGE_TYPE_LABELS = Object.freeze({
  [KNOWLEDGE_TYPE.COMPANY_PROFILE]: 'Company profile',
  [KNOWLEDGE_TYPE.POSITIONING]: 'Positioning',
  [KNOWLEDGE_TYPE.SERVICE]: 'Service',
  [KNOWLEDGE_TYPE.CAPABILITY]: 'Capability',
  [KNOWLEDGE_TYPE.DELIVERABLE]: 'Deliverable',
  [KNOWLEDGE_TYPE.EXCLUSION]: 'Exclusion',
  [KNOWLEDGE_TYPE.ASSUMPTION]: 'Assumption',
  [KNOWLEDGE_TYPE.WARRANTY]: 'Warranty',
  [KNOWLEDGE_TYPE.TERMS]: 'Terms',
  [KNOWLEDGE_TYPE.TERMINOLOGY]: 'Terminology',
  [KNOWLEDGE_TYPE.APPROVED_SECTION]: 'Approved section',
  [KNOWLEDGE_TYPE.PROPOSAL_BLOCK]: 'Proposal block',
  [KNOWLEDGE_TYPE.CASE_STUDY]: 'Case study',
  [KNOWLEDGE_TYPE.TESTIMONIAL]: 'Testimonial',
  [KNOWLEDGE_TYPE.FAQ]: 'FAQ',
  [KNOWLEDGE_TYPE.INDUSTRY_NOTE]: 'Industry note',
  [KNOWLEDGE_TYPE.BRAND_GUIDANCE]: 'Brand guidance',
})

export const KNOWLEDGE_STATUS = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
})

export const KNOWLEDGE_STATUSES = Object.freeze(Object.values(KNOWLEDGE_STATUS))

export const KNOWLEDGE_STATUS_LABELS = Object.freeze({
  [KNOWLEDGE_STATUS.DRAFT]: 'Draft',
  [KNOWLEDGE_STATUS.APPROVED]: 'Approved',
  [KNOWLEDGE_STATUS.ARCHIVED]: 'Archived',
})

export const KNOWLEDGE_SOURCE = Object.freeze({
  MANUAL: 'manual',
  IMPORTED: 'imported',
  EXTRACTED_FROM_PROPOSAL: 'extracted_from_proposal',
  COPIED_FROM_APPROVED_PROPOSAL: 'copied_from_approved_proposal',
  SYSTEM_GENERATED_DRAFT: 'system_generated_draft',
  EXTERNAL: 'external',
})

export const KNOWLEDGE_SOURCES = Object.freeze(Object.values(KNOWLEDGE_SOURCE))

export const KNOWLEDGE_SOURCE_LABELS = Object.freeze({
  [KNOWLEDGE_SOURCE.MANUAL]: 'Manually created',
  [KNOWLEDGE_SOURCE.IMPORTED]: 'Imported',
  [KNOWLEDGE_SOURCE.EXTRACTED_FROM_PROPOSAL]: 'Extracted from proposal',
  [KNOWLEDGE_SOURCE.COPIED_FROM_APPROVED_PROPOSAL]: 'Copied from approved proposal',
  [KNOWLEDGE_SOURCE.SYSTEM_GENERATED_DRAFT]: 'System-generated draft',
  [KNOWLEDGE_SOURCE.EXTERNAL]: 'External source',
})

export const KNOWLEDGE_TRUST = Object.freeze({
  VERIFIED: 'verified',
  COMPANY_APPROVED: 'company-approved',
  PROPOSAL_DERIVED: 'proposal-derived',
  UNVERIFIED: 'unverified',
})

export const KNOWLEDGE_TRUSTS = Object.freeze(Object.values(KNOWLEDGE_TRUST))

export const KNOWLEDGE_CATEGORY = Object.freeze({
  COMPANY: 'company',
  OFFERING: 'offering',
  LEGAL: 'legal',
  LANGUAGE: 'language',
  PROOF: 'proof',
  INDUSTRY: 'industry',
})

export const KNOWLEDGE_CATEGORIES = Object.freeze(Object.values(KNOWLEDGE_CATEGORY))

export const KNOWLEDGE_CATEGORY_LABELS = Object.freeze({
  [KNOWLEDGE_CATEGORY.COMPANY]: 'Company',
  [KNOWLEDGE_CATEGORY.OFFERING]: 'Offering',
  [KNOWLEDGE_CATEGORY.LEGAL]: 'Legal',
  [KNOWLEDGE_CATEGORY.LANGUAGE]: 'Language',
  [KNOWLEDGE_CATEGORY.PROOF]: 'Proof',
  [KNOWLEDGE_CATEGORY.INDUSTRY]: 'Industry',
})

export const DEFAULT_TYPE_CATEGORY = Object.freeze({
  [KNOWLEDGE_TYPE.COMPANY_PROFILE]: KNOWLEDGE_CATEGORY.COMPANY,
  [KNOWLEDGE_TYPE.POSITIONING]: KNOWLEDGE_CATEGORY.COMPANY,
  [KNOWLEDGE_TYPE.SERVICE]: KNOWLEDGE_CATEGORY.OFFERING,
  [KNOWLEDGE_TYPE.CAPABILITY]: KNOWLEDGE_CATEGORY.OFFERING,
  [KNOWLEDGE_TYPE.DELIVERABLE]: KNOWLEDGE_CATEGORY.OFFERING,
  [KNOWLEDGE_TYPE.EXCLUSION]: KNOWLEDGE_CATEGORY.LEGAL,
  [KNOWLEDGE_TYPE.ASSUMPTION]: KNOWLEDGE_CATEGORY.LEGAL,
  [KNOWLEDGE_TYPE.WARRANTY]: KNOWLEDGE_CATEGORY.LEGAL,
  [KNOWLEDGE_TYPE.TERMS]: KNOWLEDGE_CATEGORY.LEGAL,
  [KNOWLEDGE_TYPE.TERMINOLOGY]: KNOWLEDGE_CATEGORY.LANGUAGE,
  [KNOWLEDGE_TYPE.APPROVED_SECTION]: KNOWLEDGE_CATEGORY.LANGUAGE,
  [KNOWLEDGE_TYPE.PROPOSAL_BLOCK]: KNOWLEDGE_CATEGORY.LANGUAGE,
  [KNOWLEDGE_TYPE.CASE_STUDY]: KNOWLEDGE_CATEGORY.PROOF,
  [KNOWLEDGE_TYPE.TESTIMONIAL]: KNOWLEDGE_CATEGORY.PROOF,
  [KNOWLEDGE_TYPE.FAQ]: KNOWLEDGE_CATEGORY.LANGUAGE,
  [KNOWLEDGE_TYPE.INDUSTRY_NOTE]: KNOWLEDGE_CATEGORY.INDUSTRY,
  [KNOWLEDGE_TYPE.BRAND_GUIDANCE]: KNOWLEDGE_CATEGORY.LANGUAGE,
})

/** Future Horizons. All remain off in Horizon 8. */
export const KNOWLEDGE_CAPABILITIES = Object.freeze({
  rag: false,
  embeddings: false,
  vectorSearch: false,
  documentIngestion: false,
  pdfImport: false,
  wordImport: false,
  websiteCrawling: false,
  crmKnowledge: false,
  emailKnowledge: false,
  historicalProposalLearning: false,
  industryBenchmarking: false,
  clientSpecificMemory: false,
  proposalPerformanceFeedback: false,
  aiGeneratedDrafts: false,
  forge: false,
})

export const KNOWLEDGE_CONTEXT_LIMITS = Object.freeze({
  default: 8,
  min: 1,
  max: 10,
})

export const KNOWLEDGE_LIST_PAGE_SIZE = 20
export const KNOWLEDGE_SEARCH_LIMIT = 25
export const KNOWLEDGE_MAX_PROPOSAL_REFS = 20
