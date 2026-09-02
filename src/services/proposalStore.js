import { MOCK_PROPOSALS } from '../data/mockProposals.js'
import { makeProposal } from '../models/proposal.js'
import { persistableProposal } from './hydrateAssets.js'

/**
 * Proposal records. Seeded from mocks, then persisted to `data/proposals.json`
 * through the local uploads API so edits (including asset ids) survive reload.
 */

/** @type {import('../models/proposal.js').Proposal[] | null} */
let records = null
let pending = null

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

async function persist() {
  if (!records) return

  const response = await fetch('/api/proposals', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records.map((record) => persistableProposal(record))),
  })

  if (!response.ok) {
    throw new Error('Could not persist proposals.')
  }
}

export async function ready() {
  if (records) return
  if (pending) return pending

  pending = (async () => {
    try {
      const response = await fetch('/api/proposals')
      if (response.ok) {
        const payload = await response.json()
        if (Array.isArray(payload?.records) && payload.records.length > 0) {
          records = payload.records.map((record) =>
            persistableProposal(makeProposal(record)),
          )
          pending = null
          return
        }
      }
    } catch {
      // Fall through to mocks when the local API is unavailable.
    }

    records = MOCK_PROPOSALS.map(makeProposal)
    pending = null
  })()

  return pending
}

export function all() {
  return clone(records ?? [])
}

export function findById(id) {
  const found = (records ?? []).find((record) => record.id === id)
  return found ? clone(found) : undefined
}

export function findByShareToken(token) {
  const found = (records ?? []).find((record) => record.shareToken === token)
  return found ? clone(found) : undefined
}

export async function insert(record) {
  const saved = persistableProposal(clone(record))
  records = [...(records ?? []), saved]
  await persist()
  return clone(saved)
}

export async function replace(id, record) {
  const list = records ?? []
  const index = list.findIndex((entry) => entry.id === id)

  if (index === -1) return undefined

  const saved = persistableProposal(clone(record))
  const next = [...list]
  next[index] = saved
  records = next
  await persist()

  return clone(saved)
}

export async function remove(id) {
  const list = records ?? []
  const next = list.filter((record) => record.id !== id)

  if (next.length === list.length) return false

  records = next
  await persist()
  return true
}

export async function reset() {
  records = MOCK_PROPOSALS.map(makeProposal)
  await persist()
}
