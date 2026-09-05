import { clonePortal, makePortalRecord } from './schema.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => clonePortal(item))
}

export function configurePortalStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allPortalRecords())
}

export function allPortalRecords() {
  return cloneList(records)
}

export function replacePortalRecords(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makePortalRecord(item))
  return allPortalRecords()
}

export function resetPortalStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) => makePortalRecord(item))
  return allPortalRecords()
}

export function insertPortalRecord(item) {
  const record = makePortalRecord(item)
  records = [...records, record]
  notify()
  return clonePortal(record)
}

export function replacePortalRecord(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makePortalRecord(item)
  records = next
  notify()
  return clonePortal(records[index])
}

export function findPortalRecord(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? clonePortal(found) : undefined
}

export function findPortalByProposal(companyId, proposalId) {
  const scoped = String(companyId ?? '').trim()
  const pid = String(proposalId ?? '').trim()
  const found = records.find(
    (entry) => entry.companyId === scoped && entry.proposalId === pid,
  )
  return found ? clonePortal(found) : undefined
}

export function findAnyPortalByProposal(proposalId) {
  const pid = String(proposalId ?? '').trim()
  const found = records.find((entry) => entry.proposalId === pid)
  return found ? clonePortal(found) : undefined
}

export function listPortalsForCompany(companyId) {
  const scoped = String(companyId ?? '').trim()
  return cloneList(records.filter((entry) => entry.companyId === scoped))
}
