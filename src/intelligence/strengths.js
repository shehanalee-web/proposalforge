import { FINDING_CODE } from '../insights/ids.js'
import { SECTION_ID } from './constants.js'

const STRENGTH_COPY = Object.freeze({
  [SECTION_ID.SUMMARY]: 'Strong executive summary',
  [SECTION_ID.OBJECTIVES]: 'Client objectives stated',
  [SECTION_ID.DELIVERABLES]: 'Clear deliverables',
  [SECTION_ID.TIMELINE]: 'Clear implementation timeline',
  [SECTION_ID.PRICING]: 'Clear pricing',
  [SECTION_ID.SCOPE]: 'Detailed scope',
  [SECTION_ID.ASSUMPTIONS]: 'Well-defined assumptions',
  [SECTION_ID.WARRANTY]: 'Post-completion assurances',
})

const FORMATTING_CODES = new Set([
  FINDING_CODE.LONG_PROPOSAL,
  FINDING_CODE.LONG_SUMMARY,
])

/**
 * Strengths are sections with no intelligence finding and healthy confidence.
 *
 * @param {import('./types.js').ProposalIntelligence} report
 * @returns {{ id: string, label: string }[]}
 */
export function identifyStrengths(report = {}) {
  const findings = Array.isArray(report.findings) ? report.findings : []
  const sections = Array.isArray(report.sections) ? report.sections : []
  const touched = new Set(findings.map((item) => item.section).filter(Boolean))
  const strengths = []

  for (const section of sections) {
    if (touched.has(section.id)) continue
    if ((Number(section.confidence) || 0) < 80) continue
    const label = STRENGTH_COPY[section.id]
    if (!label) continue
    strengths.push({ id: section.id, label })
  }

  const hasFormattingIssue = findings.some((item) => FORMATTING_CODES.has(item.code))
  if (!hasFormattingIssue) {
    strengths.push({ id: 'formatting', label: 'Professional formatting' })
  }

  return strengths
}
