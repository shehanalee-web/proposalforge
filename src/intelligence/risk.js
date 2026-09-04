import { BUSINESS_PRIORITY } from './constants.js'

const LEVEL_FROM_PRIORITY = Object.freeze({
  [BUSINESS_PRIORITY.CRITICAL]: 'high',
  [BUSINESS_PRIORITY.HIGH]: 'high',
  [BUSINESS_PRIORITY.MEDIUM]: 'medium',
  [BUSINESS_PRIORITY.LOW]: 'low',
})

const LEVEL_RANK = Object.freeze({ high: 0, medium: 1, low: 2 })

function stronger(a, b) {
  return (LEVEL_RANK[a] ?? 9) <= (LEVEL_RANK[b] ?? 9) ? a : b
}

/**
 * Proposal-level risks are labels already attached to present diagnostics.
 * Nothing is invented.
 *
 * @param {import('./types.js').IntelligenceFinding[]} findings
 * @returns {import('./types.js').IntelligenceRisk[]}
 */
export function summarizeRisks(findings) {
  const byLabel = new Map()

  for (const finding of findings) {
    const label = finding.riskLabel
    if (!label) continue
    const level = LEVEL_FROM_PRIORITY[finding.businessPriority] ?? 'low'
    const current = byLabel.get(label)
    if (!current) {
      byLabel.set(label, { id: finding.code, label, level })
      continue
    }
    current.level = stronger(current.level, level)
  }

  return [...byLabel.values()].sort(
    (a, b) => (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9),
  )
}
