/**
 * H16.12 Slice 12.2 — Inbound mailbox → Native Activity write.
 *
 * Persists only when the caller supplies an existing Native Activity subject.
 * Uncorrelated mail is not ingested, not stored, and does not emit H16.11.
 * Writes go through createStudioActivity so repository idempotency and
 * H16.11 emission stay in charge. No mailbox store, TimelineSource, or HTTP.
 */

import { createStudioActivity } from '../activities/authoring.js'
import { makeInboundMailboxMessage } from './schema.js'
import {
  isMailboxSubjectSupplied,
  mapMailboxMessageToStudioActivityInput,
} from './map.js'
import { MAILBOX_INGEST_STATUS } from './types.js'

function makeMailboxIngestResult(activity) {
  if (activity) {
    return Object.freeze({
      ingested: true,
      status: MAILBOX_INGEST_STATUS.INGESTED,
      activity,
    })
  }
  return Object.freeze({
    ingested: false,
    status: MAILBOX_INGEST_STATUS.UNCORRELATED,
    activity: null,
  })
}

/**
 * Persist one inbound mailbox message as a native email Activity when a
 * real existing subject is supplied. Otherwise return uncorrelated.
 *
 * @param {object} [input]
 * @param {{ type?: string, id?: string } | null | undefined} [subject]
 * @returns {Promise<object>}
 */
export async function ingestInboundMailboxMessage(input = {}, subject) {
  makeInboundMailboxMessage(input)
  if (!isMailboxSubjectSupplied(subject)) {
    return makeMailboxIngestResult(null)
  }
  return makeMailboxIngestResult(
    await createStudioActivity(mapMailboxMessageToStudioActivityInput(input, subject)),
  )
}
