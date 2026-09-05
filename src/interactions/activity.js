import { makeInteractionEvent } from './schema.js'

export function appendInteractionActivity(record, input) {
  const event = makeInteractionEvent({
    interactionId: record.id,
    portalId: record.portalId,
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

export function getInteractionActivity(record) {
  return [...(record?.activity ?? [])].sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt)),
  )
}
