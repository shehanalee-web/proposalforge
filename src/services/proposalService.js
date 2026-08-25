import { makeProposal, validateProposal } from '../models/proposal.js'
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

  if (status) {
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

/** Restore seed data. Intended for tests and development tooling. */
export function resetProposals() {
  store.reset()
}
