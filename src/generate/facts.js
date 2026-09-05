import { FACT_CONFIDENCE, FACT_SOURCE } from './types.js'

function fact(key, value, source, extra = {}) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return {
    key,
    value: text,
    source,
    confidence: FACT_CONFIDENCE.EXPLICIT,
    ...extra,
  }
}

function fromUser(inputs = {}) {
  return [
    fact('proposalType', inputs.proposalType, FACT_SOURCE.USER),
    fact('clientName', inputs.clientName, FACT_SOURCE.USER),
    fact('industry', inputs.industry, FACT_SOURCE.USER),
    fact('primaryObjective', inputs.primaryObjective, FACT_SOURCE.USER),
    fact('clientContact', inputs.clientContact, FACT_SOURCE.USER),
    fact('clientLocation', inputs.clientLocation, FACT_SOURCE.USER),
    fact('projectDescription', inputs.projectDescription, FACT_SOURCE.USER),
    fact('scope', inputs.scope, FACT_SOURCE.USER),
    fact('deliverables', (inputs.deliverables ?? []).join('\n'), FACT_SOURCE.USER),
    fact('timeline', inputs.timeline, FACT_SOURCE.USER),
    fact('pricing', inputs.pricing, FACT_SOURCE.USER),
    fact('assumptions', inputs.assumptions, FACT_SOURCE.USER),
    fact('exclusions', inputs.exclusions, FACT_SOURCE.USER),
    fact('warranty', inputs.warranty, FACT_SOURCE.USER),
    fact('specialRequirements', inputs.specialRequirements, FACT_SOURCE.USER),
    fact('notes', inputs.notes, FACT_SOURCE.USER),
  ].filter(Boolean)
}

function fromKnowledge(items = []) {
  return items
    .map((item) =>
      fact(`knowledge:${item.id}`, item.content, FACT_SOURCE.KNOWLEDGE, {
        knowledgeId: item.id,
        title: item.title,
        type: item.type,
        category: item.category,
      }),
    )
    .filter(Boolean)
}

/**
 * Distinguish user-provided facts from approved company knowledge.
 * AI-generated language must never be written back into this ledger.
 *
 * @param {{ proposalInputs?: object, knowledgeItems?: object[] }} input
 */
export function buildFactLedger({ proposalInputs = {}, knowledgeItems = [] } = {}) {
  const facts = [...fromUser(proposalInputs), ...fromKnowledge(knowledgeItems)]
  return {
    facts,
    userFacts: facts.filter((entry) => entry.source === FACT_SOURCE.USER),
    knowledgeFacts: facts.filter((entry) => entry.source === FACT_SOURCE.KNOWLEDGE),
  }
}

export function factValue(ledger, key) {
  const match = (ledger?.facts ?? []).find((entry) => entry.key === key)
  return match?.value ?? ''
}

export function hasFact(ledger, key) {
  return Boolean(factValue(ledger, key))
}

export function knowledgeFactByType(ledger, type) {
  return (ledger?.knowledgeFacts ?? []).find((entry) => entry.type === type) ?? null
}
