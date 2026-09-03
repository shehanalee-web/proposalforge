import { DEFAULT_CURRENCY, PROJECT_TYPES } from './proposal.js'

/**
 * Working answers collected by the AI Proposal Wizard before a proposal exists.
 *
 * This is not a proposal record. Generate Proposal maps it into the Proposal
 * Engine; the editor then owns the live document.
 *
 * @typedef {object} ProposalDraft
 * @property {string} title
 * @property {string} client
 * @property {string} company
 * @property {string} projectType
 * @property {string[]} deliverables
 * @property {string} timeline
 * @property {ProposalDraftPricing} pricing
 * @property {string} terms
 * @property {string} notes
 * @property {string} industry
 * @property {string} style
 */

/**
 * @typedef {object} ProposalDraftPricing
 * @property {number} amount
 * @property {string} currency
 * @property {string} notes
 */

export const EMPTY_DRAFT_PRICING = Object.freeze({
  amount: 0,
  currency: DEFAULT_CURRENCY,
  notes: '',
})

/**
 * @param {Partial<ProposalDraftPricing>} [input]
 * @returns {ProposalDraftPricing}
 */
export function makeDraftPricing(input = {}) {
  return {
    amount: Number(input.amount ?? 0) || 0,
    currency: input.currency || DEFAULT_CURRENCY,
    notes: input.notes ?? '',
  }
}

/**
 * @param {Partial<ProposalDraft>} [input]
 * @returns {ProposalDraft}
 */
export function makeProposalDraft(input = {}) {
  return {
    title: input.title ?? '',
    client: input.client ?? '',
    company: input.company ?? '',
    projectType: input.projectType ?? '',
    deliverables: Array.isArray(input.deliverables)
      ? input.deliverables.map((item) => String(item).trim()).filter(Boolean)
      : [],
    timeline: input.timeline ?? '',
    pricing: makeDraftPricing(input.pricing),
    terms: input.terms ?? '',
    notes: input.notes ?? '',
    industry: input.industry ?? '',
    style: input.style ?? '',
  }
}

/**
 * Merge a partial answer patch into a draft. Empty strings do not wipe filled
 * fields unless `overwrite` is set — so a later message can add extras without
 * clearing the current question's value.
 *
 * @param {ProposalDraft} draft
 * @param {Partial<ProposalDraft>} [patch]
 * @returns {ProposalDraft}
 */
export function mergeProposalDraft(draft, patch = {}) {
  const next = makeProposalDraft({
    ...draft,
    ...patch,
    pricing: makeDraftPricing({ ...draft.pricing, ...patch.pricing }),
    deliverables: Array.isArray(patch.deliverables)
      ? patch.deliverables
      : draft.deliverables,
  })

  return withSuggestedTitle(next)
}

export function hasClient(draft) {
  return Boolean(draft?.client?.trim() || draft?.company?.trim())
}

export function hasProjectType(draft) {
  return Boolean(draft?.projectType?.trim())
}

export function hasPricing(draft) {
  return Number(draft?.pricing?.amount) > 0
}

export function hasScope(draft) {
  return (
    Boolean(draft?.timeline?.trim()) ||
    (draft?.deliverables?.length ?? 0) > 0 ||
    hasPricing(draft)
  )
}

/**
 * Enough to open the editor with a useful prefilled document.
 *
 * @param {ProposalDraft} draft
 * @returns {boolean}
 */
export function isDraftReady(draft) {
  return hasClient(draft) && hasProjectType(draft) && hasScope(draft)
}

export function suggestTitle(draft) {
  const projectType = draft.projectType?.trim()
  const client = (draft.client || draft.company || '').trim()

  if (projectType && client) return `${projectType} for ${client}`
  if (projectType) return `${projectType} proposal`
  if (client) return `Proposal for ${client}`
  return ''
}

export function withSuggestedTitle(draft) {
  const title = suggestTitle(draft)
  return title ? { ...draft, title } : draft
}

/**
 * Labels for filled parts of the draft, shown on the live preview card.
 *
 * @param {ProposalDraft} draft
 * @returns {string[]}
 */
export function collectedSections(draft) {
  const sections = []

  if (draft.title?.trim()) sections.push('Title')
  if (hasClient(draft)) sections.push('Client')
  if (draft.industry?.trim()) sections.push('Industry')
  if (hasProjectType(draft)) sections.push('Project type')
  if (draft.deliverables?.length) sections.push('Deliverables')
  if (draft.timeline?.trim()) sections.push('Timeline')
  if (hasPricing(draft)) sections.push('Pricing')
  if (draft.terms?.trim()) sections.push('Terms')
  if (draft.style?.trim()) sections.push('Style')
  if (draft.notes?.trim()) sections.push('Notes')

  return sections
}

/**
 * Map free-text project type onto a known Proposal Engine value when we can.
 *
 * @param {string} [value]
 * @returns {string}
 */
export function matchProjectType(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const exact = PROJECT_TYPES.find(
    (type) => type.toLowerCase() === text.toLowerCase(),
  )
  if (exact) return exact

  const aliases = [
    [/brand/i, 'Branding'],
    [/web|website|site|app/i, 'Web Development'],
    [/fabricat/i, 'Fabrication'],
    [/market|campaign/i, 'Marketing'],
    [/motion/i, 'Motion Design'],
    [/print|catalogue|catalog/i, 'Print Design'],
    [/consult/i, 'Consulting'],
    [/architect/i, 'Architecture'],
    [/graphic/i, 'Motion Graphics'],
    [/agency|creative/i, 'Creative Agency'],
    [/construct|fit[- ]?out/i, 'Construction'],
    [/software|saas|platform/i, 'Software Development'],
    [/product/i, 'Product Catalogue'],
  ]

  const alias = aliases.find(([pattern]) => pattern.test(text))
  if (alias) return alias[1]

  const partial = PROJECT_TYPES.find(
    (type) =>
      text.toLowerCase().includes(type.toLowerCase()) ||
      type.toLowerCase().includes(text.toLowerCase()),
  )

  return partial ?? text
}
