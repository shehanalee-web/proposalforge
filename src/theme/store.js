import { makeTokens } from './tokens.js'

const PREFIX = 'proposalforge.design.'
const listeners = new Map()

function keyFor(id) {
  return `${PREFIX}${id || 'draft'}`
}

export function readDesign(proposalId) {
  if (typeof window === 'undefined' || !proposalId) return null
  try {
    const raw = window.localStorage.getItem(keyFor(proposalId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeDesign(proposalId, design) {
  if (typeof window === 'undefined' || !proposalId) return
  try {
    window.localStorage.setItem(keyFor(proposalId), JSON.stringify(design))
  } catch {
    /* Quota or private mode — keep in-memory listeners only. */
  }
  emit(proposalId, design)
}

export function exportDesign(proposalId) {
  const design = readDesign(proposalId)
  return JSON.stringify(design ?? makeTokens(), null, 2)
}

export function importDesign(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw && typeof raw === 'object' ? raw : null
}

export function subscribeDesign(proposalId, callback) {
  const bucket = listeners.get(proposalId) ?? new Set()
  bucket.add(callback)
  listeners.set(proposalId, bucket)
  return () => {
    bucket.delete(callback)
  }
}

function emit(proposalId, design) {
  listeners.get(proposalId)?.forEach((callback) => callback(design))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('proposalforge:design', { detail: { proposalId, design } }),
    )
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(PREFIX) || !event.newValue) return
    const proposalId = event.key.slice(PREFIX.length)
    try {
      emit(proposalId, JSON.parse(event.newValue))
    } catch {
      emit(proposalId, makeTokens())
    }
  })
}
