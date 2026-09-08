import {
  cloneLivingEngagementEvent,
  makeLivingEngagementEvent,
} from './eventSchema.js'

let records = []
let persistHandler = null

function cloneList(list) {
  return list.map((item) => cloneLivingEngagementEvent(item))
}

export function configureLivingEventStore({ persist } = {}) {
  persistHandler = typeof persist === 'function' ? persist : null
}

function notify() {
  if (persistHandler) persistHandler(allLivingEngagementEvents())
}

export function allLivingEngagementEvents() {
  return cloneList(records)
}

export function replaceLivingEngagementEvents(next) {
  records = (Array.isArray(next) ? next : []).map((item) =>
    makeLivingEngagementEvent(item),
  )
  return allLivingEngagementEvents()
}

export function resetLivingEventStore(seed = []) {
  records = (Array.isArray(seed) ? seed : []).map((item) =>
    makeLivingEngagementEvent(item),
  )
  return allLivingEngagementEvents()
}

export function insertLivingEngagementEvent(item) {
  const record = makeLivingEngagementEvent(item)
  records = [...records, record]
  notify()
  return cloneLivingEngagementEvent(record)
}

export function listLivingEngagementEventsForProposal(proposalId, companyId = '') {
  const pid = String(proposalId ?? '').trim()
  const company = String(companyId ?? '').trim()
  return cloneList(
    records.filter((entry) => {
      if (entry.proposalId !== pid) return false
      if (company && entry.companyId !== company) return false
      return true
    }),
  ).sort((left, right) => String(right.at).localeCompare(String(left.at)))
}

export function listLivingEngagementEventsForShareToken(shareToken) {
  const token = String(shareToken ?? '').trim()
  return cloneList(records.filter((entry) => entry.shareToken === token)).sort(
    (left, right) => String(right.at).localeCompare(String(left.at)),
  )
}

export function findLivingEngagementEventById(eventId) {
  const id = String(eventId ?? '').trim()
  if (!id) return undefined
  const found = records.find((entry) => entry.id === id)
  return found ? cloneLivingEngagementEvent(found) : undefined
}
