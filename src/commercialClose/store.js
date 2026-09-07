import { cloneCommercialClose, makeCommercialClose } from './schema.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneCommercialClose(item))
}

export function configureCommercialCloseStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allCommercialCloses())
}

export function allCommercialCloses() {
  return cloneList(records)
}

export function replaceCommercialCloses(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makeCommercialClose(item))
  return allCommercialCloses()
}

export function resetCommercialCloseStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) => makeCommercialClose(item))
  return allCommercialCloses()
}

export function insertCommercialClose(item) {
  const record = makeCommercialClose(item)
  records = [...records, record]
  notify()
  return cloneCommercialClose(record)
}

export function replaceCommercialClose(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makeCommercialClose(item)
  records = next
  notify()
  return cloneCommercialClose(records[index])
}

export function findCommercialClose(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? cloneCommercialClose(found) : undefined
}

export function findCommercialCloseByProposal(proposalId, companyId) {
  const pid = String(proposalId ?? '').trim()
  const company = String(companyId ?? '').trim()
  if (!pid) return undefined
  const found = records.find((entry) => {
    if (entry.proposalId !== pid) return false
    if (company && entry.companyId !== company) return false
    return true
  })
  return found ? cloneCommercialClose(found) : undefined
}

/**
 * Idempotency key: one close per accepted decision (session + acceptedAt).
 */
export function findCommercialCloseByDecision(sessionId, acceptedAt, companyId) {
  const sid = String(sessionId ?? '').trim()
  const accepted = String(acceptedAt ?? '').trim()
  const company = String(companyId ?? '').trim()
  if (!sid || !accepted) return undefined
  const found = records.find((entry) => {
    if (entry.sessionId !== sid) return false
    if (entry.decision?.acceptedAt !== accepted) return false
    if (company && entry.companyId !== company) return false
    return true
  })
  return found ? cloneCommercialClose(found) : undefined
}

export function listCommercialClosesForProposal(proposalId, companyId) {
  const pid = String(proposalId ?? '').trim()
  const company = String(companyId ?? '').trim()
  return cloneList(
    records.filter((entry) => {
      if (entry.proposalId !== pid) return false
      if (company && entry.companyId !== company) return false
      return true
    }),
  )
}
