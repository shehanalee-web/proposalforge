import { FINDING_SEVERITY } from '../insights/ids.js'
import { profileFor } from './businessImpact.js'
import { SECTION_ID, SECTION_LABELS } from './constants.js'

const SECTION_ORDER = Object.freeze(Object.values(SECTION_ID))

const CHECK_FOR_SECTION = Object.freeze({
  [SECTION_ID.SUMMARY]: 'summary',
  [SECTION_ID.PRICING]: 'pricing',
})

const BASELINE = 88
const CHECK_PASS = Object.freeze({
  [SECTION_ID.SUMMARY]: 91,
  [SECTION_ID.PRICING]: 93,
})

function clampPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return BASELINE
  return Math.max(5, Math.min(98, Math.round(n)))
}

/**
 * Penalty taken from the diagnostic's existing impact + severity.
 * No new scan of proposal text.
 *
 * @param {object} finding
 */
export function penaltyFor(finding) {
  const catalog = Number(profileFor(finding?.code).confidencePenalty)
  if (Number.isFinite(catalog) && catalog > 0) return catalog
  const impact = Number(finding?.impact ?? finding?.estimatedValue / 10) || 5
  const severity = finding?.severity
  if (severity === FINDING_SEVERITY.CRITICAL) return Math.min(92, 30 + impact * 8)
  if (severity === FINDING_SEVERITY.WARNING) return Math.min(90, 18 + impact * 8)
  return Math.min(92, 40 + impact * 12)
}

function checkPass(health, checkId) {
  const checks = Array.isArray(health?.checks) ? health.checks : []
  const check = checks.find((item) => item.id === checkId)
  return check ? Boolean(check.pass) : null
}

/**
 * Section confidence from diagnostics only. Missing sections fall back to
 * related completeness checks when Health already computed them.
 *
 * @param {import('./types.js').IntelligenceFinding[]} findings
 * @param {object} [health]
 * @param {object[]} [diagnostics]
 * @returns {import('./types.js').IntelligenceSection[]}
 */
export function sectionConfidence(findings, health = {}, diagnostics = []) {
  const bySection = new Map()
  const diagnosticById = new Map(
    diagnostics.map((item) => [item.id, item]),
  )

  for (const finding of findings) {
    const section = finding.section
    if (!section) continue
    const source = diagnosticById.get(finding.id) ?? finding
    const current = bySection.get(section) ?? 0
    bySection.set(section, current + penaltyFor(source))
  }

  return SECTION_ORDER.map((id) => {
    const penalty = bySection.get(id) ?? 0
    if (penalty > 0) {
      return {
        id,
        label: SECTION_LABELS[id],
        confidence: clampPercent(100 - penalty),
      }
    }

    const checkId = CHECK_FOR_SECTION[id]
    if (checkId) {
      const passed = checkPass(health, checkId)
      if (passed === true) {
        return { id, label: SECTION_LABELS[id], confidence: CHECK_PASS[id] ?? BASELINE }
      }
      if (passed === false) {
        return { id, label: SECTION_LABELS[id], confidence: 52 }
      }
    }

    return { id, label: SECTION_LABELS[id], confidence: BASELINE }
  })
}

/**
 * @param {import('./types.js').IntelligenceSection[]} sections
 */
export function averageConfidence(sections) {
  if (!sections.length) return BASELINE
  const total = sections.reduce((sum, item) => sum + item.confidence, 0)
  return clampPercent(total / sections.length)
}
