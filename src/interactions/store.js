import { cloneInteraction, makeInteractionRecord } from './schema.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneInteraction(item))
}

export function configureInteractionStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allInteractionRecords())
}

export function allInteractionRecords() {
  return cloneList(records)
}

export function replaceInteractionRecords(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makeInteractionRecord(item))
  return allInteractionRecords()
}

export function resetInteractionStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) => makeInteractionRecord(item))
  return allInteractionRecords()
}

export function insertInteractionRecord(item) {
  const record = makeInteractionRecord(item)
  records = [...records, record]
  notify()
  return cloneInteraction(record)
}

export function replaceInteractionRecord(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makeInteractionRecord(item)
  records = next
  notify()
  return cloneInteraction(records[index])
}

export function findInteractionRecord(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? cloneInteraction(found) : undefined
}

export function listInteractionsForPortal(portalId) {
  const scoped = String(portalId ?? '').trim()
  return cloneList(records.filter((entry) => entry.portalId === scoped))
}

export function listInteractionsForProposal(companyId, proposalId) {
  const scoped = String(companyId ?? '').trim()
  const pid = String(proposalId ?? '').trim()
  return cloneList(
    records.filter((entry) => entry.companyId === scoped && entry.proposalId === pid),
  )
}

export function listInteractionsForCompany(companyId) {
  const scoped = String(companyId ?? '').trim()
  return cloneList(records.filter((entry) => entry.companyId === scoped))
}
