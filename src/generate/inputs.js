import { ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { GENERATION_MODE, GENERATION_MODES, GENERATOR_PROPOSAL_TYPES } from './types.js'

function asText(value) {
  return String(value ?? '').trim()
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => asText(entry)).filter(Boolean)
  }
  const text = asText(value)
  if (!text) return []
  return text
    .split(/\n|;|•|\u2022|,/)
    .map((part) => part.replace(/^[\s\-–—*]+/, '').trim())
    .filter(Boolean)
}

function slimReferenceProposal(input = {}) {
  if (!input || typeof input !== 'object') return null
  const id = asText(input.id)
  if (!id) return null
  return {
    id,
    title: asText(input.title),
    projectType: asText(input.projectType),
    summary: asText(input.summary).slice(0, 800),
    clientName: asText(input.clientName),
  }
}

/**
 * Normalize generator setup fields. Missing optional facts stay empty —
 * they are never filled with guesses.
 *
 * @param {object} [input]
 */
export function normalizeProposalInputs(input = {}) {
  const nested = input.proposalInputs && typeof input.proposalInputs === 'object'
    ? input.proposalInputs
    : input
  const proposalType = asText(nested.proposalType)
  const knownType = GENERATOR_PROPOSAL_TYPES.includes(proposalType)
    ? proposalType
    : proposalType

  return {
    companyId: asText(input.companyId ?? nested.companyId) || DEFAULT_COMPANY_ID,
    mode: GENERATION_MODES.includes(nested.mode ?? input.mode)
      ? nested.mode ?? input.mode
      : nested.referenceProposal || input.referenceProposal
        ? GENERATION_MODE.FROM_PROPOSAL
        : GENERATION_MODE.FROM_KNOWLEDGE,
    proposalType: knownType,
    clientName: asText(nested.clientName),
    industry: asText(nested.industry),
    primaryObjective: asText(nested.primaryObjective ?? nested.objective),
    clientContact: asText(nested.clientContact),
    clientLocation: asText(nested.clientLocation),
    projectDescription: asText(nested.projectDescription ?? nested.description),
    scope: asText(nested.scope),
    deliverables: asList(nested.deliverables),
    timeline: asText(nested.timeline),
    pricing: asText(nested.pricing ?? nested.budget),
    assumptions: asText(nested.assumptions),
    exclusions: asText(nested.exclusions),
    warranty: asText(nested.warranty),
    specialRequirements: asText(nested.specialRequirements),
    notes: asText(nested.notes),
    companyTone: asText(input.companyTone ?? nested.companyTone ?? input.companyVoice?.companyTone),
    brandVoice: asText(input.brandVoice ?? nested.brandVoice ?? input.companyVoice?.brandVoice),
    companyName: asText(input.companyName ?? nested.companyName ?? input.company?.name),
    referenceProposal: slimReferenceProposal(
      nested.referenceProposal ?? input.referenceProposal ?? input.optionalReferenceProposal,
    ),
  }
}

export function requiredInputErrors(inputs = {}) {
  const errors = []
  if (!asText(inputs.proposalType)) {
    errors.push({ field: 'proposalType', message: 'Proposal type is required.' })
  }
  if (!asText(inputs.clientName)) {
    errors.push({ field: 'clientName', message: 'Client name is required.' })
  }
  if (!asText(inputs.industry)) {
    errors.push({ field: 'industry', message: 'Industry is required.' })
  }
  if (!asText(inputs.primaryObjective)) {
    errors.push({ field: 'primaryObjective', message: 'Primary objective is required.' })
  }
  return errors
}

export function assertRequiredInputs(inputs) {
  const errors = requiredInputErrors(inputs)
  if (errors.length > 0) {
    throw new ValidationError('Generation setup is incomplete.', errors)
  }
  return inputs
}
