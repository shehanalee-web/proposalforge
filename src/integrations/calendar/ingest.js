/**
 * H16.13 Slice 13.2 — Inbound calendar event → Native Activity write.
 *
 * Persists only when the caller supplies an existing Native Activity subject.
 * Uncorrelated events are not ingested, not stored, and do not emit H16.11.
 * Writes go through createStudioActivity so repository idempotency and
 * H16.11 emission stay in charge. No calendar store, TimelineSource, or HTTP.
 */

import { createStudioActivity } from '../activities/authoring.js'
import { makeInboundCalendarEvent } from './schema.js'
import {
  isCalendarSubjectSupplied,
  mapCalendarEventToStudioActivityInput,
} from './map.js'
import { CALENDAR_INGEST_STATUS } from './types.js'

function makeCalendarIngestResult(activity) {
  if (activity) {
    return Object.freeze({
      ingested: true,
      status: CALENDAR_INGEST_STATUS.INGESTED,
      activity,
    })
  }
  return Object.freeze({
    ingested: false,
    status: CALENDAR_INGEST_STATUS.UNCORRELATED,
    activity: null,
  })
}

/**
 * Persist one inbound calendar event as a native meeting Activity when a
 * real existing subject is supplied. Otherwise return uncorrelated.
 *
 * @param {object} [input]
 * @param {{ type?: string, id?: string } | null | undefined} [subject]
 * @returns {Promise<object>}
 */
export async function ingestInboundCalendarEvent(input = {}, subject) {
  makeInboundCalendarEvent(input)
  if (!isCalendarSubjectSupplied(subject)) {
    return makeCalendarIngestResult(null)
  }
  return makeCalendarIngestResult(
    await createStudioActivity(mapCalendarEventToStudioActivityInput(input, subject)),
  )
}
