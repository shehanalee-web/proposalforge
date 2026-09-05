import { BLOCK_TYPE } from '../blocks/ids.js'
import { COACH_SECTION, COACH_SECTION_LABELS } from './types.js'

/**
 * Reusable educational guidance. Not a second Health or Consistency engine.
 * Proposal-specific recommendations still come from existing findings.
 */
export const SECTION_GUIDANCE = Object.freeze({
  [COACH_SECTION.SUMMARY]: {
    section: COACH_SECTION.SUMMARY,
    label: COACH_SECTION_LABELS[COACH_SECTION.SUMMARY],
    blockTypes: [BLOCK_TYPE.EXECUTIVE_SUMMARY, BLOCK_TYPE.COVER],
    purpose: 'Brief a decision-maker on outcome, path, and commercial frame.',
    nextAction: 'Review Executive Summary',
  },
  [COACH_SECTION.OBJECTIVES]: {
    section: COACH_SECTION.OBJECTIVES,
    label: COACH_SECTION_LABELS[COACH_SECTION.OBJECTIVES],
    blockTypes: [BLOCK_TYPE.EXECUTIVE_SUMMARY, BLOCK_TYPE.RICH_TEXT],
    purpose: 'Name the client outcomes this engagement is meant to achieve.',
    nextAction: 'Clarify Objectives',
  },
  [COACH_SECTION.SCOPE]: {
    section: COACH_SECTION.SCOPE,
    label: COACH_SECTION_LABELS[COACH_SECTION.SCOPE],
    blockTypes: [BLOCK_TYPE.RICH_TEXT, BLOCK_TYPE.TERMS],
    purpose: 'Draw a finite boundary around the work being offered.',
    nextAction: 'Review Scope',
  },
  [COACH_SECTION.DELIVERABLES]: {
    section: COACH_SECTION.DELIVERABLES,
    label: COACH_SECTION_LABELS[COACH_SECTION.DELIVERABLES],
    blockTypes: [BLOCK_TYPE.DELIVERABLES],
    purpose: 'List the actual outputs the client will receive.',
    nextAction: 'Improve Deliverables',
  },
  [COACH_SECTION.TIMELINE]: {
    section: COACH_SECTION.TIMELINE,
    label: COACH_SECTION_LABELS[COACH_SECTION.TIMELINE],
    blockTypes: [BLOCK_TYPE.TIMELINE],
    purpose: 'Show how the work moves from kickoff to handover.',
    nextAction: 'Review Timeline',
  },
  [COACH_SECTION.PRICING]: {
    section: COACH_SECTION.PRICING,
    label: COACH_SECTION_LABELS[COACH_SECTION.PRICING],
    blockTypes: [BLOCK_TYPE.PRICING],
    purpose: 'State the investment after the reader understands the work.',
    nextAction: 'Review Pricing',
  },
  [COACH_SECTION.ASSUMPTIONS]: {
    section: COACH_SECTION.ASSUMPTIONS,
    label: COACH_SECTION_LABELS[COACH_SECTION.ASSUMPTIONS],
    blockTypes: [BLOCK_TYPE.TERMS, BLOCK_TYPE.RICH_TEXT],
    purpose: 'Name client inputs the fee and dates depend on.',
    nextAction: 'Review Assumptions',
  },
  [COACH_SECTION.EXCLUSIONS]: {
    section: COACH_SECTION.EXCLUSIONS,
    label: COACH_SECTION_LABELS[COACH_SECTION.EXCLUSIONS],
    blockTypes: [BLOCK_TYPE.TERMS],
    purpose: 'Say what is not included so the price stays trustworthy.',
    nextAction: 'Review Exclusions',
  },
  [COACH_SECTION.WARRANTY]: {
    section: COACH_SECTION.WARRANTY,
    label: COACH_SECTION_LABELS[COACH_SECTION.WARRANTY],
    blockTypes: [BLOCK_TYPE.TERMS],
    purpose: 'State post-completion cover in terms you actually offer.',
    nextAction: 'Review Warranty',
  },
  [COACH_SECTION.TERMS]: {
    section: COACH_SECTION.TERMS,
    label: COACH_SECTION_LABELS[COACH_SECTION.TERMS],
    blockTypes: [BLOCK_TYPE.TERMS],
    purpose: 'Record payment, legal, and operating conditions for the engagement.',
    nextAction: 'Review Terms',
  },
  [COACH_SECTION.ACCEPTANCE]: {
    section: COACH_SECTION.ACCEPTANCE,
    label: COACH_SECTION_LABELS[COACH_SECTION.ACCEPTANCE],
    blockTypes: [BLOCK_TYPE.SIGNATURE],
    purpose: 'Tell the client how to accept and what happens next.',
    nextAction: 'Review Acceptance',
  },
  [COACH_SECTION.SIGNATURE]: {
    section: COACH_SECTION.SIGNATURE,
    label: COACH_SECTION_LABELS[COACH_SECTION.SIGNATURE],
    blockTypes: [BLOCK_TYPE.SIGNATURE],
    purpose: 'Provide the artefact that turns the proposal into an approval.',
    nextAction: 'Review Signature',
  },
})

export function sectionGuidanceFor(section) {
  return SECTION_GUIDANCE[section] ?? SECTION_GUIDANCE[COACH_SECTION.SUMMARY]
}
