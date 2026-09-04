/**
 * Shared vocab for the Insights layer.
 *
 * Scores are 0–100 integers. Win probability is reserved (null until a later
 * horizon). Finding codes are stable so UI, review history and future APIs
 * can key off them without matching message strings.
 */

export const RISK_LEVEL = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
})

export const RISK_LEVELS = Object.freeze(Object.values(RISK_LEVEL))

export const RISK_LEVEL_LABELS = Object.freeze({
  [RISK_LEVEL.LOW]: 'Low risk',
  [RISK_LEVEL.MEDIUM]: 'Medium risk',
  [RISK_LEVEL.HIGH]: 'High risk',
})

export const FINDING_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
})

export const FINDING_SEVERITIES = Object.freeze(Object.values(FINDING_SEVERITY))

export const FINDING_SEVERITY_LABELS = Object.freeze({
  [FINDING_SEVERITY.INFO]: 'Info',
  [FINDING_SEVERITY.WARNING]: 'Warning',
  [FINDING_SEVERITY.CRITICAL]: 'Critical',
})

export const FINDING_CATEGORY = Object.freeze({
  COMPLETENESS: 'completeness',
  STRUCTURE: 'structure',
  COPY: 'copy',
  PRICING: 'pricing',
  COMMERCIAL: 'commercial',
})

export const FINDING_CATEGORIES = Object.freeze(Object.values(FINDING_CATEGORY))

export const PRICING_PLACEMENT = Object.freeze({
  MISSING: 'missing',
  EARLY: 'early',
  MIDDLE: 'middle',
  LATE: 'late',
})

export const PRICING_PLACEMENTS = Object.freeze(Object.values(PRICING_PLACEMENT))

export const REVIEW_KIND = Object.freeze({
  HEALTH: 'health',
  AI: 'ai',
  MANUAL: 'manual',
})

export const REVIEW_KINDS = Object.freeze(Object.values(REVIEW_KIND))

export const INSIGHTS_SOURCE = Object.freeze({
  HEALTH: 'health',
  REVIEW: 'review',
  COMPARISON: 'comparison',
})

export const INSIGHTS_SOURCES = Object.freeze(Object.values(INSIGHTS_SOURCE))

export const FINDING_CODE = Object.freeze({
  MISSING_TIMELINE: 'missing_timeline',
  MISSING_PAYMENT_TERMS: 'missing_payment_terms',
  MISSING_CTA: 'missing_cta',
  MISSING_EXCLUSIONS: 'missing_exclusions',
  MISSING_WARRANTY: 'missing_warranty',
  MISSING_DELIVERABLES: 'missing_deliverables',
  WEAK_SUMMARY: 'weak_summary',
  LONG_SUMMARY: 'long_summary',
  LONG_PROPOSAL: 'long_proposal',
  PRICING_TOO_EARLY: 'pricing_too_early',
  MISSING_OBJECTIVES: 'missing_objectives',
  WEAK_VALUE_PROPOSITION: 'weak_value_proposition',
})
