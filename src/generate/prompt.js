import { FACT_SOURCE, GENERATOR_SECTION_LABELS, UNRESOLVED_FACT } from './types.js'

function line(label, value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return `${label}: ${text}`
}

function factLines(facts, source) {
  return facts
    .filter((entry) => entry.source === source)
    .map((entry) => {
      const title = entry.title ? `${entry.key} (${entry.title})` : entry.key
      return `- [${source}] ${title}: ${entry.value}`
    })
    .join('\n')
}

export const GENERATOR_OUTPUT_SCHEMA = Object.freeze({
  title: 'string',
  metadata: {
    proposalType: 'string',
    clientName: 'string',
    industry: 'string',
  },
  sections: [
    {
      type: 'string',
      title: 'string',
      blocks: [{ heading: 'string', body: 'string', items: 'array?' }],
    },
  ],
  assumptions: ['string'],
  exclusions: ['string'],
  sources: [{ id: 'string', title: 'string' }],
})

/**
 * Centralized proposal-generation prompt. The UI never assembles this.
 *
 * @param {{
 *   proposalInputs?: object,
 *   facts?: object,
 *   knowledge?: object,
 *   sectionPlan?: object,
 *   companyVoice?: object,
 *   outputSchema?: object,
 * }} input
 */
export function buildProposalGenerationPrompt({
  proposalInputs = {},
  facts = { facts: [] },
  knowledge = { items: [] },
  sectionPlan = { sections: [] },
  companyVoice = {},
  outputSchema = GENERATOR_OUTPUT_SCHEMA,
} = {}) {
  const sections = (sectionPlan.sections ?? [])
    .map((section) => GENERATOR_SECTION_LABELS[section.id] ?? section.title ?? section.id)
    .join(', ')
  const tone = String(companyVoice.companyTone ?? '').trim()
  const voice = String(companyVoice.brandVoice ?? '').trim()
  const userFacts = factLines(facts.facts ?? [], FACT_SOURCE.USER) || '- none'
  const knowledgeFacts = factLines(facts.facts ?? [], FACT_SOURCE.KNOWLEDGE) || '- none'
  const knowledgeTitles = (knowledge.items ?? [])
    .map((item) => `- ${item.title} (${item.id})`)
    .join('\n') || '- none'

  const systemPrompt = [
    'You are a professional proposal writer for ProposalForge.',
    'Write concise business language around known facts.',
    'Never invent factual commitments.',
    'Use only supplied user facts and approved company knowledge.',
    'Distinguish knowledge from user facts. Do not treat generated wording as a fact.',
    'Preserve company terminology and brand guidance when provided.',
    'Do not fabricate pricing, quantities, timelines, warranty periods, guarantees, certifications, capabilities, deliverables, client facts, or legal commitments.',
    `Leave unsupported values as "${UNRESOLVED_FACT}".`,
    'Return valid structured JSON only. No markdown commentary.',
    JSON.stringify(outputSchema),
  ].join('\n')

  const userPrompt = [
    line('Proposal type', proposalInputs.proposalType),
    line('Client', proposalInputs.clientName),
    line('Industry', proposalInputs.industry),
    line('Objective', proposalInputs.primaryObjective),
    line('Company name', companyVoice.companyName),
    tone ? `Company tone: ${tone}` : 'Company tone: none configured. Use neutral professional language.',
    voice ? `Brand voice: ${voice}` : 'Brand voice: none configured.',
    `Recommended sections: ${sections}`,
    '',
    'USER-PROVIDED FACTS',
    userFacts,
    '',
    'APPROVED COMPANY KNOWLEDGE',
    knowledgeFacts,
    knowledgeTitles,
    '',
    'Write sections only from the lists above. If a fact is missing, use the unresolved placeholder and do not guess.',
  ]
    .filter(Boolean)
    .join('\n')

  return { systemPrompt, userPrompt }
}
