import { MOCK_TEMPLATES } from '../data/mockTemplates.js'
import { makeTemplate } from '../models/template.js'

/**
 * In-memory backing store for proposal templates.
 *
 * Separate from the proposal store so editing a proposal can never mutate a
 * template. Resets on page reload: no backend, no localStorage.
 */

/** @type {import('../models/template.js').ProposalTemplate[]} */
let records = MOCK_TEMPLATES.map(makeTemplate)

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

export function reset() {
  records = MOCK_TEMPLATES.map(makeTemplate)
}
