import { MOCK_SERVICES } from '../data/mockServices.js'
import { makeService } from '../models/service.js'

/**
 * Service Library records. Seeded from mocks, then persisted to
 * `data/services.json` through the local uploads API so edits survive reload.
 */

/** @type {import('../models/service.js').Service[] | null} */
let records = null
let pending = null
let persistChain = Promise.resolve()

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

async function persist() {
  persistChain = persistChain.then(flushRecords, flushRecords)
  await persistChain
}

async function flushRecords() {
  if (!records) return

  const payload = records.map((record) => makeService(record))
  const response = await fetch('/api/services', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Could not persist services.')
  }

  if (!records) return
  records = payload
}

export async function ready() {
  if (records) return
  if (pending) return pending

  pending = (async () => {
    try {
      const response = await fetch('/api/services')
      if (response.ok) {
        const payload = await response.json()
        if (Array.isArray(payload?.records)) {
          records = payload.records.map((record) => makeService(record))
          pending = null
          return
        }
      }
    } catch {
      // Fall through to mocks when the local API is unavailable.
    }

    records = MOCK_SERVICES.map(makeService)
    pending = null
  })()

  return pending
}

export function dropCache() {
  records = null
  pending = null
}

export function all() {
  return clone(records ?? [])
}

export function findById(id) {
  const found = (records ?? []).find((record) => record.id === id)
  return found ? clone(found) : undefined
}

export async function insert(record) {
  const saved = makeService(clone(record))
  records = [...(records ?? []), saved]
  await persist()
  return clone(saved)
}

export async function replace(id, record) {
  const list = records ?? []
  const index = list.findIndex((entry) => entry.id === id)

  if (index === -1) return undefined

  const saved = makeService(clone(record))
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
  records = MOCK_SERVICES.map(makeService)
  await persist()
}
