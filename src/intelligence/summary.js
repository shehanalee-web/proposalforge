import { SECTION_LABELS } from './constants.js'
import { averageConfidence } from './confidence.js'
import { bestEffortWin } from './quickWins.js'

const EMPTY = '—'

function firstTitle(findings) {
  const first = findings[0]
  if (!first) return EMPTY
  return first.cardTitle || first.title || SECTION_LABELS[first.section] || EMPTY
}

/**
 * Compact executive card fields. Health Score is displayed, not recomputed.
 *
 * @param {{
 *   health?: object,
 *   findings?: import('./types.js').IntelligenceFinding[],
 *   risks?: import('./types.js').IntelligenceRisk[],
 *   quickWins?: import('./types.js').IntelligenceQuickWin[],
 *   readiness?: import('./types.js').IntelligenceReadiness,
 *   sections?: import('./types.js').IntelligenceSection[],
 * }} input
 * @returns {import('./types.js').IntelligenceSummary}
 */
export function executiveSummary({
  health,
  findings = [],
  risks = [],
  quickWins = [],
  readiness,
  sections = [],
} = {}) {
  const raw = Number(health?.overallScore)
  const rankedBest = bestEffortWin(findings)
  const best = quickWins[0] ?? (rankedBest
    ? { title: rankedBest.cardTitle || rankedBest.title }
    : null)

  return {
    healthScore: Number.isFinite(raw) ? raw : null,
    readiness: readiness?.id ?? '',
    readinessLabel: readiness?.label ?? EMPTY,
    highestPriority: firstTitle(findings),
    largestRisk: risks[0]?.label ?? EMPTY,
    bestQuickWin: best?.title ?? EMPTY,
    clientConfidence: averageConfidence(sections),
  }
}

/**
 * Attach Horizon 5.5 insight fields without changing Health Score or the
 * original executive card values.
 *
 * @param {import('./types.js').IntelligenceSummary} summary
 * @param {object} [insights]
 */
export function attachInsightSummary(summary, insights = {}) {
  return {
    ...summary,
    executivePriority: insights.executivePriority?.headline ?? null,
    reviewTimeLabel: insights.reviewTime?.label ?? null,
  }
}
