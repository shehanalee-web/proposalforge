import { BUSINESS_PRIORITY, READINESS, READINESS_LABELS } from './constants.js'
import { averageConfidence } from './confidence.js'

/**
 * Overall send-readiness. Reads Health Score; never writes it.
 *
 * @param {{
 *   health?: object,
 *   findings?: import('./types.js').IntelligenceFinding[],
 *   risks?: import('./types.js').IntelligenceRisk[],
 *   sections?: import('./types.js').IntelligenceSection[],
 * }} input
 * @returns {import('./types.js').IntelligenceReadiness}
 */
export function proposalReadiness({
  health,
  findings = [],
  risks = [],
  sections = [],
} = {}) {
  const raw = Number(health?.overallScore)
  const score = Number.isFinite(raw) ? raw : 0
  const critical = findings.filter(
    (item) => item.businessPriority === BUSINESS_PRIORITY.CRITICAL,
  ).length
  const high = findings.filter(
    (item) => item.businessPriority === BUSINESS_PRIORITY.HIGH,
  ).length
  const highRisks = risks.filter((item) => item.level === 'high').length
  const confidence = averageConfidence(sections)

  let id = READINESS.NOT_READY

  if (
    score >= 88 &&
    critical === 0 &&
    high === 0 &&
    highRisks === 0 &&
    confidence >= 82
  ) {
    id = READINESS.READY
  } else if (score >= 75 && critical === 0 && high <= 3 && confidence >= 58) {
    id = READINESS.MINOR
  } else if (score >= 50 && critical <= 1 && confidence >= 32) {
    id = READINESS.REVIEW
  } else if (score >= 30) {
    id = READINESS.MAJOR
  }

  return { id, label: READINESS_LABELS[id] }
}
