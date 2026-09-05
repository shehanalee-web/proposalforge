import { KNOWLEDGE_TYPE } from '../knowledge/types.js'
import { factValue, hasFact, knowledgeFactByType } from './facts.js'
import { GENERATOR_SECTION, GENERATOR_SECTION_LABELS, UNRESOLVED_FACT } from './types.js'

function paragraph(...parts) {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
}

function block(heading, body, items = []) {
  return { heading, body, items }
}

function knowledgeBody(ledger, type, fallback) {
  return knowledgeFactByType(ledger, type)?.value || fallback
}

function listItems(value) {
  return String(value ?? '')
    .split(/\n/)
    .map((line) => line.replace(/^[\s\-–—*]+/, '').trim())
    .filter(Boolean)
    .map((title) => ({ title, body: '' }))
}

function section(type, blocks) {
  return {
    type,
    title: GENERATOR_SECTION_LABELS[type] ?? type,
    blocks,
  }
}

function unresolved(topic) {
  return `${UNRESOLVED_FACT}. ${topic}`
}

/**
 * Deterministic mock generation. Phrases known facts. Never invents prices,
 * timelines, warranties, or other commitments.
 *
 * @param {object} context
 */
export function buildMockGeneratedDraft(context = {}) {
  const inputs = context.proposalInputs ?? {}
  const ledger = context.facts ?? { facts: [] }
  const knowledgeItems = context.knowledge?.items ?? []
  const client = factValue(ledger, 'clientName') || inputs.clientName
  const type = factValue(ledger, 'proposalType') || inputs.proposalType
  const industry = factValue(ledger, 'industry') || inputs.industry
  const objective = factValue(ledger, 'primaryObjective') || inputs.primaryObjective
  const profile = knowledgeBody(ledger, KNOWLEDGE_TYPE.COMPANY_PROFILE, '')
  const positioning = knowledgeBody(ledger, KNOWLEDGE_TYPE.POSITIONING, '')
  const service = knowledgeBody(ledger, KNOWLEDGE_TYPE.SERVICE, '')
  const exclusions = factValue(ledger, 'exclusions') || knowledgeBody(ledger, KNOWLEDGE_TYPE.EXCLUSION, '')
  const warranty = factValue(ledger, 'warranty') || knowledgeBody(ledger, KNOWLEDGE_TYPE.WARRANTY, '')
  const terms = knowledgeBody(ledger, KNOWLEDGE_TYPE.TERMS, '')
  const assumptions = factValue(ledger, 'assumptions') || knowledgeBody(ledger, KNOWLEDGE_TYPE.ASSUMPTION, '')
  const scope = factValue(ledger, 'scope') || factValue(ledger, 'projectDescription')
  const timeline = factValue(ledger, 'timeline')
  const pricing = factValue(ledger, 'pricing')
  const deliverables = factValue(ledger, 'deliverables')
  const title = `${type} proposal for ${client}`

  const planned = (context.sectionPlan?.sections ?? []).map((entry) => entry.id)
  const sections = []

  const builders = {
    [GENERATOR_SECTION.COVER]: () =>
      section(GENERATOR_SECTION.COVER, [
        block(
          title,
          paragraph(
            `${type} for ${client}`,
            industry ? `Industry: ${industry}.` : '',
          ),
        ),
      ]),
    [GENERATOR_SECTION.EXECUTIVE_SUMMARY]: () =>
      section(GENERATOR_SECTION.EXECUTIVE_SUMMARY, [
        block(
          '',
          paragraph(
            `This proposal describes a ${type.toLowerCase()} engagement for ${client} in ${industry}.`,
            `The primary objective is ${objective}.`,
            scope ? `Agreed scope: ${scope}.` : '',
            positioning,
          ),
        ),
      ]),
    [GENERATOR_SECTION.CLIENT_OBJECTIVES]: () =>
      section(GENERATOR_SECTION.CLIENT_OBJECTIVES, [
        block('Objectives', objective),
      ]),
    [GENERATOR_SECTION.SCOPE]: () =>
      section(GENERATOR_SECTION.SCOPE, [
        block(
          'Scope',
          scope || unresolved('Scope will be confirmed with the client before work begins.'),
        ),
      ]),
    [GENERATOR_SECTION.APPROACH]: () =>
      section(GENERATOR_SECTION.APPROACH, [
        block(
          'Approach',
          paragraph(
            service || `Work is organised around the ${type.toLowerCase()} process already used by the studio.`,
            factValue(ledger, 'specialRequirements')
              ? `Special requirements: ${factValue(ledger, 'specialRequirements')}.`
              : '',
          ),
        ),
      ]),
    [GENERATOR_SECTION.DELIVERABLES]: () =>
      section(GENERATOR_SECTION.DELIVERABLES, [
        block(
          'Deliverables',
          deliverables ? '' : unresolved('Deliverables will be confirmed before kickoff.'),
          deliverables ? listItems(deliverables) : [],
        ),
      ]),
    [GENERATOR_SECTION.SPECIFICATIONS]: () =>
      section(GENERATOR_SECTION.SPECIFICATIONS, [
        block(
          'Specifications',
          factValue(ledger, 'notes') ||
            unresolved('Materials, scale and technical specifications will be confirmed in writing.'),
        ),
      ]),
    [GENERATOR_SECTION.TIMELINE]: () =>
      section(GENERATOR_SECTION.TIMELINE, [
        block(
          'Timeline',
          timeline || unresolved('A schedule will be agreed before work starts.'),
        ),
      ]),
    [GENERATOR_SECTION.PRICING]: () =>
      section(GENERATOR_SECTION.PRICING, [
        block(
          'Pricing',
          pricing || unresolved('Fees are not included until they are confirmed.'),
        ),
      ]),
    [GENERATOR_SECTION.ASSUMPTIONS]: () =>
      section(GENERATOR_SECTION.ASSUMPTIONS, [
        block(
          'Assumptions',
          assumptions || unresolved('Assumptions will be listed once the brief is complete.'),
        ),
      ]),
    [GENERATOR_SECTION.EXCLUSIONS]: () =>
      section(GENERATOR_SECTION.EXCLUSIONS, [
        block(
          'Exclusions',
          exclusions || unresolved('Exclusions will follow approved company language once selected.'),
        ),
      ]),
    [GENERATOR_SECTION.WARRANTY]: () =>
      section(GENERATOR_SECTION.WARRANTY, [
        block(
          'Warranty',
          warranty || unresolved('No approved warranty language was supplied.'),
        ),
      ]),
    [GENERATOR_SECTION.TERMS]: () =>
      section(GENERATOR_SECTION.TERMS, [
        block('Terms', terms || exclusions || unresolved('Commercial terms remain to be confirmed.')),
      ]),
    [GENERATOR_SECTION.ABOUT_COMPANY]: () =>
      section(GENERATOR_SECTION.ABOUT_COMPANY, [
        block('About the studio', profile || positioning || 'Prepared by the studio named in Company Knowledge.'),
      ]),
    [GENERATOR_SECTION.CASE_STUDIES]: () => {
      const item = knowledgeFactByType(ledger, KNOWLEDGE_TYPE.CASE_STUDY)
      return section(GENERATOR_SECTION.CASE_STUDIES, [
        block(item?.title || 'Case studies', item?.value || unresolved('No approved case study was selected.')),
      ])
    },
    [GENERATOR_SECTION.TESTIMONIALS]: () => {
      const item = knowledgeFactByType(ledger, KNOWLEDGE_TYPE.TESTIMONIAL)
      return section(GENERATOR_SECTION.TESTIMONIALS, [
        block(item?.title || 'Testimonials', item?.value || unresolved('No approved testimonial was selected.')),
      ])
    },
    [GENERATOR_SECTION.NEXT_STEPS]: () =>
      section(GENERATOR_SECTION.NEXT_STEPS, [
        block(
          'Next steps',
          `Review this draft with ${client}, confirm any ${UNRESOLVED_FACT.toLowerCase()} items, then approve to proceed.`,
        ),
      ]),
  }

  for (const id of planned) {
    const build = builders[id]
    if (build) sections.push(build())
  }

  if (!hasFact(ledger, 'primaryObjective') && sections.length === 0) {
    sections.push(builders[GENERATOR_SECTION.EXECUTIVE_SUMMARY]())
  }

  return {
    title,
    metadata: {
      proposalType: type,
      clientName: client,
      industry,
    },
    sections,
    assumptions: assumptions ? [assumptions] : [],
    exclusions: exclusions ? [exclusions] : [],
    sources: knowledgeItems.map((item) => ({ id: item.id, title: item.title })),
  }
}
