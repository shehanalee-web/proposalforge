import { cloneFollowup, makeFollowupRecord } from './schema.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneFollowup(item))
}

export function configureFollowupStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allFollowupRecords())
}

export function allFollowupRecords() {
  return cloneList(records)
}

export function replaceFollowupRecords(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makeFollowupRecord(item))
  return allFollowupRecords()
}

export function resetFollowupStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) => makeFollowupRecord(item))
  return allFollowupRecords()
}

export function insertFollowupRecord(item) {
  const record = makeFollowupRecord(item)
  records = [...records, record]
  notify()
  return cloneFollowup(record)
}

export function replaceFollowupRecord(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makeFollowupRecord(item)
  records = next
  notify()
  return cloneFollowup(records[index])
}

export function findFollowupRecord(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? cloneFollowup(found) : undefined
}

export function listFollowupsForProposal(companyId, proposalId) {
  const scoped = String(companyId ?? '').trim()
  const pid = String(proposalId ?? '').trim()
  return cloneList(
    records.filter((entry) => entry.companyId === scoped && entry.proposalId === pid),
  )
}

export function listFollowupsForCompany(companyId) {
  const scoped = String(companyId ?? '').trim()
  return cloneList(records.filter((entry) => entry.companyId === scoped))
}
