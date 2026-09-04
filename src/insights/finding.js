import { createRecordId } from '../models/ids.js'
import {
  FINDING_CATEGORIES,
  FINDING_CATEGORY,
  FINDING_SEVERITIES,
  FINDING_SEVERITY,
  REVIEW_KIND,
  REVIEW_KINDS,
} from './ids.js'
import { clampScore } from './score.js'

/**
 * @typedef {object} InsightFinding
 * @property {string} id
 * @property {string} code
 * @property {string} severity
 * @property {string} category
 * @property {string} title
 * @property {string} message
 * @property {string} suggestion
 * @property {string | null} blockType
 * @property {string | null} blockId
 * @property {number} impact
 */

/**
 * @typedef {object} HealthCheck
 * @property {string} id
 * @property {string} label
 * @property {boolean} pass
 * @property {number} weight
 */

/**
 * @typedef {object} ReviewRecord
 * @property {string} id
 * @property {string} at
 * @property {string} kind
 * @property {string} summary
 * @property {number} score
 */

/**
 * @param {Partial<InsightFinding>} [input]
 * @returns {InsightFinding}
 */
export function makeFinding(input = {}) {
  const severity = FINDING_SEVERITIES.includes(input.severity)
    ? input.severity
    : FINDING_SEVERITY.INFO
  const category = FINDING_CATEGORIES.includes(input.category)
    ? input.category
    : FINDING_CATEGORY.COMPLETENESS
  const impact = Number(input.impact ?? 0)

  return {
    id: input.id ?? createRecordId('find'),
    code: String(input.code ?? '').trim() || 'unknown',
    severity,
    category,
    title: String(input.title ?? '').trim(),
    message: String(input.message ?? '').trim(),
    suggestion: String(input.suggestion ?? '').trim(),
    blockType: input.blockType ?? null,
    blockId: input.blockId ?? null,
    impact: Number.isFinite(impact) ? Math.max(0, impact) : 0,
  }
}

/**
 * @param {Partial<HealthCheck>} [input]
 * @returns {HealthCheck}
 */
export function makeHealthCheck(input = {}) {
  const weight = Number(input.weight ?? 1)

  return {
    id: String(input.id ?? '').trim() || createRecordId('check'),
    label: String(input.label ?? '').trim(),
    pass: Boolean(input.pass),
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
  }
}

/**
 * Architecture for later AI / manual reviews. Horizon 1 does not persist these.
 *
 * @param {Partial<ReviewRecord>} [input]
 * @returns {ReviewRecord}
 */
export function makeReviewRecord(input = {}) {
  return {
    id: input.id ?? createRecordId('rev'),
    at: input.at ?? new Date().toISOString(),
    kind: REVIEW_KINDS.includes(input.kind) ? input.kind : REVIEW_KIND.HEALTH,
    summary: String(input.summary ?? '').trim(),
    score: clampScore(input.score),
  }
}
