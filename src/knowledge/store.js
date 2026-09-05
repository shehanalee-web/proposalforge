import { cloneKnowledge, makeKnowledgeItem } from './schema.js'
import { DEMO_KNOWLEDGE } from './demo.js'

/** @type {import('./schema.js').KnowledgeItem[]} */
let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneKnowledge(item))
}

export function configureKnowledgeStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allKnowledgeRecords())
}

export function allKnowledgeRecords() {
  return cloneList(records)
}

export function replaceKnowledgeRecords(next) {
  records = (Array.isArray(next) ? next : []).map((item) => makeKnowledgeItem(item))
  return allKnowledgeRecords()
}

export function seedKnowledgeRecords(seed = DEMO_KNOWLEDGE) {
  records = seed.map((item) => makeKnowledgeItem(item))
  return allKnowledgeRecords()
}

export function resetKnowledgeStore(seed = DEMO_KNOWLEDGE) {
  seedKnowledgeRecords(seed)
  return allKnowledgeRecords()
}

export function insertKnowledgeRecord(item) {
  const record = makeKnowledgeItem(item)
  records = [...records, record]
  notify()
  return cloneKnowledge(record)
}

export function replaceKnowledgeRecord(id, item) {
  const index = records.findIndex((entry) => entry.id === id)
  if (index === -1) return undefined
  const next = [...records]
  next[index] = makeKnowledgeItem(item)
  records = next
  notify()
  return cloneKnowledge(records[index])
}

export function removeKnowledgeRecord(id) {
  const next = records.filter((entry) => entry.id !== id)
  if (next.length === records.length) return false
  records = next
  notify()
  return true
}

export function findKnowledgeRecord(id) {
  const found = records.find((entry) => entry.id === id)
  return found ? cloneKnowledge(found) : undefined
}

/** Replace one company's records; leave every other company untouched. */
export function replaceCompanyRecords(companyId, companyRecords) {
  const scoped = String(companyId ?? '').trim()
  const others = records.filter((item) => item.companyId !== scoped)
  const incoming = (Array.isArray(companyRecords) ? companyRecords : []).map((item) =>
    makeKnowledgeItem({ ...item, companyId: scoped }),
  )
  records = [...others, ...incoming]
  notify()
  return cloneList(incoming)
}

if (records.length === 0) {
  seedKnowledgeRecords()
}
