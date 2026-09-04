import { BUSINESS_PRIORITY } from './constants.js'

function clampPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 88
  return Math.max(5, Math.min(98, Math.round(n)))
}

function starsFor(finding) {
  const score = Number(finding?.estimatedValue) || 0
  if (finding?.businessPriority === BUSINESS_PRIORITY.CRITICAL || score >= 72) return 5
  if (finding?.businessPriority === BUSINESS_PRIORITY.HIGH || score >= 55) return 4
  if (finding?.businessPriority === BUSINESS_PRIORITY.MEDIUM || score >= 38) return 3
  if (score >= 25) return 2
  return 1
}

function clarityLabel(score) {
  const value = Number(score) || 0
  if (value >= 70) return 'Very High'
  if (value >= 55) return 'High'
  if (value >= 38) return 'Medium'
  return 'Low'
}

function clientConfidenceLabel(finding) {
  const impact = finding?.clientImpact
  if (impact === 'high') return 'High'
  if (impact === 'medium') return 'Medium'
  if (impact === 'low' || impact === 'none') return 'Low'
  return clarityLabel(finding?.estimatedValue)
}

function titleOf(finding) {
  return finding?.cardTitle || finding?.title || 'this gap'
}

const HEALTHY = 88

/**
 * Projected lift from repairing each finding. Uses section confidence and
 * business value already on the intelligence report — never Health Score.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 */
export function buildForecast(report = {}) {
  const findings = Array.isArray(report.findings) ? report.findings : []
  const sections = Array.isArray(report.sections) ? report.sections : []
  const current = clampPercent(report.summary?.clientConfidence ?? HEALTHY)
  const working = new Map(sections.map((item) => [item.id, item.confidence]))
  if (working.size === 0) {
    return { items: [], path: [{ label: 'Current Client Confidence', confidence: current, code: null }] }
  }

  const remaining = new Map()
  for (const finding of findings) {
    if (!finding?.section) continue
    remaining.set(finding.section, (remaining.get(finding.section) || 0) + 1)
  }

  const rankedItems = []
  const path = [{ label: 'Current Client Confidence', confidence: current, code: null }]

  for (const finding of findings) {
    const sectionId = finding.section
    const currentSec = working.get(sectionId) ?? HEALTHY
    const share = Math.max(1, remaining.get(sectionId) || 1)
    const lift = Math.max(0, (HEALTHY - currentSec) / share)
    working.set(sectionId, currentSec + lift)
    remaining.set(sectionId, share - 1)

    const values = [...working.values()]
    const projected = clampPercent(values.reduce((sum, n) => sum + n, 0) / values.length)
    const stars = starsFor(finding)
    const title = titleOf(finding)

    rankedItems.push({
      id: finding.id,
      code: finding.code,
      title,
      stars,
      clientConfidence: clientConfidenceLabel(finding),
      proposalClarity: clarityLabel(finding.estimatedValue),
      impactNote: stars <= 1 ? 'Low business impact' : finding.businessImpact,
    })

    path.push({
      id: finding.id,
      label: `After fixing ${title}`,
      confidence: projected,
      code: finding.code,
    })
  }

  const codes = Array.isArray(report.repairOrder?.codes) ? report.repairOrder.codes : []
  const used = new Set()
  const items = []
  for (const code of codes) {
    const match = rankedItems.find((item) => item.code === code && !used.has(item.id))
    if (!match) continue
    items.push(match)
    used.add(match.id)
  }
  for (const item of rankedItems) {
    if (!used.has(item.id)) items.push(item)
  }

  return { items, path }
}
