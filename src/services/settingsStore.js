import { MOCK_SETTINGS } from '../data/mockSettings.js'
import { makeSettings } from '../models/settings.js'

/**
 * Studio settings. Seeded from mocks, then persisted to `data/settings.json`
 * through the local uploads API so the profile survives reload.
 */

/** @type {import('../models/settings.js').Settings | null} */
let record = null
let pending = null
let persistChain = Promise.resolve()

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function persistableSettings(value) {
  return makeSettings(value)
}

async function persist() {
  persistChain = persistChain.then(flushRecord, flushRecord)
  await persistChain
}

async function flushRecord() {
  if (!record) return

  const payload = persistableSettings(record)
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Could not persist settings.')
  }

  if (!record) return
  record = payload
}

export async function ready() {
  if (record) return
  if (pending) return pending

  pending = (async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const payload = await response.json()
        const stored = payload?.record
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          record = persistableSettings(stored)
          pending = null
          return
        }
      }
    } catch {
      // Fall through to the seed profile when the local API is unavailable.
    }

    record = makeSettings(MOCK_SETTINGS)
    pending = null
  })()

  return pending
}

export function dropCache() {
  record = null
  pending = null
}

export function get() {
  return clone(record ?? makeSettings(MOCK_SETTINGS))
}

export async function set(next) {
  record = persistableSettings(next)
  await persist()
  return clone(record)
}

export async function reset() {
  record = makeSettings(MOCK_SETTINGS)
  await persist()
}
