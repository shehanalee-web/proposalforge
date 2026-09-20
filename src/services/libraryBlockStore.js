import { MOCK_LIBRARY_BLOCKS } from '../data/mockLibraryBlocks.js'
import { makeContentBlock } from '../models/contentBlock.js'
import { persistableUrl } from '../utils/publicUrl.js'

/**
 * Content Library records. Seeded from mocks, then persisted to
 * `data/library-blocks.json` through the local uploads API so edits survive
 * reload.
 */

/** @type {import('../models/contentBlock.js').ContentBlock[] | null} */
let records = null
let pending = null
let persistChain = Promise.resolve()

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function persistableFields(value) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(persistableFields)

  const next = { ...value }
  if ('url' in next) next.url = persistableUrl(next.url)
  if ('src' in next) next.src = persistableUrl(next.src)
  if ('imageUrl' in next) next.imageUrl = persistableUrl(next.imageUrl)
  if ('photoUrl' in next) next.photoUrl = persistableUrl(next.photoUrl)
  if ('portraitUrl' in next) next.portraitUrl = persistableUrl(next.portraitUrl)
  if (next.portrait && typeof next.portrait === 'object') {
    next.portrait = {
      ...next.portrait,
      url: persistableUrl(next.portrait.url),
    }
  }
  if (Array.isArray(next.items)) next.items = next.items.map(persistableFields)
  if (Array.isArray(next.members)) next.members = next.members.map(persistableFields)
  if (Array.isArray(next.rows)) next.rows = next.rows.map(persistableFields)
  return next
}

function persistableLibraryBlock(block) {
  const base = makeContentBlock(block)
  return makeContentBlock({
    ...base,
    data: persistableFields(base.data),
    versions: (base.versions ?? []).map((entry) => ({
      ...entry,
      snapshot: {
        ...(entry.snapshot ?? {}),
        data: persistableFields(entry.snapshot?.data ?? {}),
      },
    })),
  })
}

async function persist() {
  persistChain = persistChain.then(flushRecords, flushRecords)
  await persistChain
}

async function flushRecords() {
  if (!records) return

  const payload = records.map((record) => persistableLibraryBlock(record))
  const response = await fetch('/api/library-blocks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Could not persist library blocks.')
  }

  if (!records) return
  records = payload
}

export async function ready() {
  if (records) return
  if (pending) return pending

  pending = (async () => {
    try {
      const response = await fetch('/api/library-blocks')
      if (response.ok) {
        const payload = await response.json()
        if (Array.isArray(payload?.records)) {
          records = payload.records.map((record) => persistableLibraryBlock(record))
          pending = null
          return
        }
      }
    } catch {
      // Fall through to mocks when the local API is unavailable.
    }

    records = MOCK_LIBRARY_BLOCKS.map((block) => makeContentBlock(block))
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
  const saved = persistableLibraryBlock(clone(record))
  records = [...(records ?? []), saved]
  await persist()
  return clone(saved)
}

export async function replace(id, record) {
  const list = records ?? []
  const index = list.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const saved = persistableLibraryBlock(clone(record))
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
  records = MOCK_LIBRARY_BLOCKS.map((block) => makeContentBlock(block))
  await persist()
}
