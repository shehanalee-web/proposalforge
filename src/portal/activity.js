import { makePortalEvent } from './schema.js'

export function appendPortalActivity(record, input) {
  const event = makePortalEvent({
    portalId: record.id,
    proposalId: record.proposalId,
    companyId: record.companyId,
    ...input,
  })
  return {
    record: {
      ...record,
      activity: [...(record.activity ?? []), event],
    },
    event,
  }
}

export function getPortalActivity(record) {
  return [...(record?.activity ?? [])].sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt)),
  )
}
