import { cloneWorkflow, makeWorkflowRecord } from './schema.js'

/** @type {import('./schema.js').ReturnType<typeof makeWorkflowRecord>[]} */
let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneWorkflow(item))
}

export function configureWorkflowStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allWorkflowRecords())
}

export function allWorkflowRecords() {
  return cloneList(records)
}

export function replaceWorkflowRecords(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makeWorkflowRecord(item))
  return allWorkflowRecords()
}

export function resetWorkflowStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) => makeWorkflowRecord(item))
  return allWorkflowRecords()
}

export function insertWorkflowRecord(item) {
  const record = makeWorkflowRecord(item)
  records = [...records, record]
  notify()
  return cloneWorkflow(record)
}

export function replaceWorkflowRecord(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makeWorkflowRecord(item)
  records = next
  notify()
  return cloneWorkflow(records[index])
}

export function findWorkflowRecord(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? cloneWorkflow(found) : undefined
}

export function findWorkflowByProposal(companyId, proposalId) {
  const scoped = String(companyId ?? '').trim()
  const pid = String(proposalId ?? '').trim()
  const found = records.find(
    (entry) => entry.companyId === scoped && entry.proposalId === pid,
  )
  return found ? cloneWorkflow(found) : undefined
}

export function listWorkflowsForCompany(companyId) {
  const scoped = String(companyId ?? '').trim()
  return cloneList(records.filter((entry) => entry.companyId === scoped))
}
