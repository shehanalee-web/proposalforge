import { MOCK_PROPOSALS } from '../data/mockProposals.js'
import { makeProposal } from '../models/proposal.js'
import { persistableProposal } from './hydrateAssets.js'
import { advanceEmailStatus } from '../models/emailDelivery.js'

/**
 * Proposal records. Seeded from mocks, then persisted to `data/proposals.json`
 * through the local uploads API so edits (including asset ids) survive reload.
 */

/** @type {import('../models/proposal.js').Proposal[] | null} */
let records = null
let pending = null
let persistChain = Promise.resolve()
/** @type {Set<string>} */
let pendingShareTokenRotations = new Set()

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function mergeLastEmail(local, remote) {
  if (!remote) return local ?? null
  if (!local) return remote
  if (local.id && remote.id && local.id !== remote.id) {
    const localTime = Date.parse(local.sentAt || '') || 0
    const remoteTime = Date.parse(remote.sentAt || '') || 0
    return remoteTime >= localTime ? remote : local
  }
  return {
    ...local,
    ...remote,
    status: advanceEmailStatus(local.status, remote.status),
    error: remote.error || local.error,
  }
}

async function persist() {
  persistChain = persistChain.then(flushRecords, flushRecords)
  await persistChain
}

async function flushRecords() {
  if (!records) return

  const rotateIds = new Set(pendingShareTokenRotations)
  pendingShareTokenRotations = new Set()

  let disk = []
  try {
    const response = await fetch('/api/proposals')
    if (response.ok) {
      const payload = await response.json()
      if (Array.isArray(payload?.records)) disk = payload.records
    }
  } catch {
    /* local API unavailable */
  }

  const diskById = new Map(disk.map((row) => [row.id, row]))
  const merged = records.map((record) => {
    const payload = persistableProposal(record)
    const fromDisk = diskById.get(record.id)
    const shareToken = rotateIds.has(record.id)
      ? record.shareToken
      : fromDisk?.shareToken || record.shareToken
    if (!fromDisk) return { ...payload, shareToken }
    return {
      ...payload,
      shareToken,
      lastEmail: mergeLastEmail(payload.lastEmail, fromDisk.lastEmail),
      lastViewedAt: fromDisk.lastViewedAt || payload.lastViewedAt,
    }
  })

  const headers = { 'Content-Type': 'application/json' }
  if (rotateIds.size > 0) {
    headers['X-Rotate-Share-Token-Ids'] = [...rotateIds].join(',')
  }

  const response = await fetch('/api/proposals', {
    method: 'PUT',
    headers,
    body: JSON.stringify(merged),
  })

  if (!response.ok) {
    throw new Error('Could not persist proposals.')
  }

  if (!records) return

  const writtenById = new Map(merged.map((row) => [row.id, row]))
  records = records.map((record) => {
    const written = writtenById.get(record.id)
    if (!written) return record
    return persistableProposal(
      makeProposal({
        ...written,
        shareToken: written.shareToken,
        lastEmail: mergeLastEmail(record.lastEmail, written.lastEmail),
      }),
    )
  })
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
  const value = String(token ?? '').trim()
  if (!value) return undefined
  const found = (records ?? []).find((record) => record.shareToken === value)
  return found ? clone(found) : undefined
}

export async function insert(record) {
  const saved = persistableProposal(clone(record))
  records = [...(records ?? []), saved]
  await persist()
  return clone(saved)
}

export async function replace(id, record, options = {}) {
  const list = records ?? []
  const index = list.findIndex((entry) => entry.id === id)

  if (index === -1) return undefined

  const current = list[index]
  const shareToken = options.rotateShareToken
    ? String(record.shareToken ?? '').trim()
    : current.shareToken
  if (options.rotateShareToken && !shareToken) {
    throw new Error('A share token is required to rotate a client link.')
  }
  if (options.rotateShareToken) {
    pendingShareTokenRotations.add(id)
  }

  const saved = persistableProposal(clone({ ...record, shareToken }))
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
