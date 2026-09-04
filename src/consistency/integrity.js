import { CONSISTENCY_SEVERITY } from './relationships.js'

const PENALTY = Object.freeze({
  [CONSISTENCY_SEVERITY.CRITICAL]: 24,
  [CONSISTENCY_SEVERITY.MAJOR]: 14,
  [CONSISTENCY_SEVERITY.MINOR]: 6,
  [CONSISTENCY_SEVERITY.INFORMATIONAL]: 2,
})

/**
 * Independent integrity score. Does not read or write Health Score.
 *
 * @param {object[]} [contradictions]
 */
export function consistencyScore(contradictions = []) {
  let score = 100
  for (const item of contradictions) {
    score -= PENALTY[item.severity] ?? 2
  }
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}
