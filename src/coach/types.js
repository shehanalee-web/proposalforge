/**
 * Shared Coach shapes. The Coach is an explanation layer — it never
 * recalculates Health, Intelligence, or Consistency.
 */

export const COACH_SOURCE = Object.freeze({
  HEALTH: 'health',
  INTELLIGENCE: 'intelligence',
  CONSISTENCY: 'consistency',
  SECTION: 'section',
})

export const COACH_SOURCES = Object.freeze(Object.values(COACH_SOURCE))

export const COACH_SOURCE_LABELS = Object.freeze({
  [COACH_SOURCE.HEALTH]: 'Proposal Health',
  [COACH_SOURCE.INTELLIGENCE]: 'Proposal Intelligence',
  [COACH_SOURCE.CONSISTENCY]: 'Proposal Integrity',
  [COACH_SOURCE.SECTION]: 'Section guidance',
})

export const COACH_ACTION = Object.freeze({
  ASK: 'ask',
  EXPLAIN_DEEPER: 'explain_deeper',
  ALTERNATIVES: 'alternatives',
  IMPROVE_SECTION: 'improve_section',
  SALES: 'sales',
  TECHNICAL: 'technical',
})

export const COACH_ACTIONS = Object.freeze(Object.values(COACH_ACTION))

export const COACH_ACTION_LABELS = Object.freeze({
  [COACH_ACTION.ASK]: 'Ask AI',
  [COACH_ACTION.EXPLAIN_DEEPER]: 'Explain deeper',
  [COACH_ACTION.ALTERNATIVES]: 'Suggest alternatives',
  [COACH_ACTION.IMPROVE_SECTION]: 'Improve this section',
  [COACH_ACTION.SALES]: 'Give a sales-focused explanation',
  [COACH_ACTION.TECHNICAL]: 'Give a technical explanation',
})

export const COACH_SECTION = Object.freeze({
  SUMMARY: 'executive_summary',
  OBJECTIVES: 'objectives',
  SCOPE: 'scope',
  DELIVERABLES: 'deliverables',
  TIMELINE: 'timeline',
  PRICING: 'pricing',
  ASSUMPTIONS: 'assumptions',
  EXCLUSIONS: 'exclusions',
  WARRANTY: 'warranty',
  TERMS: 'terms',
  ACCEPTANCE: 'acceptance',
  SIGNATURE: 'signature',
})

export const COACH_SECTIONS = Object.freeze(Object.values(COACH_SECTION))

export const COACH_SECTION_LABELS = Object.freeze({
  [COACH_SECTION.SUMMARY]: 'Executive Summary',
  [COACH_SECTION.OBJECTIVES]: 'Client Objectives',
  [COACH_SECTION.SCOPE]: 'Scope',
  [COACH_SECTION.DELIVERABLES]: 'Deliverables',
  [COACH_SECTION.TIMELINE]: 'Timeline',
  [COACH_SECTION.PRICING]: 'Pricing',
  [COACH_SECTION.ASSUMPTIONS]: 'Assumptions',
  [COACH_SECTION.EXCLUSIONS]: 'Exclusions',
  [COACH_SECTION.WARRANTY]: 'Warranty',
  [COACH_SECTION.TERMS]: 'Terms',
  [COACH_SECTION.ACCEPTANCE]: 'Acceptance',
  [COACH_SECTION.SIGNATURE]: 'Signature',
})

/**
 * Reserved for later horizons. Values stay null — this layer does not
 * implement Forge, memory, CRM, RAG, or outbound communication.
 */
export const COACH_EXTENSIONS = Object.freeze({
  forge: null,
  companyMemory: null,
  knowledgeBase: null,
  rag: null,
  historicalProposals: null,
  crmContext: null,
  industryBenchmarks: null,
  proposalAnalytics: null,
  aiFollowUp: null,
  aiEmail: null,
  onboardingGuidance: null,
  clientCommunication: null,
})

/**
 * @typedef {object} CoachItem
 * @property {string} id
 * @property {string} title
 * @property {string} priority
 * @property {string} findingSource
 * @property {string} sourceEngine
 * @property {string} findingType
 * @property {string} severity
 * @property {string} section
 * @property {string} sectionLabel
 * @property {string} explanation
 * @property {string} whyItMatters
 * @property {string} riskIfIgnored
 * @property {string} recommendation
 * @property {string} goodExample
 * @property {string} nextAction
 * @property {string} flaggedBecause
 * @property {string | null} blockId
 * @property {string | null} blockType
 * @property {boolean} aiAvailable
 */

/**
 * @typedef {object} CoachSummary
 * @property {string} headline
 * @property {string} whyItMatters
 * @property {string} nextAction
 * @property {CoachItem | null} topRecommendation
 * @property {number} count
 */

/**
 * @typedef {object} ProposalCoaching
 * @property {CoachItem | null} topRecommendation
 * @property {CoachItem[]} items
 * @property {string} mode
 * @property {CoachSummary} summary
 * @property {Record<string, null>} extensions
 */

export {}
