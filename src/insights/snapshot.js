import { DEFAULT_CURRENCY } from '../models/proposal.js'
import {
  INSIGHTS_SOURCE,
  INSIGHTS_SOURCES,
  PRICING_PLACEMENT,
  PRICING_PLACEMENTS,
} from './ids.js'
import { makeFinding, makeHealthCheck, makeReviewRecord } from './finding.js'
import { clampScore, normalizeRisk, riskFromScore } from './score.js'

/**
 * @typedef {object} PricingInsight
 * @property {number} amount
 * @property {string} currency
 * @property {boolean} hasPricing
 * @property {string} placement
 * @property {number} lineCount
 * @property {boolean} hasMilestones
 * @property {boolean} hasRecurring
 * @property {boolean} comparable
 */

/**
 * @typedef {object} InsightsSnapshot
 * @property {string | null} proposalId
 * @property {string} generatedAt
 * @property {string} source
 * @property {number} overallScore
 * @property {string} riskLevel
 * @property {number} completionPercent
 * @property {number} readingScore
 * @property {number} estimatedQuality
 * @property {number | null} winProbability
 * @property {import('./finding.js').InsightFinding[]} warnings
 * @property {import('./finding.js').InsightFinding[]} suggestions
 * @property {import('./finding.js').ReviewRecord[]} reviewHistory
 * @property {PricingInsight} pricing
 * @property {import('./finding.js').HealthCheck[]} checks
 */

function money(value) {
  const next = Number(value ?? 0)
  return Number.isFinite(next) ? next : 0
}

/**
 * Pricing slice stored on every insights snapshot so later horizons can
 * benchmark historical proposals without changing this shape.
 *
 * @param {Partial<PricingInsight>} [input]
 * @returns {PricingInsight}
 */
export function makePricingInsight(input = {}) {
  const placement = PRICING_PLACEMENTS.includes(input.placement)
    ? input.placement
    : PRICING_PLACEMENT.MISSING

  return {
    amount: money(input.amount),
    currency: String(input.currency ?? DEFAULT_CURRENCY).trim() || DEFAULT_CURRENCY,
    hasPricing: Boolean(input.hasPricing),
    placement,
    lineCount: Math.max(0, Math.round(Number(input.lineCount ?? 0) || 0)),
    hasMilestones: Boolean(input.hasMilestones),
    hasRecurring: Boolean(input.hasRecurring),
    comparable: input.comparable !== false,
  }
}

/**
 * Normalise a partial insights snapshot. Unknown keys are dropped so a later
 * persisted record stays predictable.
 *
 * @param {Partial<InsightsSnapshot>} [input]
 * @returns {InsightsSnapshot}
 */
export function makeInsightsSnapshot(input = {}) {
  const overallScore = clampScore(input.overallScore)
  const warnings = (input.warnings ?? []).map(makeFinding)
  const suggestions = (input.suggestions ?? []).map(makeFinding)

  return {
    proposalId: input.proposalId ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: INSIGHTS_SOURCES.includes(input.source)
      ? input.source
      : INSIGHTS_SOURCE.HEALTH,
    overallScore,
    riskLevel: input.riskLevel ? normalizeRisk(input.riskLevel) : riskFromScore(overallScore),
    completionPercent: clampScore(input.completionPercent),
    readingScore: clampScore(input.readingScore),
    estimatedQuality: clampScore(input.estimatedQuality ?? overallScore),
    winProbability:
      input.winProbability == null ? null : clampScore(input.winProbability),
    warnings,
    suggestions,
    reviewHistory: (input.reviewHistory ?? []).map(makeReviewRecord),
    pricing: makePricingInsight(input.pricing),
    checks: (input.checks ?? []).map(makeHealthCheck),
  }
}
