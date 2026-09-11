/**
 * H16.13 — Calendar source.
 *
 * Slice 13.1: vendor-neutral inbound event envelope.
 * Slice 13.2: map envelope → createStudioActivity() only when the caller
 * supplies an existing Native Activity subject. Uncorrelated events are not ingested.
 * Native Activity remains the write-side owner. No calendar store, HTTP, or OAuth.
 */

export {
  CALENDAR_SCHEMA_VERSION,
  CALENDAR_SOURCE_ID,
  CALENDAR_SOURCE_DOMAIN,
  CALENDAR_SOURCE_ENTITY_TYPE,
  CALENDAR_ACTIVITY_KIND,
  CALENDAR_ACTIVITY_TYPE,
  CALENDAR_CONTENT_MEDIA_TYPE,
  CALENDAR_CONTENT_MEDIA_TYPES,
  CALENDAR_LIMITS,
  CALENDAR_FORBIDDEN_FIELDS,
  CALENDAR_FORBIDDEN_CONTENT_FIELDS,
  CALENDAR_INGEST_STATUS,
  CALENDAR_INGEST_STATUSES,
} from './types.js'

export {
  makeCalendarIdempotencyKey,
  makeInboundCalendarEvent,
  cloneInboundCalendarEvent,
} from './schema.js'

export {
  isCalendarSubjectSupplied,
  makeNativeCalendarIdempotencyKey,
  mapCalendarEventToStudioActivityInput,
} from './map.js'

export { ingestInboundCalendarEvent } from './ingest.js'
