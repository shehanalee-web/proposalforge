import {
  cloneLivingPublication,
  makeLivingPublication,
} from './publicationSchema.js'
import { ValidationError } from '../services/errors.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneLivingPublication(item))
}

export function configureLivingPublicationStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allLivingPublications())
}

export function allLivingPublications() {
  return cloneList(records)
}

export function replaceLivingPublications(next) {
  records = (Array.isArray(next) ? next : []).map((item) =>
    makeLivingPublication(item),
  )
  return allLivingPublications()
}

export function resetLivingPublicationStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) =>
    makeLivingPublication(item),
  )
  return allLivingPublications()
}

/**
 * Append-only insert. Existing snapshot ids cannot be reused or overwritten.
 *
 * @param {object} item
 */
export function insertLivingPublication(item) {
  const record = makeLivingPublication(item)
  if (records.some((entry) => entry.id === record.id)) {
    throw new ValidationError('Snapshot id already exists and is immutable.', [
      { field: 'id', message: `Snapshot already exists: ${record.id}` },
    ])
  }
  records = [...records, record]
  notify()
  return cloneLivingPublication(record)
}

export function findLivingPublicationById(snapshotId) {
  const id = String(snapshotId ?? '').trim()
  const found = records.find((entry) => entry.id === id)
  return found ? cloneLivingPublication(found) : null
}

export function listLivingPublicationsForProposal(proposalId, companyId = '') {
  const pid = String(proposalId ?? '').trim()
  const company = String(companyId ?? '').trim()
  return cloneList(
    records.filter((entry) => {
      if (entry.proposalId !== pid) return false
      if (company && entry.companyId !== company) return false
      return true
    }),
  ).sort((left, right) => right.snapshotNumber - left.snapshotNumber)
}

/**
 * Current publication = highest snapshotNumber for the proposal.
 *
 * @param {string} proposalId
 * @param {string} [companyId]
 */
export function findCurrentLivingPublication(proposalId, companyId = '') {
  const list = listLivingPublicationsForProposal(proposalId, companyId)
  return list[0] ?? null
}
