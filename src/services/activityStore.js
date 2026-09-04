import { makeActivityEventRow } from '../models/activityEvent.js'

/**
 * Activity event table. Persisted to `data/activityEvents.json` through the
 * local uploads API so the audit log survives reload.
 */

/** @type {import('../models/activityEvent.js').ActivityEvent[] | null} */
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

  const response = await fetch('/api/activity-events', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  })

  if (!response.ok) {
    throw new Error('Could not persist activity events.')
  }
}

async function syncFromDisk() {
  try {
    const response = await fetch('/api/activity-events')
    if (!response.ok) return
    const payload = await response.json()
    const list = Array.isArray(payload?.records) ? payload.records : payload
    if (Array.isArray(list)) {
      records = list.map((row) => makeActivityEventRow(row))
    }
  } catch {
    /* local API unavailable */
  }
}

export async function ready() {
  if (records) return
  if (pending) return pending

  pending = (async () => {
    await syncFromDisk()
    if (!records) records = []
    pending = null
  })()

  return pending
}

export async function refresh() {
  await mergeFromDisk()
  if (!records) records = []
}

export function all() {
  return clone(records ?? [])
}

export function listByProposal(proposalId) {
  return clone(records ?? [])
    .filter((row) => row.proposal_id === proposalId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

export async function insert(row) {
  await mergeFromDisk()
  const saved = makeActivityEventRow(clone(row))
  records = [...(records ?? []), saved]
  await persist()
  return clone(saved)
}

export async function insertMany(rows) {
  if (!rows?.length) return []
  await mergeFromDisk()
  const saved = rows.map((row) => makeActivityEventRow(clone(row)))
  records = [...(records ?? []), ...saved]
  await persist()
  return clone(saved)
}

async function mergeFromDisk() {
  const previous = records ?? []
  await syncFromDisk()
  const byId = new Map()
  for (const row of records ?? []) byId.set(row.id, row)
  for (const row of previous) byId.set(row.id, row)
  records = [...byId.values()]
}

export async function reset() {
  records = []
  await persist()
}
