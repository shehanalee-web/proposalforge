import { FINDING_CATEGORY, FINDING_SEVERITY } from '../insights/ids.js'
import { makeFinding } from '../insights/finding.js'
import { CONSISTENCY_SEVERITY } from './relationships.js'

const SEVERITY_TO_FINDING = Object.freeze({
  [CONSISTENCY_SEVERITY.CRITICAL]: FINDING_SEVERITY.CRITICAL,
  [CONSISTENCY_SEVERITY.MAJOR]: FINDING_SEVERITY.WARNING,
  [CONSISTENCY_SEVERITY.MINOR]: FINDING_SEVERITY.INFO,
  [CONSISTENCY_SEVERITY.INFORMATIONAL]: FINDING_SEVERITY.INFO,
})

/**
 * Map contradictions onto the existing improvement finding shape so
 * Generate / Preview / Insert can run without changing that workflow.
 *
 * @param {object[]} [contradictions]
 */
export function toImprovementFindings(contradictions = []) {
  return contradictions.map((item, index) =>
    makeFinding({
      id: item.id,
      code: item.code || `consistency_${index}`,
      severity: SEVERITY_TO_FINDING[item.severity] ?? FINDING_SEVERITY.INFO,
      category: FINDING_CATEGORY.STRUCTURE,
      title: item.title,
      message: item.explanation,
      suggestion: item.suggestion,
      blockType: item.blockType,
      blockId: item.navigateTo,
      impact:
        item.severity === CONSISTENCY_SEVERITY.CRITICAL
          ? 9
          : item.severity === CONSISTENCY_SEVERITY.MAJOR
            ? 7
            : 3,
    }),
  )
}

/**
 * @param {object[]} [contradictions]
 */
export function collectRepairs(contradictions = []) {
  const seen = new Set()
  const repairs = []
  for (const item of contradictions) {
    for (const label of item.repairs ?? []) {
      if (seen.has(label)) continue
      seen.add(label)
      repairs.push({
        label,
        contradictionId: item.id,
        navigateTo: item.navigateTo,
        severity: item.severity,
      })
    }
  }
  return repairs
}
