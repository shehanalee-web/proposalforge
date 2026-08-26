/**
 * Proposal model.
 *
 * Single source of truth for the shape of a proposal, the values its fields may
 * hold, and how a raw object is normalised into a complete record. Everything
 * here is pure — no storage, no async, no side effects — so it is safe to use
 * from any layer.
 */

export const PROPOSAL_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
})

export const PROPOSAL_STATUSES = Object.freeze(Object.values(PROPOSAL_STATUS))

export const PROPOSAL_STATUS_LABELS = Object.freeze({
  [PROPOSAL_STATUS.DRAFT]: 'Draft',
  [PROPOSAL_STATUS.SENT]: 'Sent',
  [PROPOSAL_STATUS.ACCEPTED]: 'Accepted',
  [PROPOSAL_STATUS.DECLINED]: 'Declined',
})

export const PROJECT_TYPES = Object.freeze([
  'Branding',
  'Web Development',
  'Fabrication',
  'Marketing',
  'Motion Design',
  'Print Design',
  'Consulting',
])

export const DEFAULT_CURRENCY = 'USD'

/**
 * A single content block within a proposal document.
 *
 * @typedef {object} ProposalSection
 * @property {string} id
 * @property {string} heading
 * @property {string} body
 */

/**
 * @typedef {'draft' | 'sent' | 'accepted' | 'declined'} ProposalStatus
 */

/**
 * @typedef {object} Proposal
 * @property {string} id                      Stable unique identifier.
 * @property {string} title                   Proposal title.
 * @property {string} clientName              Primary contact name.
 * @property {string} clientEmail             Primary contact email.
 * @property {string} company                 Client company name.
 * @property {string} projectType             One of PROJECT_TYPES.
 * @property {ProposalStatus} status          Lifecycle state.
 * @property {number} amount                  Total value, in major units.
 * @property {string} currency                ISO 4217 currency code.
 * @property {string} summary                 Short plain-text overview.
 * @property {ProposalSection[]} sections     Ordered document body.
 * @property {ProposalLineItem[]} items       Priced line items.
 * @property {string} terms                   Terms & conditions (plain text).
 * @property {string} notes                   Internal or client-facing notes.
 * @property {string[]} tags                  Free-form labels.
 * @property {string | null} validUntil       ISO date the offer expires.
 * @property {string} createdAt               ISO timestamp.
 * @property {string} updatedAt               ISO timestamp.
 */

/**
 * @typedef {object} ProposalLineItem
 * @property {string} id
 * @property {string} description
 * @property {number} amount
 */

function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Normalise a partial section into a complete one.
 *
 * @param {Partial<ProposalSection>} [input]
 * @returns {ProposalSection}
 */
export function makeSection(input = {}) {
  return {
    id: input.id ?? createId('sec'),
    heading: input.heading ?? '',
    body: input.body ?? '',
  }
}

/**
 * @param {Partial<ProposalLineItem>} [input]
 * @returns {ProposalLineItem}
 */
export function makeLineItem(input = {}) {
  return {
    id: input.id ?? createId('item'),
    description: input.description ?? '',
    amount: Number(input.amount ?? 0),
  }
}

/**
 * Normalise a partial proposal into a complete record. Unknown keys on the
 * input are dropped, which keeps stored records predictable regardless of what
 * a caller (or a future API response) hands over.
 *
 * @param {Partial<Proposal>} [input]
 * @returns {Proposal}
 */
export function makeProposal(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createId('prop'),
    title: input.title ?? '',
    clientName: input.clientName ?? '',
    clientEmail: input.clientEmail ?? '',
    company: input.company ?? '',
    projectType: input.projectType ?? PROJECT_TYPES[0],
    status: input.status ?? PROPOSAL_STATUS.DRAFT,
    amount: Number(input.amount ?? 0),
    currency: input.currency ?? DEFAULT_CURRENCY,
    summary: input.summary ?? '',
    sections: (input.sections ?? []).map(makeSection),
    items: (input.items ?? []).map(makeLineItem),
    terms: input.terms ?? '',
    notes: input.notes ?? '',
    tags: [...(input.tags ?? [])],
    validUntil: input.validUntil ?? null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Check a proposal against the model's rules.
 *
 * Returns a list rather than throwing so a form can show every problem at once.
 * The service layer is responsible for turning a non-empty list into an error.
 *
 * @param {Partial<Proposal>} proposal
 * @returns {{ field: string, message: string }[]}
 */
export function validateProposal(proposal) {
  const errors = []

  if (!proposal.title || !proposal.title.trim()) {
    errors.push({ field: 'title', message: 'Title is required.' })
  }

  if (!proposal.clientName || !proposal.clientName.trim()) {
    errors.push({ field: 'clientName', message: 'Client name is required.' })
  }

  if (proposal.clientEmail && !EMAIL_PATTERN.test(proposal.clientEmail)) {
    errors.push({ field: 'clientEmail', message: 'Client email is not valid.' })
  }

  if (!PROPOSAL_STATUSES.includes(proposal.status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${PROPOSAL_STATUSES.join(', ')}.`,
    })
  }

  if (!Number.isFinite(proposal.amount) || proposal.amount < 0) {
    errors.push({ field: 'amount', message: 'Amount must be zero or greater.' })
  }

  const items = proposal.items ?? []

  items.forEach((item, index) => {
    if (!Number.isFinite(item.amount) || item.amount < 0) {
      errors.push({
        field: `items.${index}.amount`,
        message: 'Line item amounts must be zero or greater.',
      })
    }
  })

  return errors
}
