import { makeNotification } from '../models/notification.js'

/**
 * Notification table. Persisted to `data/notifications.json` through the
 * local uploads API so the inbox survives reload.
 */

/** @type {import('../models/notification.js').StudioNotification[] | null} */
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

  const response = await fetch('/api/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  })

  if (!response.ok) {
    throw new Error('Could not persist notifications.')
  }
}

async function syncFromDisk() {
  try {
    const response = await fetch('/api/notifications')
    if (!response.ok) return
    const payload = await response.json()
    const list = Array.isArray(payload?.records) ? payload.records : payload
    if (Array.isArray(list)) {
      records = list.map((row) => makeNotification(row))
    }
  } catch {
    /* local API unavailable */
  }
}

async function mergeFromDisk() {
  const previous = records ?? []
  await syncFromDisk()
  const byId = new Map()
  for (const row of records ?? []) byId.set(row.id, row)
  for (const row of previous) byId.set(row.id, row)
  records = [...byId.values()]
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

export function all() {
  return clone(records ?? []).sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  )
}

export async function insert(row) {
  await mergeFromDisk()
  const saved = makeNotification(clone(row))
  records = [saved, ...(records ?? []).filter((item) => item.id !== saved.id)]
  await persist()
  return clone(saved)
}

export async function replaceAll(next) {
  await ready()
  records = next.map((row) => makeNotification(row))
  await persist()
  return all()
}

export async function reset() {
  records = []
  await persist()
}
