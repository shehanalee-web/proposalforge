import { DEFAULT_LAYOUT_ID } from '../layouts/ids.js'
import { resolveLayoutId } from '../layouts/registry.js'
import { ensureProposalBlocks, syncLegacyFromBlocks } from '../blocks/hydrate.js'

/**
 * Proposal model.
 *
 * Single source of truth for the shape of a proposal, the values its fields may
 * hold, and how a raw object is normalised into a complete record. Everything
 * here is pure — no storage, no async, no side effects — so it is safe to use
 * from any layer.
 */

import { ensureProposalVersions } from './proposalVersion.js'

export const PROPOSAL_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVISION_REQUESTED: 'revision_requested',
})

export const PROPOSAL_STATUSES = Object.freeze(Object.values(PROPOSAL_STATUS))

export const DISPLAY_STATUS = Object.freeze({
  VIEWED: 'viewed',
})

export const PROPOSAL_STATUS_LABELS = Object.freeze({
  [PROPOSAL_STATUS.DRAFT]: 'Draft',
  [PROPOSAL_STATUS.SENT]: 'Sent',
  [DISPLAY_STATUS.VIEWED]: 'Viewed',
  [PROPOSAL_STATUS.ACCEPTED]: 'Accepted',
  [PROPOSAL_STATUS.DECLINED]: 'Declined',
  [PROPOSAL_STATUS.REVISION_REQUESTED]: 'Revision requested',
})

/** Status chips shown in history filters, including display-only Viewed. */
export const LIST_STATUS_FILTERS = Object.freeze([
  PROPOSAL_STATUS.DRAFT,
  PROPOSAL_STATUS.SENT,
  DISPLAY_STATUS.VIEWED,
  PROPOSAL_STATUS.REVISION_REQUESTED,
  PROPOSAL_STATUS.ACCEPTED,
  PROPOSAL_STATUS.DECLINED,
])

export const PROJECT_TYPES = Object.freeze([
  'Branding',
  'Web Development',
  'Fabrication',
  'Marketing',
  'Motion Design',
  'Print Design',
  'Consulting',
  'Architecture',
  'Motion Graphics',
  'Creative Agency',
  'Construction',
  'Software Development',
  'Product Catalogue',
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
 * @typedef {'draft' | 'sent' | 'accepted' | 'declined' | 'revision_requested'} ProposalStatus
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
 * @property {string} shareToken              Unguessable token for the client portal.
 * @property {string | null} lastViewedAt     When a client last opened the portal.
 * @property {string | null} acceptedAt       When a client accepted the proposal.
 * @property {string} clientFeedback          Comment from a revision request.
 * @property {string} layoutId                Registered layout id (portrait, landscape, …).
 * @property {import('../blocks/instance.js').BlockInstance[]} blocks Ordered Block Engine instances.
 * @property {object[]} [images]              Gallery fallback mirrored from blocks.
 * @property {string} createdAt               ISO timestamp.
 * @property {string} updatedAt               ISO timestamp.
 * @property {number} currentVersion          Version number currently applied.
 * @property {import('./proposalVersion.js').ProposalVersion[]} versions
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
  const blocks = ensureProposalBlocks(input)
  const legacy = syncLegacyFromBlocks(blocks, input)

  const proposal = {
    id: input.id ?? createId('prop'),
    title: input.title ?? '',
    clientName: input.clientName ?? '',
    clientEmail: input.clientEmail ?? '',
    company: input.company ?? '',
    projectType: input.projectType ?? PROJECT_TYPES[0],
    status: input.status ?? PROPOSAL_STATUS.DRAFT,
    amount: Number(legacy.amount ?? input.amount ?? 0),
    currency: input.currency ?? DEFAULT_CURRENCY,
    summary: legacy.summary,
    sections: (legacy.sections ?? []).map(makeSection),
    items: (legacy.items ?? []).map(makeLineItem),
    terms: legacy.terms,
    notes: input.notes ?? '',
    tags: [...(input.tags ?? [])],
    images: [...(legacy.images ?? [])],
    validUntil: input.validUntil ?? null,
    shareToken: input.shareToken ?? createId('share'),
    lastViewedAt: input.lastViewedAt ?? null,
    acceptedAt: input.acceptedAt ?? null,
    clientFeedback: input.clientFeedback ?? '',
    layoutId: resolveLayoutId(input.layoutId ?? DEFAULT_LAYOUT_ID),
    blocks,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    currentVersion: input.currentVersion ?? 0,
    versions: Array.isArray(input.versions) ? [...input.versions] : [],
  }

  return ensureProposalVersions(proposal)
}

/**
 * Status shown in studio lists. A sent proposal that a client has opened
 * displays as Viewed without changing the stored lifecycle status.
 *
 * @param {Proposal} proposal
 * @returns {string}
 */
export function getDisplayStatus(proposal) {
  if (proposal.status === PROPOSAL_STATUS.ACCEPTED) {
    return PROPOSAL_STATUS.ACCEPTED
  }

  if (proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED) {
    return PROPOSAL_STATUS.REVISION_REQUESTED
  }

  if (proposal.lastViewedAt && proposal.status === PROPOSAL_STATUS.SENT) {
    return DISPLAY_STATUS.VIEWED
  }

  return proposal.status
}

/**
 * Whether a client can still accept or request changes.
 *
 * @param {Proposal} proposal
 * @returns {boolean}
 */
export function canClientRespond(proposal) {
  return (
    proposal.status !== PROPOSAL_STATUS.ACCEPTED &&
    proposal.status !== PROPOSAL_STATUS.DECLINED
  )
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
