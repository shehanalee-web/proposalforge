import { FINDING_CODE } from '../insights/ids.js'
import { READINESS, SECTION_ID } from './constants.js'

function hasCode(findings, code) {
  return findings.some((item) => item.code === code)
}

function sectionConfidence(sections, id) {
  const row = sections.find((item) => item.id === id)
  return Number(row?.confidence) || 0
}

function titleOf(finding) {
  return finding?.cardTitle || finding?.title || 'this gap'
}

/**
 * Single highest-impact recommendation. Uses the already-ranked findings.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 */
export function executivePriority(report = {}) {
  const first = Array.isArray(report.findings) ? report.findings[0] : null
  if (!first) {
    return {
      headline: 'No single repair is required.',
      detail: 'Existing sections are in good shape for a client review.',
      title: null,
      code: null,
    }
  }
  const title = titleOf(first)
  return {
    headline: `If you fix only one thing, start with ${title}.`,
    detail: 'It provides the highest business impact.',
    title,
    code: first.code,
  }
}

/**
 * 3–5 deterministic observations from intelligence output only.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 * @returns {string[]}
 */
export function buildExecutiveInsights(report = {}) {
  const findings = Array.isArray(report.findings) ? report.findings : []
  const sections = Array.isArray(report.sections) ? report.sections : []
  const quickWins = Array.isArray(report.quickWins) ? report.quickWins : []
  const readiness = report.readiness?.id
  const pricing = sectionConfidence(sections, SECTION_ID.PRICING)
  const timeline = sectionConfidence(sections, SECTION_ID.TIMELINE)
  const deliverables = sectionConfidence(sections, SECTION_ID.DELIVERABLES)
  const capable =
    [pricing, timeline, deliverables].filter((value) => value >= 80).length >= 2

  const lines = []

  if (pricing >= 80 && (hasCode(findings, FINDING_CODE.MISSING_TIMELINE) || timeline < 50)) {
    lines.push('This proposal is commercially strong but lacks implementation clarity.')
  }

  if (pricing >= 80 && (hasCode(findings, FINDING_CODE.MISSING_DELIVERABLES) || deliverables < 50)) {
    lines.push('Pricing is easy to read, but the client cannot yet see the work they are buying.')
  }

  if (timeline >= 80 && hasCode(findings, FINDING_CODE.MISSING_DELIVERABLES)) {
    lines.push('Buyers can follow the schedule but may still question what they actually receive.')
  }

  if (
    pricing >= 80 &&
    (hasCode(findings, FINDING_CODE.MISSING_TIMELINE) || timeline < 60) &&
    !lines.includes('This proposal is commercially strong but lacks implementation clarity.')
  ) {
    lines.push('Buyers are likely to understand pricing but may question delivery expectations.')
  }

  if (capable && (hasCode(findings, FINDING_CODE.MISSING_EXCLUSIONS) || sectionConfidence(sections, SECTION_ID.SCOPE) < 70)) {
    lines.push('The proposal appears technically capable but does not sufficiently define project scope.')
  }

  if (
    hasCode(findings, FINDING_CODE.MISSING_OBJECTIVES) ||
    hasCode(findings, FINDING_CODE.WEAK_SUMMARY) ||
    hasCode(findings, FINDING_CODE.WEAK_VALUE_PROPOSITION)
  ) {
    lines.push('The opening does not yet tell the buyer why this work is for them.')
  }

  if (hasCode(findings, FINDING_CODE.MISSING_WARRANTY)) {
    lines.push('Delivery risk appears higher because post-completion assurances are absent.')
  }

  if (hasCode(findings, FINDING_CODE.MISSING_PAYMENT_TERMS)) {
    lines.push('Commercial terms leave finance without a clear payment path.')
  }

  if (quickWins.length >= 2) {
    lines.push('Several high-impact gaps can be closed with short, focused edits.')
  }

  if (readiness === READINESS.MAJOR || readiness === READINESS.NOT_READY) {
    lines.push('The document is not yet in a form a client can confidently approve.')
  }

  if (readiness === READINESS.READY) {
    lines.push('This proposal is in a form a client can review with only light polish.')
  }

  if (readiness === READINESS.MINOR && lines.length < 3) {
    lines.push('A small set of repairs will make this easier for a buyer to approve.')
  }

  const unique = [...new Set(lines)]
  if (unique.length > 0) return unique.slice(0, 5)
  if (findings.length === 0) {
    return ['Existing sections are consistent enough for a client review.']
  }
  return ['Repair the highest-priority gap first; remaining issues are secondary.']
}
