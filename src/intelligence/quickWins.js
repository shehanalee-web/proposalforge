import { BUSINESS_PRIORITY } from './constants.js'

function isHighImpact(finding) {
  return (
    finding.businessPriority === BUSINESS_PRIORITY.CRITICAL ||
    finding.businessPriority === BUSINESS_PRIORITY.HIGH ||
    finding.estimatedValue >= 55
  )
}

function isLowEffort(finding) {
  return (Number(finding.effort) || 3) <= 2
}

/**
 * High impact, low effort, sorted by impact ÷ effort.
 *
 * @param {import('./types.js').IntelligenceFinding[]} findings
 * @returns {import('./types.js').IntelligenceQuickWin[]}
 */
export function pickQuickWins(findings) {
  return findings
    .filter((finding) => isHighImpact(finding) && isLowEffort(finding))
    .map((finding) => {
      const effort = Math.max(1, Number(finding.effort) || 1)
      return {
        id: finding.id,
        code: finding.code,
        title: finding.cardTitle || finding.title,
        section: finding.section,
        effort,
        estimatedValue: finding.estimatedValue,
        ratio: finding.estimatedValue / effort,
        recommendation: finding.recommendation,
      }
    })
    .sort((a, b) => b.ratio - a.ratio || b.estimatedValue - a.estimatedValue)
}

/**
 * Best impact/effort item even when nothing qualifies as a Quick Win.
 *
 * @param {import('./types.js').IntelligenceFinding[]} findings
 */
export function bestEffortWin(findings) {
  if (!findings.length) return null
  let best = null
  let bestRatio = -1
  for (const finding of findings) {
    const effort = Math.max(1, Number(finding.effort) || 1)
    const ratio = finding.estimatedValue / effort
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = finding
    }
  }
  return best
}
