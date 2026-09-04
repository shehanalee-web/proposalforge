import {
  REPAIR_BAND,
  REPAIR_SEQUENCE,
  SECTION_LABELS,
} from './constants.js'

const SEQUENCE_INDEX = new Map(REPAIR_SEQUENCE.map((code, index) => [code, index]))

/**
 * Canonical repair sequence, filtered to diagnostics that actually exist.
 *
 * @param {import('./types.js').IntelligenceFinding[]} findings
 * @param {object[]} diagnostics
 * @returns {import('./types.js').IntelligenceRepairOrder}
 */
export function buildRepairOrder(findings, diagnostics) {
  const list = Array.isArray(diagnostics) ? diagnostics : []
  const findingById = new Map(findings.map((item) => [item.id, item]))

  const ordered = [...list].sort((a, b) => {
    const aSeq = SEQUENCE_INDEX.get(a?.code) ?? REPAIR_SEQUENCE.length
    const bSeq = SEQUENCE_INDEX.get(b?.code) ?? REPAIR_SEQUENCE.length
    if (aSeq !== bSeq) return aSeq - bSeq
    return 0
  })

  const steps = ordered.map((diagnostic) => {
    const finding = findingById.get(diagnostic.id)
    const section = finding?.section ?? ''
    return {
      code: diagnostic.code,
      title: diagnostic.title,
      section,
      sectionLabel: SECTION_LABELS[section] ?? diagnostic.title,
      band: finding?.band ?? REPAIR_BAND.RECOMMENDED,
    }
  })

  return {
    steps,
    codes: steps.map((step) => step.code),
    diagnostics: ordered,
  }
}

/**
 * Unique sections in repair order, grouped for a future automation timeline.
 *
 * @param {import('./types.js').IntelligenceRepairStep[]} steps
 * @returns {import('./types.js').IntelligenceTimeline}
 */
export function buildTimeline(steps) {
  const timeline = {
    immediate: [],
    recommended: [],
    optional: [],
  }
  const seen = new Set()

  for (const step of steps) {
    const id = step.section || step.code
    if (!id || seen.has(id)) continue
    seen.add(id)
    const bucket =
      step.band === REPAIR_BAND.IMMEDIATE
        ? timeline.immediate
        : step.band === REPAIR_BAND.OPTIONAL
          ? timeline.optional
          : timeline.recommended
    bucket.push({ id, label: step.sectionLabel || step.title })
  }

  return timeline
}
