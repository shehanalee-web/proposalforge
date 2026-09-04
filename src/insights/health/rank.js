import { FINDING_SEVERITY } from '../ids.js'
import { clampScore } from '../score.js'

export const SEVERITY_WEIGHT = Object.freeze({
  [FINDING_SEVERITY.CRITICAL]: 1.6,
  [FINDING_SEVERITY.WARNING]: 1,
  [FINDING_SEVERITY.INFO]: 0.45,
})

const SEVERITY_RANK = Object.freeze({
  [FINDING_SEVERITY.CRITICAL]: 0,
  [FINDING_SEVERITY.WARNING]: 1,
  [FINDING_SEVERITY.INFO]: 2,
})

function severityWeight(severity) {
  return SEVERITY_WEIGHT[severity] ?? 1
}

/**
 * Quality remainder after severity-weighted penalties. Critical gaps cost
 * more than informational nits, so two equal `impact` values do not score
 * the same.
 *
 * @param {import('../finding.js').InsightFinding[]} [findings]
 */
export function weightedQualityScore(findings = []) {
  const penalty = findings.reduce(
    (sum, finding) => sum + finding.impact * severityWeight(finding.severity),
    0,
  )
  return clampScore(100 - penalty)
}

/**
 * Critical first, then warning, then info; higher impact first within a band.
 *
 * @param {import('../finding.js').InsightFinding[]} [findings]
 */
export function rankFindings(findings = []) {
  return [...findings].sort((left, right) => {
    const severity =
      (SEVERITY_RANK[left.severity] ?? 9) - (SEVERITY_RANK[right.severity] ?? 9)
    if (severity !== 0) return severity
    return right.impact - left.impact
  })
}

/**
 * Horizon 2 diagnostics win on the same code. `suppress` drops Horizon 1
 * findings that document-wide signals proved were false positives
 * (for example a rich-text timeline with no timeline block).
 *
 * @param {import('../finding.js').InsightFinding[]} base
 * @param {{ findings?: import('../finding.js').InsightFinding[], suppress?: string[] } | import('../finding.js').InsightFinding[]} diagnostic
 */
export function mergeHealthFindings(base = [], diagnostic = []) {
  const extras = Array.isArray(diagnostic)
    ? diagnostic
    : (diagnostic.findings ?? [])
  const suppress = new Set(
    Array.isArray(diagnostic) ? [] : (diagnostic.suppress ?? []),
  )
  const byCode = new Map()

  for (const item of base) {
    if (!suppress.has(item.code)) byCode.set(item.code, item)
  }

  for (const item of extras) {
    byCode.set(item.code, item)
  }

  return rankFindings([...byCode.values()])
}
