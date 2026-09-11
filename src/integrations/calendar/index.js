/**
 * H16.13 — Calendar source.
 *
 * Slice 13.1: vendor-neutral inbound event envelope.
 * Does not persist, ingest, poll, or authenticate. Native Activity remains
 * the write-side owner. No calendar store, HTTP, OAuth, or TimelineSource.
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
} from './types.js'

export {
  makeCalendarIdempotencyKey,
  makeInboundCalendarEvent,
  cloneInboundCalendarEvent,
} from './schema.js'
