import { FINDING_CODE } from '../insights/ids.js'

export const BUSINESS_PRIORITY = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
})

export const BUSINESS_PRIORITIES = Object.freeze(Object.values(BUSINESS_PRIORITY))

export const BUSINESS_PRIORITY_LABELS = Object.freeze({
  [BUSINESS_PRIORITY.CRITICAL]: 'Critical',
  [BUSINESS_PRIORITY.HIGH]: 'High',
  [BUSINESS_PRIORITY.MEDIUM]: 'Medium',
  [BUSINESS_PRIORITY.LOW]: 'Low',
})

export const READINESS = Object.freeze({
  READY: 'ready_to_send',
  MINOR: 'minor_improvements',
  REVIEW: 'needs_review',
  MAJOR: 'major_revisions',
  NOT_READY: 'not_client_ready',
})

export const READINESS_VALUES = Object.freeze(Object.values(READINESS))

export const READINESS_LABELS = Object.freeze({
  [READINESS.READY]: 'Ready to Send',
  [READINESS.MINOR]: 'Minor Improvements Recommended',
  [READINESS.REVIEW]: 'Needs Review',
  [READINESS.MAJOR]: 'Major Revisions Required',
  [READINESS.NOT_READY]: 'Not Client Ready',
})

export const REPAIR_BAND = Object.freeze({
  IMMEDIATE: 'immediate',
  RECOMMENDED: 'recommended',
  OPTIONAL: 'optional',
})

export const REPAIR_BANDS = Object.freeze(Object.values(REPAIR_BAND))

export const REPAIR_BAND_LABELS = Object.freeze({
  [REPAIR_BAND.IMMEDIATE]: 'Immediate',
  [REPAIR_BAND.RECOMMENDED]: 'Recommended',
  [REPAIR_BAND.OPTIONAL]: 'Optional',
})

export const SECTION_ID = Object.freeze({
  SUMMARY: 'executive_summary',
  OBJECTIVES: 'objectives',
  DELIVERABLES: 'deliverables',
  TIMELINE: 'timeline',
  PRICING: 'pricing',
  SCOPE: 'scope',
  ASSUMPTIONS: 'assumptions',
  WARRANTY: 'warranty',
})

export const SECTION_LABELS = Object.freeze({
  [SECTION_ID.SUMMARY]: 'Executive Summary',
  [SECTION_ID.OBJECTIVES]: 'Objectives',
  [SECTION_ID.DELIVERABLES]: 'Deliverables',
  [SECTION_ID.TIMELINE]: 'Timeline',
  [SECTION_ID.PRICING]: 'Pricing',
  [SECTION_ID.SCOPE]: 'Scope',
  [SECTION_ID.ASSUMPTIONS]: 'Assumptions',
  [SECTION_ID.WARRANTY]: 'Warranty',
})

export const IMPACT_WEIGHT = Object.freeze({
  clientTrust: 12,
  professionalism: 8,
  legalExposure: 11,
  commercialClarity: 10,
  completeness: 9,
  implementationClarity: 10,
  deliveryRisk: 10,
  delayApproval: 12,
  loseDeal: 13,
})

/**
 * Canonical repair sequence. Present diagnostics are filtered into this
 * order — the engine does not invent missing steps.
 */
export const REPAIR_SEQUENCE = Object.freeze([
  FINDING_CODE.MISSING_OBJECTIVES,
  FINDING_CODE.WEAK_VALUE_PROPOSITION,
  FINDING_CODE.MISSING_DELIVERABLES,
  FINDING_CODE.MISSING_TIMELINE,
  FINDING_CODE.WEAK_SUMMARY,
  FINDING_CODE.MISSING_PAYMENT_TERMS,
  FINDING_CODE.MISSING_WARRANTY,
  FINDING_CODE.MISSING_EXCLUSIONS,
  FINDING_CODE.PRICING_TOO_EARLY,
  FINDING_CODE.LONG_SUMMARY,
  FINDING_CODE.LONG_PROPOSAL,
  FINDING_CODE.MISSING_CTA,
])

/**
 * Business interpretation keyed by diagnostic code. Copy is fixed — never
 * generated at runtime.
 */
export const FINDING_PROFILE = Object.freeze({
  [FINDING_CODE.MISSING_OBJECTIVES]: {
    section: SECTION_ID.OBJECTIVES,
    band: REPAIR_BAND.IMMEDIATE,
    effort: 2,
    confidencePenalty: 26,
    cardTitle: 'Missing Objectives',
    clientTrust: 9,
    professionalism: 8,
    legalExposure: 2,
    commercialClarity: 6,
    completeness: 8,
    implementationClarity: 5,
    deliveryRisk: 4,
    delayApproval: 8,
    loseDeal: 8,
    businessImpact:
      'The proposal feels generic rather than tailored to the client\'s needs.',
    riskLabel: 'Reduced buyer confidence',
  },
  [FINDING_CODE.WEAK_VALUE_PROPOSITION]: {
    section: SECTION_ID.SUMMARY,
    band: REPAIR_BAND.IMMEDIATE,
    effort: 2,
    confidencePenalty: 20,
    cardTitle: 'Clarify the opening',
    clientTrust: 8,
    professionalism: 7,
    legalExposure: 1,
    commercialClarity: 7,
    completeness: 6,
    implementationClarity: 3,
    deliveryRisk: 3,
    delayApproval: 8,
    loseDeal: 9,
    businessImpact:
      'The opening never states what changes for the client, so budget holders have nothing to champion.',
    riskLabel: 'Weak executive communication',
  },
  [FINDING_CODE.MISSING_DELIVERABLES]: {
    section: SECTION_ID.DELIVERABLES,
    band: REPAIR_BAND.IMMEDIATE,
    effort: 2,
    confidencePenalty: 61,
    cardTitle: 'Clarify Deliverables',
    clientTrust: 9,
    professionalism: 7,
    legalExposure: 6,
    commercialClarity: 8,
    completeness: 9,
    implementationClarity: 7,
    deliveryRisk: 7,
    delayApproval: 9,
    loseDeal: 8,
    businessImpact:
      'Clients cannot clearly understand what is included in the engagement.',
    riskLabel: 'High risk of client confusion',
  },
  [FINDING_CODE.MISSING_TIMELINE]: {
    section: SECTION_ID.TIMELINE,
    band: REPAIR_BAND.IMMEDIATE,
    effort: 1,
    confidencePenalty: 82,
    cardTitle: 'Missing Timeline',
    clientTrust: 8,
    professionalism: 6,
    legalExposure: 3,
    commercialClarity: 5,
    completeness: 7,
    implementationClarity: 10,
    deliveryRisk: 8,
    delayApproval: 9,
    loseDeal: 7,
    businessImpact:
      'Unclear implementation expectations reduce buyer confidence.',
    riskLabel: 'Medium implementation uncertainty',
  },
  [FINDING_CODE.WEAK_SUMMARY]: {
    section: SECTION_ID.SUMMARY,
    band: REPAIR_BAND.RECOMMENDED,
    effort: 2,
    confidencePenalty: 17,
    cardTitle: 'Strengthen the summary',
    clientTrust: 6,
    professionalism: 8,
    legalExposure: 1,
    commercialClarity: 5,
    completeness: 5,
    implementationClarity: 2,
    deliveryRisk: 2,
    delayApproval: 6,
    loseDeal: 5,
    businessImpact:
      'A thin opening fails to carry the value of the work into the rest of the document.',
    riskLabel: 'Weak executive communication',
  },
  [FINDING_CODE.LONG_SUMMARY]: {
    section: SECTION_ID.SUMMARY,
    band: REPAIR_BAND.OPTIONAL,
    effort: 2,
    confidencePenalty: 12,
    cardTitle: 'Shorten the summary',
    clientTrust: 3,
    professionalism: 6,
    legalExposure: 0,
    commercialClarity: 3,
    completeness: 2,
    implementationClarity: 1,
    deliveryRisk: 1,
    delayApproval: 3,
    loseDeal: 2,
    businessImpact:
      'An overlong opening buries the decision a buyer needs to make.',
    riskLabel: 'Weak executive communication',
  },
  [FINDING_CODE.MISSING_PAYMENT_TERMS]: {
    section: SECTION_ID.ASSUMPTIONS,
    band: REPAIR_BAND.RECOMMENDED,
    effort: 2,
    confidencePenalty: 57,
    cardTitle: 'Clarify payment terms',
    clientTrust: 4,
    professionalism: 6,
    legalExposure: 7,
    commercialClarity: 10,
    completeness: 7,
    implementationClarity: 3,
    deliveryRisk: 5,
    delayApproval: 8,
    loseDeal: 6,
    businessImpact:
      'Finance cannot see when money moves, so approval stalls or terms get rewritten.',
    riskLabel: 'Weak commercial clarity',
  },
  [FINDING_CODE.MISSING_WARRANTY]: {
    section: SECTION_ID.WARRANTY,
    band: REPAIR_BAND.RECOMMENDED,
    effort: 3,
    confidencePenalty: 89,
    cardTitle: 'Add warranty language',
    clientTrust: 6,
    professionalism: 5,
    legalExposure: 8,
    commercialClarity: 4,
    completeness: 6,
    implementationClarity: 3,
    deliveryRisk: 9,
    delayApproval: 4,
    loseDeal: 3,
    businessImpact:
      'Delivery risk appears higher because post-completion assurances are absent.',
    riskLabel: 'Potential legal ambiguity',
  },
  [FINDING_CODE.MISSING_EXCLUSIONS]: {
    section: SECTION_ID.SCOPE,
    band: REPAIR_BAND.RECOMMENDED,
    effort: 2,
    confidencePenalty: 33,
    cardTitle: 'Missing Exclusions',
    clientTrust: 5,
    professionalism: 5,
    legalExposure: 9,
    commercialClarity: 8,
    completeness: 7,
    implementationClarity: 6,
    deliveryRisk: 8,
    delayApproval: 4,
    loseDeal: 3,
    businessImpact:
      'Scope boundaries are unclear, increasing the chance of disputes.',
    riskLabel: 'Incomplete scope definition',
  },
  [FINDING_CODE.PRICING_TOO_EARLY]: {
    section: SECTION_ID.PRICING,
    band: REPAIR_BAND.OPTIONAL,
    effort: 1,
    confidencePenalty: 20,
    cardTitle: 'Move pricing later',
    clientTrust: 4,
    professionalism: 7,
    legalExposure: 1,
    commercialClarity: 8,
    completeness: 3,
    implementationClarity: 2,
    deliveryRisk: 2,
    delayApproval: 6,
    loseDeal: 7,
    businessImpact:
      'The number arrives before the client has a reason to value the work.',
    riskLabel: 'Weak commercial clarity',
  },
  [FINDING_CODE.LONG_PROPOSAL]: {
    section: SECTION_ID.SUMMARY,
    band: REPAIR_BAND.OPTIONAL,
    effort: 4,
    confidencePenalty: 8,
    cardTitle: 'Tighten the document',
    clientTrust: 2,
    professionalism: 5,
    legalExposure: 0,
    commercialClarity: 2,
    completeness: 1,
    implementationClarity: 1,
    deliveryRisk: 1,
    delayApproval: 4,
    loseDeal: 3,
    businessImpact:
      'Length without structure makes the decision harder than the work itself.',
    riskLabel: 'Weak executive communication',
  },
  [FINDING_CODE.MISSING_CTA]: {
    section: SECTION_ID.ASSUMPTIONS,
    band: REPAIR_BAND.OPTIONAL,
    effort: 1,
    confidencePenalty: 15,
    cardTitle: 'Add a next step',
    clientTrust: 3,
    professionalism: 6,
    legalExposure: 2,
    commercialClarity: 5,
    completeness: 5,
    implementationClarity: 1,
    deliveryRisk: 2,
    delayApproval: 7,
    loseDeal: 4,
    businessImpact:
      'Without a clear acceptance step, a willing buyer has no obvious next action.',
    riskLabel: 'Reduced buyer confidence',
  },
})

export const DEFAULT_PROFILE = Object.freeze({
  section: SECTION_ID.SUMMARY,
  band: REPAIR_BAND.RECOMMENDED,
  effort: 3,
  confidencePenalty: 25,
  cardTitle: 'Improve this section',
  clientTrust: 5,
  professionalism: 5,
  legalExposure: 3,
  commercialClarity: 5,
  completeness: 5,
  implementationClarity: 4,
  deliveryRisk: 4,
  delayApproval: 5,
  loseDeal: 4,
  businessImpact: 'This gap weakens how clearly the client can approve the work.',
  riskLabel: 'Reduced buyer confidence',
})
