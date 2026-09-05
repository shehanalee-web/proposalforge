import { KNOWLEDGE_TYPE } from '../knowledge/types.js'
import { GENERATOR_SECTION, GENERATOR_SECTION_LABELS } from './types.js'
import { hasFact, knowledgeFactByType } from './facts.js'

const CORE_SECTIONS = Object.freeze([
  GENERATOR_SECTION.COVER,
  GENERATOR_SECTION.EXECUTIVE_SUMMARY,
  GENERATOR_SECTION.CLIENT_OBJECTIVES,
  GENERATOR_SECTION.SCOPE,
  GENERATOR_SECTION.APPROACH,
  GENERATOR_SECTION.DELIVERABLES,
  GENERATOR_SECTION.TIMELINE,
  GENERATOR_SECTION.PRICING,
  GENERATOR_SECTION.ASSUMPTIONS,
  GENERATOR_SECTION.EXCLUSIONS,
  GENERATOR_SECTION.ABOUT_COMPANY,
  GENERATOR_SECTION.NEXT_STEPS,
])

const TYPE_EMPHASIS = Object.freeze({
  'architectural model': [
    GENERATOR_SECTION.SCOPE,
    GENERATOR_SECTION.DELIVERABLES,
    GENERATOR_SECTION.SPECIFICATIONS,
    GENERATOR_SECTION.TIMELINE,
    GENERATOR_SECTION.WARRANTY,
  ],
  architecture: [
    GENERATOR_SECTION.SCOPE,
    GENERATOR_SECTION.DELIVERABLES,
    GENERATOR_SECTION.SPECIFICATIONS,
    GENERATOR_SECTION.TIMELINE,
  ],
  'brand identity': [
    GENERATOR_SECTION.CLIENT_OBJECTIVES,
    GENERATOR_SECTION.APPROACH,
    GENERATOR_SECTION.DELIVERABLES,
    GENERATOR_SECTION.TIMELINE,
  ],
  branding: [
    GENERATOR_SECTION.CLIENT_OBJECTIVES,
    GENERATOR_SECTION.APPROACH,
    GENERATOR_SECTION.DELIVERABLES,
  ],
  fabrication: [
    GENERATOR_SECTION.SCOPE,
    GENERATOR_SECTION.SPECIFICATIONS,
    GENERATOR_SECTION.DELIVERABLES,
    GENERATOR_SECTION.TIMELINE,
    GENERATOR_SECTION.ASSUMPTIONS,
  ],
  construction: [
    GENERATOR_SECTION.SCOPE,
    GENERATOR_SECTION.SPECIFICATIONS,
    GENERATOR_SECTION.TIMELINE,
    GENERATOR_SECTION.ASSUMPTIONS,
  ],
})

function typeKey(proposalType) {
  return String(proposalType ?? '').trim().toLowerCase()
}

function unique(list) {
  const seen = new Set()
  return list.filter((id) => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/**
 * Deterministic section planner. Industry-specific templates can extend
 * TYPE_EMPHASIS later without rewriting generation.
 *
 * @param {{
 *   proposalType?: string,
 *   industry?: string,
 *   availableFacts?: object,
 *   availableKnowledge?: object[],
 * }} input
 */
export function planProposalSections({
  proposalType,
  availableFacts,
  availableKnowledge = [],
} = {}) {
  const ledger = availableFacts ?? { facts: [], knowledgeFacts: [] }
  const emphasis = TYPE_EMPHASIS[typeKey(proposalType)] ?? []
  const planned = [...CORE_SECTIONS]

  for (const id of emphasis) {
    if (!planned.includes(id)) planned.splice(Math.max(planned.indexOf(GENERATOR_SECTION.DELIVERABLES), 0), 0, id)
  }

  if (hasFact(ledger, 'warranty') || knowledgeFactByType(ledger, KNOWLEDGE_TYPE.WARRANTY)) {
    planned.splice(planned.indexOf(GENERATOR_SECTION.EXCLUSIONS) + 1, 0, GENERATOR_SECTION.WARRANTY)
  }
  if (knowledgeFactByType(ledger, KNOWLEDGE_TYPE.TERMS) || hasFact(ledger, 'exclusions')) {
    if (!planned.includes(GENERATOR_SECTION.TERMS)) {
      planned.splice(planned.indexOf(GENERATOR_SECTION.EXCLUSIONS) + 1, 0, GENERATOR_SECTION.TERMS)
    }
  }
  if (
    availableKnowledge.some((item) => item.type === KNOWLEDGE_TYPE.CASE_STUDY) ||
    knowledgeFactByType(ledger, KNOWLEDGE_TYPE.CASE_STUDY)
  ) {
    planned.splice(planned.indexOf(GENERATOR_SECTION.ABOUT_COMPANY) + 1, 0, GENERATOR_SECTION.CASE_STUDIES)
  }
  if (
    availableKnowledge.some((item) => item.type === KNOWLEDGE_TYPE.TESTIMONIAL) ||
    knowledgeFactByType(ledger, KNOWLEDGE_TYPE.TESTIMONIAL)
  ) {
    planned.splice(planned.indexOf(GENERATOR_SECTION.ABOUT_COMPANY) + 1, 0, GENERATOR_SECTION.TESTIMONIALS)
  }

  const sections = unique(planned).map((id, index) => ({
    id,
    title: GENERATOR_SECTION_LABELS[id] ?? id,
    order: index,
    required: CORE_SECTIONS.includes(id),
  }))

  return {
    proposalType: String(proposalType ?? '').trim(),
    sections,
  }
}
