import { cloneLivingSession, makeLivingSession } from './schema.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneLivingSession(item))
}

export function configureLivingStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allLivingSessions())
}

export function allLivingSessions() {
  return cloneList(records)
}

export function replaceLivingSessions(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makeLivingSession(item))
  return allLivingSessions()
}

export function resetLivingStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) => makeLivingSession(item))
  return allLivingSessions()
}

export function insertLivingSession(item) {
  const record = makeLivingSession(item)
  records = [...records, record]
  notify()
  return cloneLivingSession(record)
}

export function replaceLivingSession(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makeLivingSession(item)
  records = next
  notify()
  return cloneLivingSession(records[index])
}

export function findLivingSession(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? cloneLivingSession(found) : undefined
}

/**
 * One current session per share token (share context identity).
 * Session id is internal and never placed in the public URL.
 */
export function findLivingSessionByShareToken(shareToken) {
  const token = String(shareToken ?? '').trim()
  if (!token) return undefined
  const found = records.find((entry) => entry.shareToken === token)
  return found ? cloneLivingSession(found) : undefined
}

export function listLivingSessionsForProposal(proposalId) {
  const pid = String(proposalId ?? '').trim()
  return cloneList(records.filter((entry) => entry.proposalId === pid))
}
