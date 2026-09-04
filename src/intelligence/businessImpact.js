import {
  BUSINESS_PRIORITY,
  DEFAULT_PROFILE,
  FINDING_PROFILE,
  IMPACT_WEIGHT,
} from './constants.js'

const WEIGHT_MAX = Object.values(IMPACT_WEIGHT).reduce(
  (sum, weight) => sum + weight * 10,
  0,
)

/**
 * @param {string} [code]
 */
export function profileFor(code) {
  return FINDING_PROFILE[code] ?? DEFAULT_PROFILE
}

/**
 * Weighted business impact in 0–100. Independent of Health Score.
 *
 * @param {typeof DEFAULT_PROFILE} profile
 */
export function businessScoreFor(profile) {
  let sum = 0
  for (const key of Object.keys(IMPACT_WEIGHT)) {
    const factor = Number(profile[key]) || 0
    sum += Math.max(0, Math.min(10, factor)) * IMPACT_WEIGHT[key]
  }
  if (WEIGHT_MAX <= 0) return 0
  return Math.round((sum / WEIGHT_MAX) * 100)
}

/**
 * @param {number} value 0–10 factor
 */
export function impactBand(value) {
  const n = Number(value) || 0
  if (n >= 8) return 'high'
  if (n >= 5) return 'medium'
  if (n >= 3) return 'low'
  return 'none'
}

/**
 * @param {number} effort
 */
export function difficultyFor(effort) {
  const n = Number(effort) || 3
  if (n <= 1) return 'low'
  if (n <= 3) return 'medium'
  return 'high'
}

/**
 * Lift one Health diagnostic into an intelligence finding. Copy comes from
 * the catalog — never from the proposal text.
 *
 * @param {object} diagnostic
 * @returns {import('./types.js').IntelligenceFinding}
 */
export function interpretFinding(diagnostic) {
  const profile = profileFor(diagnostic?.code)
  const businessScore = businessScoreFor(profile)
  const effort = Math.max(1, Math.min(5, Number(profile.effort) || 3))

  return {
    id: String(diagnostic?.id ?? ''),
    code: String(diagnostic?.code ?? ''),
    title: String(diagnostic?.title ?? '').trim(),
    cardTitle: profile.cardTitle || String(diagnostic?.title ?? '').trim(),
    severity: String(diagnostic?.severity ?? ''),
    businessPriority: BUSINESS_PRIORITY.MEDIUM,
    businessImpact: profile.businessImpact,
    clientImpact: impactBand(profile.clientTrust),
    legalImpact: impactBand(profile.legalExposure),
    commercialImpact: impactBand(profile.commercialClarity),
    professionalismImpact: impactBand(profile.professionalism),
    repairDifficulty: difficultyFor(effort),
    estimatedValue: businessScore,
    recommendation: String(diagnostic?.suggestion ?? '').trim(),
    section: profile.section,
    band: profile.band,
    effort,
    businessScore,
    riskLabel: profile.riskLabel,
    impact: Number(diagnostic?.impact) || 0,
  }
}
