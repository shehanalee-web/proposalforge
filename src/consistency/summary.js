import {
  CONSISTENCY_SECTION_LABELS,
  CONSISTENCY_SEVERITY,
} from './relationships.js'

const RANK = Object.freeze({
  [CONSISTENCY_SEVERITY.CRITICAL]: 0,
  [CONSISTENCY_SEVERITY.MAJOR]: 1,
  [CONSISTENCY_SEVERITY.MINOR]: 2,
  [CONSISTENCY_SEVERITY.INFORMATIONAL]: 3,
})

const EMPTY = '—'

/**
 * Compact Proposal Integrity card fields.
 *
 * @param {{
 *   score?: number,
 *   contradictions?: object[],
 *   repairs?: object[],
 * }} input
 */
export function integritySummary({ score, contradictions = [], repairs = [] } = {}) {
  const ranked = [...contradictions].sort(
    (a, b) => (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9),
  )
  const highest = ranked[0] ?? null
  const sectionIds = new Set(contradictions.flatMap((item) => item.sections ?? []))
  const quick = repairs[0] ?? (highest ? { label: highest.repairs?.[0] } : null)

  return {
    score: Number.isFinite(Number(score)) ? Number(score) : 100,
    total: contradictions.length,
    affectedSections: [...sectionIds]
      .map((id) => CONSISTENCY_SECTION_LABELS[id] || id)
      .join(', ') || EMPTY,
    affectedCount: sectionIds.size,
    highestConflict: highest?.title ?? EMPTY,
    quickFix: quick?.label ?? EMPTY,
    navigateTo: highest?.navigateTo ?? quick?.navigateTo ?? null,
  }
}
