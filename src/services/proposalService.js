import {
  DEFAULT_CURRENCY,
  DISPLAY_STATUS,
  PROPOSAL_STATUS,
  PROPOSAL_STATUSES,
  getDisplayStatus,
  makeProposal,
  validateProposal,
} from '../models/proposal.js'
import { NotFoundError, ValidationError } from './errors.js'
import * as store from './proposalStore.js'

/**
 * Public data access layer for proposals.
 *
 * Every function is async and returns plain data, so swapping the in-memory
 * store for HTTP calls later is a change inside this file only — no call site
 * in the app needs to be touched.
 */

/** Simulated network delay, so loading states can be built and tested. */
export const MOCK_LATENCY_MS = 200

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export const SORTABLE_FIELDS = Object.freeze([
  'updatedAt',
  'createdAt',
  'title',
  'amount',
  'status',
])

function matchesSearch(proposal, term) {
  const query = term.trim().toLowerCase()

  if (!query) return true

  return [
    proposal.title,
    proposal.clientName,
    proposal.company,
    proposal.summary,
  ].some((field) => field.toLowerCase().includes(query))
}

function compareBy(field, order) {
  const direction = order === 'asc' ? 1 : -1

  return (a, b) => {
    const left = a[field]
    const right = b[field]

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * direction
    }

    return String(left).localeCompare(String(right)) * direction
  }
}

/**
 * @typedef {object} ListOptions
 * @property {string} [status]    Filter to a single status.
 * @property {string} [search]    Case-insensitive text match.
 * @property {string} [sortBy]    One of SORTABLE_FIELDS. Defaults to updatedAt.
 * @property {'asc'|'desc'} [sortOrder] Defaults to desc.
 * @property {number} [page]      1-based page number. Omit for no pagination.
 * @property {number} [pageSize]  Items per page. Omit for no pagination.
 */

/**
 * Fetch proposals with optional filtering, sorting and pagination.
 *
 * Returns an envelope rather than a bare array so that adding pagination to a
 * screen later does not change this function's contract.
 *
 * @param {ListOptions} [options]
 * @returns {Promise<{ items: import('../models/proposal.js').Proposal[], total: number }>}
 */
export async function fetchProposals(options = {}) {
  const {
    status,
    search = '',
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    page,
    pageSize,
  } = options

  await delay()

  let items = store.all()

  if (status === DISPLAY_STATUS.VIEWED) {
    items = items.filter(
      (proposal) => getDisplayStatus(proposal) === DISPLAY_STATUS.VIEWED,
    )
  } else if (status) {
    items = items.filter((proposal) => proposal.status === status)
  }

  if (search) {
    items = items.filter((proposal) => matchesSearch(proposal, search))
  }

  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'updatedAt'
  items.sort(compareBy(field, sortOrder))

  const total = items.length

  if (page && pageSize) {
    const start = (page - 1) * pageSize
    items = items.slice(start, start + pageSize)
  }

  return { items, total }
}

/**
 * Fetch one proposal by id.
 *
 * @param {string} id
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError}
 */
export async function fetchProposalById(id) {
  await delay()

  const proposal = store.findById(id)

  if (!proposal) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  return proposal
}

/**
 * Create a proposal from partial input.
 *
 * @param {Partial<import('../models/proposal.js').Proposal>} input
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {ValidationError}
 */
export async function createProposal(input) {
  const proposal = makeProposal(input)
  const errors = validateProposal(proposal)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  await delay()

  return store.insert(proposal)
}

/**
 * Apply a partial update to an existing proposal.
 *
 * `id` and `createdAt` are preserved and `updatedAt` is refreshed, so callers
 * cannot accidentally rewrite a record's identity or history.
 *
 * @param {string} id
 * @param {Partial<import('../models/proposal.js').Proposal>} changes
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError|ValidationError}
 */
export async function updateProposal(id, changes = {}) {
  const existing = store.findById(id)

  if (!existing) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  const updated = makeProposal({
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    shareToken: existing.shareToken,
    updatedAt: new Date().toISOString(),
  })

  const errors = validateProposal(updated)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  await delay()

  return store.replace(id, updated)
}

/**
 * Delete a proposal.
 *
 * @param {string} id
 * @returns {Promise<{ id: string }>}
 * @throws {NotFoundError}
 */
export async function deleteProposal(id) {
  await delay()

  const deleted = store.remove(id)

  if (!deleted) {
    throw new NotFoundError(`No proposal found with id "${id}".`)
  }

  return { id }
}

/**
 * @typedef {object} ProposalSummary
 * @property {number} total            Proposal count.
 * @property {number} pipelineValue    Value of proposals awaiting a decision.
 * @property {number} wonValue         Value of accepted proposals.
 * @property {number | null} acceptanceRate Accepted share of decided proposals,
 *   between 0 and 1. Null when nothing has been decided yet, which is distinct
 *   from a genuine zero percent.
 * @property {Record<string, number>} statusCounts Count per status.
 * @property {string} currency         Currency the totals are expressed in.
 */

/**
 * Aggregate figures across all proposals.
 *
 * Deliberately a separate call rather than something the UI derives from a
 * fetched list: totals must cover every record, so a paginated list could not
 * produce them correctly, and a real backend would answer this from a single
 * summary endpoint instead of sending every proposal to the browser.
 *
 * @returns {Promise<ProposalSummary>}
 */
export async function fetchProposalSummary() {
  await delay()

  const records = store.all()

  const statusCounts = Object.fromEntries(
    PROPOSAL_STATUSES.map((status) => [status, 0]),
  )

  let pipelineValue = 0
  let wonValue = 0

  for (const record of records) {
    if (record.status in statusCounts) {
      statusCounts[record.status] += 1
    }

    if (
      record.status === PROPOSAL_STATUS.SENT ||
      record.status === PROPOSAL_STATUS.REVISION_REQUESTED
    ) {
      pipelineValue += record.amount
    }

    if (record.status === PROPOSAL_STATUS.ACCEPTED) {
      wonValue += record.amount
    }
  }

  const decided =
    statusCounts[PROPOSAL_STATUS.ACCEPTED] +
    statusCounts[PROPOSAL_STATUS.DECLINED]

  return {
    total: records.length,
    pipelineValue,
    wonValue,
    acceptanceRate:
      decided > 0 ? statusCounts[PROPOSAL_STATUS.ACCEPTED] / decided : null,
    statusCounts,
    currency: DEFAULT_CURRENCY,
  }
}

function persistIdentity(existing, changes, timestamp) {
  return makeProposal({
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    shareToken: existing.shareToken,
    updatedAt: timestamp,
  })
}

function requireByShareToken(token) {
  if (!token) {
    throw new NotFoundError('No proposal found for this client link.')
  }

  const proposal = store.findByShareToken(token)

  if (!proposal) {
    throw new NotFoundError('No proposal found for this client link.')
  }

  return proposal
}

/**
 * Load a proposal for the client portal and record that it was viewed.
 *
 * Viewing does not change `updatedAt`, so a client opening the link does not
 * shuffle studio sort order. Version snapshots stay untouched.
 *
 * @param {string} token
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError}
 */
export async function fetchClientProposal(token) {
  await delay()

  const existing = requireByShareToken(token)
  const viewed = persistIdentity(
    existing,
    { lastViewedAt: new Date().toISOString() },
    existing.updatedAt,
  )

  return store.replace(existing.id, viewed)
}

/**
 * Accept a proposal from the client portal.
 *
 * @param {string} token
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError|ValidationError}
 */
export async function acceptProposal(token) {
  await delay()

  const existing = requireByShareToken(token)

  if (existing.status === PROPOSAL_STATUS.ACCEPTED) {
    return existing
  }

  if (existing.status === PROPOSAL_STATUS.DECLINED) {
    throw new ValidationError('This proposal can no longer be accepted.', [
      { field: 'status', message: 'Declined proposals cannot be accepted.' },
    ])
  }

  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.ACCEPTED,
      acceptedAt: now,
      lastViewedAt: existing.lastViewedAt ?? now,
    },
    now,
  )

  const errors = validateProposal(updated)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  return store.replace(existing.id, updated)
}

/**
 * Save client feedback and mark the proposal as needing a revision.
 *
 * @param {string} token
 * @param {string} comment
 * @returns {Promise<import('../models/proposal.js').Proposal>}
 * @throws {NotFoundError|ValidationError}
 */
export async function requestProposalChanges(token, comment) {
  const feedback = typeof comment === 'string' ? comment.trim() : ''

  if (!feedback) {
    throw new ValidationError('Please add a comment so the studio knows what to change.', [
      { field: 'clientFeedback', message: 'A comment is required.' },
    ])
  }

  await delay()

  const existing = requireByShareToken(token)

  if (existing.status === PROPOSAL_STATUS.ACCEPTED) {
    throw new ValidationError('This proposal has already been accepted.', [
      { field: 'status', message: 'Accepted proposals cannot request changes.' },
    ])
  }

  if (existing.status === PROPOSAL_STATUS.DECLINED) {
    throw new ValidationError('This proposal can no longer be revised.', [
      { field: 'status', message: 'Declined proposals cannot request changes.' },
    ])
  }

  const now = new Date().toISOString()
  const updated = persistIdentity(
    existing,
    {
      status: PROPOSAL_STATUS.REVISION_REQUESTED,
      clientFeedback: feedback,
      lastViewedAt: existing.lastViewedAt ?? now,
    },
    now,
  )

  const errors = validateProposal(updated)

  if (errors.length > 0) {
    throw new ValidationError('Proposal is not valid.', errors)
  }

  return store.replace(existing.id, updated)
}

/** Restore seed data. Intended for tests and development tooling. */
export function resetProposals() {
  store.reset()
}
