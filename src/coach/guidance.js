import { FINDING_CODE } from '../insights/ids.js'
import { BUSINESS_PRIORITY, SECTION_ID } from '../intelligence/constants.js'
import { CONSISTENCY_SEVERITY } from '../consistency/relationships.js'
import {
  CONSISTENCY_KIND_COPY,
  FINDING_MODE_COPY,
  modeFields,
  resolveCoachMode,
} from './modes.js'
import { formatGoodExample } from './examples.js'
import { sectionGuidanceFor } from './sectionGuidance.js'
import {
  COACH_SECTION,
  COACH_SECTION_LABELS,
  COACH_SOURCE,
  COACH_SOURCE_LABELS,
} from './types.js'

const FINDING_META = Object.freeze({
  [FINDING_CODE.MISSING_OBJECTIVES]: {
    title: 'Clarify Objectives',
    section: COACH_SECTION.OBJECTIVES,
    flaggedBecause:
      'ProposalForge detected this because no clear client objectives were found.',
    nextAction: 'Improve Objectives',
  },
  [FINDING_CODE.WEAK_VALUE_PROPOSITION]: {
    title: 'Strengthen the opening',
    section: COACH_SECTION.SUMMARY,
    flaggedBecause:
      'ProposalForge detected this because the opening does not state a clear client outcome.',
    nextAction: 'Improve Executive Summary',
  },
  [FINDING_CODE.MISSING_DELIVERABLES]: {
    title: 'Clarify Deliverables',
    section: COACH_SECTION.DELIVERABLES,
    flaggedBecause:
      'ProposalForge detected this because no clear deliverables block was found.',
    nextAction: 'Improve Deliverables',
  },
  [FINDING_CODE.MISSING_TIMELINE]: {
    title: 'Clarify Timeline',
    section: COACH_SECTION.TIMELINE,
    flaggedBecause:
      'ProposalForge detected this because no implementation timeline was found.',
    nextAction: 'Improve Timeline',
  },
  [FINDING_CODE.WEAK_SUMMARY]: {
    title: 'Strengthen the summary',
    section: COACH_SECTION.SUMMARY,
    flaggedBecause:
      'ProposalForge detected this because the executive summary is too thin to brief a decision.',
    nextAction: 'Improve Executive Summary',
  },
  [FINDING_CODE.LONG_SUMMARY]: {
    title: 'Shorten the summary',
    section: COACH_SECTION.SUMMARY,
    flaggedBecause:
      'ProposalForge detected this because the executive summary is longer than a useful opening brief.',
    nextAction: 'Review Executive Summary',
  },
  [FINDING_CODE.MISSING_PAYMENT_TERMS]: {
    title: 'Clarify payment terms',
    section: COACH_SECTION.TERMS,
    flaggedBecause:
      'ProposalForge detected this because no clear payment terms were found.',
    nextAction: 'Improve Terms',
  },
  [FINDING_CODE.MISSING_WARRANTY]: {
    title: 'Add warranty language',
    section: COACH_SECTION.WARRANTY,
    flaggedBecause:
      'ProposalForge detected this because no warranty or aftercare statement was found.',
    nextAction: 'Review Warranty',
  },
  [FINDING_CODE.MISSING_EXCLUSIONS]: {
    title: 'Clarify Exclusions',
    section: COACH_SECTION.EXCLUSIONS,
    flaggedBecause:
      'ProposalForge detected this because no clear exclusions or out-of-scope boundary was found.',
    nextAction: 'Review Exclusions',
  },
  [FINDING_CODE.PRICING_TOO_EARLY]: {
    title: 'Move pricing later',
    section: COACH_SECTION.PRICING,
    flaggedBecause:
      'ProposalForge detected this because pricing appears before the reader has a reason to value the work.',
    nextAction: 'Review Pricing',
  },
  [FINDING_CODE.LONG_PROPOSAL]: {
    title: 'Tighten the document',
    section: COACH_SECTION.SUMMARY,
    flaggedBecause:
      'ProposalForge detected this because the proposal is long enough to bury the decision.',
    nextAction: 'Review Executive Summary',
  },
  [FINDING_CODE.MISSING_CTA]: {
    title: 'Add a next step',
    section: COACH_SECTION.SIGNATURE,
    flaggedBecause:
      'ProposalForge detected this because no clear acceptance or signature step was found.',
    nextAction: 'Review Signature',
  },
})

const SECTION_FROM_INTELLIGENCE = Object.freeze({
  [SECTION_ID.SUMMARY]: COACH_SECTION.SUMMARY,
  [SECTION_ID.OBJECTIVES]: COACH_SECTION.OBJECTIVES,
  [SECTION_ID.DELIVERABLES]: COACH_SECTION.DELIVERABLES,
  [SECTION_ID.TIMELINE]: COACH_SECTION.TIMELINE,
  [SECTION_ID.PRICING]: COACH_SECTION.PRICING,
  [SECTION_ID.SCOPE]: COACH_SECTION.SCOPE,
  [SECTION_ID.ASSUMPTIONS]: COACH_SECTION.ASSUMPTIONS,
  [SECTION_ID.WARRANTY]: COACH_SECTION.WARRANTY,
})

const CONSISTENCY_PRIORITY = Object.freeze({
  [CONSISTENCY_SEVERITY.CRITICAL]: BUSINESS_PRIORITY.CRITICAL,
  [CONSISTENCY_SEVERITY.MAJOR]: BUSINESS_PRIORITY.HIGH,
  [CONSISTENCY_SEVERITY.MINOR]: BUSINESS_PRIORITY.MEDIUM,
  [CONSISTENCY_SEVERITY.INFORMATIONAL]: BUSINESS_PRIORITY.LOW,
})

const DEFAULT_FINDING_META = Object.freeze({
  title: 'Improve this section',
  section: COACH_SECTION.SUMMARY,
  flaggedBecause: 'ProposalForge flagged this from an existing proposal finding.',
  nextAction: 'Review this section',
})

function consistencyKind(code) {
  const value = String(code ?? '')
  if (value.startsWith('duration_')) return 'duration'
  if (value.startsWith('dates_')) return 'dates'
  if (value.startsWith('scope_')) return 'scope'
  if (value.startsWith('currency_')) return 'currency'
  if (value.startsWith('quantity_')) return 'quantity'
  if (value === 'pricing_deliverable_gap') return 'pricing'
  if (value === 'exclusion_deliverable_overlap') return 'exclusion'
  if (value === 'warranty_timeline') return 'warranty'
  if (value.startsWith('missing_ref_')) return 'missing_ref'
  if (value.startsWith('duplicate_')) return 'duplicate'
  return 'generic'
}

function firstSection(sections) {
  const id = Array.isArray(sections) ? sections[0] : ''
  if (COACH_SECTION_LABELS[id]) return id
  return COACH_SECTION.SUMMARY
}

/**
 * Turn one Health diagnostic into a coaching item. Does not re-score or
 * re-detect the finding.
 */
export function coachFindingItem({ diagnostic, finding, blockId, mode } = {}) {
  const resolvedMode = resolveCoachMode(mode)
  const code = String(diagnostic?.code ?? finding?.code ?? '')
  const meta = FINDING_META[code] ?? DEFAULT_FINDING_META
  const section =
    meta.section ||
    SECTION_FROM_INTELLIGENCE[finding?.section] ||
    COACH_SECTION.SUMMARY
  const copy = modeFields(FINDING_MODE_COPY[code], resolvedMode)
  const sectionHelp = sectionGuidanceFor(section)
  const title = meta.title || finding?.cardTitle || diagnostic?.title || sectionHelp.label

  return {
    id: `coach-health-${code}`,
    title,
    priority: finding?.businessPriority || BUSINESS_PRIORITY.MEDIUM,
    findingSource: COACH_SOURCE.HEALTH,
    sourceEngine: COACH_SOURCE_LABELS[COACH_SOURCE.HEALTH],
    findingType: code,
    severity: String(diagnostic?.severity || finding?.severity || ''),
    section,
    sectionLabel: COACH_SECTION_LABELS[section] || sectionHelp.label,
    explanation: copy?.explanation || String(diagnostic?.message ?? ''),
    whyItMatters:
      copy?.whyItMatters ||
      finding?.businessImpact ||
      String(diagnostic?.message ?? ''),
    riskIfIgnored: copy?.riskIfIgnored || finding?.riskLabel || '',
    recommendation:
      copy?.recommendation ||
      finding?.recommendation ||
      String(diagnostic?.suggestion ?? ''),
    goodExample: formatGoodExample(section),
    nextAction: meta.nextAction || sectionHelp.nextAction,
    flaggedBecause: meta.flaggedBecause,
    blockId: blockId ?? diagnostic?.blockId ?? finding?.blockId ?? null,
    blockType: diagnostic?.blockType ?? finding?.blockType ?? sectionHelp.blockTypes[0] ?? null,
    aiAvailable: true,
  }
}

/**
 * Explain a Consistency Engine contradiction. Detection stays in that engine.
 */
export function coachConsistencyItem({ contradiction, blockId, mode } = {}) {
  const resolvedMode = resolveCoachMode(mode)
  const code = String(contradiction?.code ?? 'consistency')
  const kind = consistencyKind(code)
  const copy = modeFields(CONSISTENCY_KIND_COPY[kind], resolvedMode)
  const section = firstSection(contradiction?.sections)
  const sectionHelp = sectionGuidanceFor(section)
  const next =
    contradiction?.repairs?.[0] ||
    `Review ${COACH_SECTION_LABELS[section] || 'this section'}`

  return {
    id: `coach-consistency-${code}`,
    title: String(contradiction?.title ?? 'Resolve a contradiction'),
    priority: CONSISTENCY_PRIORITY[contradiction?.severity] || BUSINESS_PRIORITY.MEDIUM,
    findingSource: COACH_SOURCE.CONSISTENCY,
    sourceEngine: COACH_SOURCE_LABELS[COACH_SOURCE.CONSISTENCY],
    findingType: code,
    severity: String(contradiction?.severity ?? ''),
    section,
    sectionLabel: COACH_SECTION_LABELS[section] || sectionHelp.label,
    explanation: String(contradiction?.explanation ?? copy?.explanation ?? ''),
    whyItMatters: copy?.whyItMatters || '',
    riskIfIgnored: copy?.riskIfIgnored || '',
    recommendation:
      String(contradiction?.suggestion ?? '') || copy?.recommendation || '',
    goodExample: formatGoodExample(section),
    nextAction: next,
    flaggedBecause:
      'ProposalForge detected this because the Consistency Engine found conflicting statements across sections.',
    blockId: blockId ?? contradiction?.navigateTo ?? contradiction?.blockIds?.[0] ?? null,
    blockType: contradiction?.blockType ?? sectionHelp.blockTypes[0] ?? null,
    aiAvailable: true,
  }
}

export function healthyCoachItem(mode) {
  const resolvedMode = resolveCoachMode(mode)
  const copy = {
    beginner:
      'Existing sections look complete enough for a client to review.',
    professional:
      'Existing findings do not show a high-priority repair on this draft.',
    sales:
      'The offer is in a form a buyer can review without a forced first repair.',
    technical:
      'No outstanding Health or Consistency findings require a sequenced repair.',
    enterprise:
      'The pack is in a reviewable state; remaining edits are polish, not blockers.',
  }

  return {
    id: 'coach-healthy',
    title: 'Keep the proposal review-ready',
    priority: BUSINESS_PRIORITY.LOW,
    findingSource: COACH_SOURCE.SECTION,
    sourceEngine: COACH_SOURCE_LABELS[COACH_SOURCE.SECTION],
    findingType: 'healthy',
    severity: '',
    section: COACH_SECTION.SUMMARY,
    sectionLabel: COACH_SECTION_LABELS[COACH_SECTION.SUMMARY],
    explanation: copy[resolvedMode],
    whyItMatters:
      'A light pass still helps, but ProposalForge has not flagged a specific gap to fix first.',
    riskIfIgnored:
      'Skipping a final read may miss small clarity issues, but no engine finding is outstanding.',
    recommendation:
      'Review the document once more for tone and completeness before you send it.',
    goodExample: formatGoodExample(COACH_SECTION.SUMMARY),
    nextAction: 'Review Executive Summary',
    flaggedBecause:
      'No Health or Consistency finding is currently flagged on this draft.',
    blockId: null,
    blockType: null,
    aiAvailable: false,
  }
}
