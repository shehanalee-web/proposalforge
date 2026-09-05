import { resolveCoachMode } from './modes.js'
import { buildCoachContext, resolveBlockId } from './context.js'
import {
  coachFindingItem,
  coachConsistencyItem,
  healthyCoachItem,
} from './guidance.js'
import { buildCoachSummary } from './summary.js'
import { COACH_EXTENSIONS } from './types.js'

export {
  COACH_MODE,
  COACH_MODES,
  COACH_MODE_LABELS,
  resolveCoachMode,
} from './modes.js'
export {
  COACH_SOURCE,
  COACH_SOURCES,
  COACH_SOURCE_LABELS,
  COACH_ACTION,
  COACH_ACTIONS,
  COACH_ACTION_LABELS,
  COACH_SECTION,
  COACH_SECTIONS,
  COACH_SECTION_LABELS,
  COACH_EXTENSIONS,
} from './types.js'
export { buildCoachContext } from './context.js'
export { formatGoodExample } from './examples.js'
export { sectionGuidanceFor } from './sectionGuidance.js'

function findingFor(ctx, diagnostic) {
  return (
    ctx.findingById.get(diagnostic?.id) ||
    ctx.findingByCode.get(diagnostic?.code) ||
    null
  )
}

/**
 * Deterministic Proposal Coach. Consumes Health, Intelligence, and
 * Consistency outputs. Does not recalculate scores or re-detect findings.
 *
 * @param {{
 *   proposal?: object,
 *   health?: object,
 *   diagnostics?: object[],
 *   intelligence?: object,
 *   consistency?: object,
 *   mode?: string,
 * }} [input]
 * @returns {import('./types.js').ProposalCoaching}
 */
export function analyzeProposalCoaching(input = {}) {
  const mode = resolveCoachMode(input.mode)
  const ctx = buildCoachContext(input)
  const items = []

  for (const diagnostic of ctx.diagnostics) {
    if (!diagnostic?.code) continue
    const finding = findingFor(ctx, diagnostic)
    items.push(
      coachFindingItem({
        diagnostic,
        finding,
        blockId: resolveBlockId(ctx.blocks, {
          diagnostic,
          section: finding?.section,
        }),
        mode,
      }),
    )
  }

  const contradictions = Array.isArray(ctx.consistency.contradictions)
    ? ctx.consistency.contradictions
    : []
  for (const contradiction of contradictions) {
    items.push(
      coachConsistencyItem({
        contradiction,
        blockId: resolveBlockId(ctx.blocks, { contradiction }),
        mode,
      }),
    )
  }

  const list = items.length > 0 ? items : []
  const summary = buildCoachSummary(list, mode)
  const topRecommendation =
    list[0] ?? summary.topRecommendation ?? healthyCoachItem(mode)

  return {
    topRecommendation,
    items: list,
    mode,
    summary: {
      ...summary,
      topRecommendation,
    },
    extensions: { ...COACH_EXTENSIONS },
  }
}
