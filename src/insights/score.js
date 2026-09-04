import { RISK_LEVEL, RISK_LEVELS } from './ids.js'

/**
 * Clamp any numeric input to a 0–100 integer score.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function clampScore(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return 0
  return Math.max(0, Math.min(100, Math.round(next)))
}

/**
 * @param {unknown} value
 * @returns {typeof RISK_LEVEL[keyof typeof RISK_LEVEL]}
 */
export function normalizeRisk(value) {
  return RISK_LEVELS.includes(value) ? value : RISK_LEVEL.HIGH
}

/**
 * Map a 0–100 score onto a risk band.
 * High < 50, medium < 75, otherwise low.
 *
 * @param {unknown} score
 */
export function riskFromScore(score) {
  const value = clampScore(score)
  if (value < 50) return RISK_LEVEL.HIGH
  if (value < 75) return RISK_LEVEL.MEDIUM
  return RISK_LEVEL.LOW
}

/**
 * Weighted blend of 0–100 scores. Weights are relative, not required to sum
 * to 1. Empty input returns 0.
 *
 * @param {{ score: unknown, weight?: number }[]} parts
 */
export function blendScores(parts = []) {
  let total = 0
  let weight = 0

  for (const part of parts) {
    const nextWeight = Number(part.weight ?? 1)
    if (!Number.isFinite(nextWeight) || nextWeight <= 0) continue
    total += clampScore(part.score) * nextWeight
    weight += nextWeight
  }

  return weight > 0 ? clampScore(total / weight) : 0
}
