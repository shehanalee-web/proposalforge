import { BUSINESS_PRIORITY, REPAIR_SEQUENCE } from './constants.js'

const SEQUENCE_INDEX = new Map(REPAIR_SEQUENCE.map((code, index) => [code, index]))

/**
 * Priority is a business-impact band. It does not read Health Score.
 *
 * @param {number} score 0–100
 */
export function priorityFor(score) {
  const value = Number(score) || 0
  if (value >= 72) return BUSINESS_PRIORITY.CRITICAL
  if (value >= 55) return BUSINESS_PRIORITY.HIGH
  if (value >= 38) return BUSINESS_PRIORITY.MEDIUM
  return BUSINESS_PRIORITY.LOW
}

const PRIORITY_RANK = Object.freeze({
  [BUSINESS_PRIORITY.CRITICAL]: 0,
  [BUSINESS_PRIORITY.HIGH]: 1,
  [BUSINESS_PRIORITY.MEDIUM]: 2,
  [BUSINESS_PRIORITY.LOW]: 3,
})

/**
 * @param {import('./types.js').IntelligenceFinding[]} findings
 * @returns {import('./types.js').IntelligenceFinding[]}
 */
export function rankFindings(findings) {
  return findings
    .map((finding) => ({
      ...finding,
      businessPriority: priorityFor(finding.businessScore),
    }))
    .sort((a, b) => {
      const priority = PRIORITY_RANK[a.businessPriority] - PRIORITY_RANK[b.businessPriority]
      if (priority !== 0) return priority
      if (b.businessScore !== a.businessScore) return b.businessScore - a.businessScore
      const aSeq = SEQUENCE_INDEX.get(a.code) ?? REPAIR_SEQUENCE.length
      const bSeq = SEQUENCE_INDEX.get(b.code) ?? REPAIR_SEQUENCE.length
      return aSeq - bSeq
    })
}
