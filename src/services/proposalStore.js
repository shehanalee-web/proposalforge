import { MOCK_PROPOSALS } from '../data/mockProposals.js'
import { makeProposal } from '../models/proposal.js'

/**
 * In-memory backing store for proposals.
 *
 * This is the only module that holds proposal state, and the only one that will
 * be deleted when a real API arrives — `proposalService` is the stable surface
 * the rest of the app imports. State lives in a module-level array, so it resets
 * on page reload by design: no backend, no localStorage.
 */

/** @type {import('../models/proposal.js').Proposal[]} */
let records = MOCK_PROPOSALS.map(makeProposal)

/**
 * Deep copy on every read and write, so callers can never mutate stored state
 * by holding on to a returned object. Mirrors how a real network boundary
 * behaves, which keeps UI code honest about updating through the service.
 */
function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

export function all() {
  return clone(records)
}

export function findById(id) {
  const found = records.find((record) => record.id === id)
  return found ? clone(found) : undefined
}

export function findByShareToken(token) {
  const found = records.find((record) => record.shareToken === token)
  return found ? clone(found) : undefined
}

export function insert(record) {
  records = [...records, clone(record)]
  return clone(record)
}

export function replace(id, record) {
  const index = records.findIndex((entry) => entry.id === id)

  if (index === -1) return undefined

  const next = [...records]
  next[index] = clone(record)
  records = next

  return clone(record)
}

export function remove(id) {
  const next = records.filter((record) => record.id !== id)

  if (next.length === records.length) return false

  records = next
  return true
}

/** Restore the seed data. Intended for tests and development tooling. */
export function reset() {
  records = MOCK_PROPOSALS.map(makeProposal)
}
