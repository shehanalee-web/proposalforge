import {
  makeContentBlock,
  snapshotLibraryBlock,
  validateContentBlock,
} from '../models/contentBlock.js'
import { NotFoundError, ValidationError } from './errors.js'
import * as store from './libraryBlockStore.js'

const MOCK_LATENCY_MS = 80

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function compareLibrary(a, b) {
  if (Boolean(a.favorite) !== Boolean(b.favorite)) {
    return a.favorite ? -1 : 1
  }
  return String(a.name).localeCompare(String(b.name))
}

export async function fetchLibraryBlocks() {
  await delay()
  return store.all().sort(compareLibrary)
}

export async function fetchLibraryBlockById(id) {
  await delay()
  const block = store.findById(id)
  if (!block) {
    throw new NotFoundError(`No library block found with id "${id}".`)
  }
  return block
}

export async function createLibraryBlock(input) {
  const block = makeContentBlock(input)
  const errors = validateContentBlock(block)
  if (errors.length > 0) {
    throw new ValidationError('Block is not valid.', errors)
  }
  await delay()
  return store.insert(block)
}

export async function updateLibraryBlock(id, changes = {}) {
  const existing = store.findById(id)
  if (!existing) {
    throw new NotFoundError(`No library block found with id "${id}".`)
  }

  let updated = makeContentBlock({
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    versions: existing.versions,
    updatedAt: new Date().toISOString(),
  })

  if (changes.snapshot) {
    updated = snapshotLibraryBlock(updated, changes.snapshotLabel ?? 'Saved')
  }

  const errors = validateContentBlock(updated)
  if (errors.length > 0) {
    throw new ValidationError('Block is not valid.', errors)
  }

  await delay()
  return store.replace(id, updated)
}

export async function deleteLibraryBlock(id) {
  await delay()
  const deleted = store.remove(id)
  if (!deleted) {
    throw new NotFoundError(`No library block found with id "${id}".`)
  }
  return { id }
}

export async function touchLibraryBlock(id) {
  const existing = store.findById(id)
  if (!existing) return null
  return store.replace(
    id,
    makeContentBlock({
      ...existing,
      useCount: Number(existing.useCount ?? 0) + 1,
      lastUsedAt: new Date().toISOString(),
      updatedAt: existing.updatedAt,
    }),
  )
}

export async function resetLibraryBlocks() {
  store.reset()
}
