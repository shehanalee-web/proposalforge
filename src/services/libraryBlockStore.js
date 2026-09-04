import { MOCK_LIBRARY_BLOCKS } from '../data/mockLibraryBlocks.js'
import { makeContentBlock } from '../models/contentBlock.js'

/** @type {import('../models/contentBlock.js').ContentBlock[]} */
let records = MOCK_LIBRARY_BLOCKS.map((block) => makeContentBlock(block))

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
  records = MOCK_LIBRARY_BLOCKS.map((block) => makeContentBlock(block))
}
