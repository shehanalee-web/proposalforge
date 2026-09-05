import { healthyCoachItem } from './guidance.js'

/**
 * Top recommendation follows the existing repair order: the first coaching
 * item is the highest-value next step.
 */
export function buildCoachSummary(items = [], mode) {
  const list = Array.isArray(items) ? items : []
  const top = list[0] ?? healthyCoachItem(mode)

  return {
    headline: top.title,
    whyItMatters: top.whyItMatters,
    nextAction: top.recommendation,
    nextLabel: top.nextAction,
    topRecommendation: top,
    count: list.length,
  }
}
