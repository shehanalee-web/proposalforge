/**
 * H16.13 Slice 13.1 — Vendor-neutral inbound calendar event envelope.
 *
 * Represents a calendar event *before* it becomes a NativeActivity.
 * companyId is tenant/workspace identity, not a CRM Company entity.
 * Not a TimelineSource, not Google Calendar, not Microsoft Graph, not OAuth.
 * Later slices map this envelope onto kind=meeting / type=meeting.logged.
 */

import { ACTIVITY_KIND } from '../activities/types.js'
import { ACTIVITY_NATIVE_TYPE } from '../../persistence/activities/types.js'

export const CALENDAR_SCHEMA_VERSION = 1

/** Architectural source id. Must never be registered as a TimelineSource. */
export const CALENDAR_SOURCE_ID = 'inbound_calendar'

export const CALENDAR_SOURCE_DOMAIN = 'calendar'
export const CALENDAR_SOURCE_ENTITY_TYPE = 'calendar_event'

/** Locked native Activity mapping. Slice 13.1 does not persist. */
export const CALENDAR_ACTIVITY_KIND = ACTIVITY_KIND.MEETING
export const CALENDAR_ACTIVITY_TYPE = ACTIVITY_NATIVE_TYPE.MEETING_LOGGED

/**
 * Slice 13.2 ingest outcomes. Uncorrelated events are not a Native Activity
 * and are not stored. H16.13 does not invent a subject.
 */
export const CALENDAR_INGEST_STATUS = Object.freeze({
  INGESTED: 'ingested',
  UNCORRELATED: 'uncorrelated',
})

export const CALENDAR_INGEST_STATUSES = Object.freeze(
  Object.values(CALENDAR_INGEST_STATUS),
)

/**
 * Neutral content is always plain text plus an optional opaque reference.
 * HTML, MIME, ICS, and vendor payload types are not part of the envelope.
 */
export const CALENDAR_CONTENT_MEDIA_TYPE = Object.freeze({
  TEXT_PLAIN: 'text/plain',
})

export const CALENDAR_CONTENT_MEDIA_TYPES = Object.freeze(
  Object.values(CALENDAR_CONTENT_MEDIA_TYPE),
)

export const CALENDAR_LIMITS = Object.freeze({
  MAX_ID: 128,
  MAX_EMAIL: 200,
  MAX_NAME: 120,
  MAX_TITLE: 200,
  MAX_TEXT: 1000,
  MAX_SNIPPET: 200,
  MAX_BODY_REF: 256,
  MAX_TIMEZONE: 64,
  MAX_ATTENDEES: 16,
  MAX_IDEMPOTENCY_KEY: 256,
})

/**
 * Vendor, secret, entity-resolution, ICS, and raw MIME/HTML fields.
 * Presence of a non-empty value is a hard reject so the envelope cannot
 * smuggle Google/Graph payloads, Contact/Deal ids, or unbounded blobs.
 */
export const CALENDAR_FORBIDDEN_FIELDS = Object.freeze([
  'gmailId',
  'googleEventId',
  'googleCalendarId',
  'hangoutLink',
  'htmlLink',
  'conferenceData',
  'googleapis',
  'google',
  'googleEvent',
  'outlookId',
  'graphId',
  'graphEvent',
  'microsoft',
  'microsoftGraph',
  'webLink',
  'onlineMeeting',
  'iCalUID',
  'iCalUId',
  'icaluid',
  'provider',
  'providerPayload',
  'rawPayload',
  'oauth',
  'accessToken',
  'refreshToken',
  'apiKey',
  'clientSecret',
  'authorizationCode',
  'idToken',
  'html',
  'raw',
  'rawMime',
  'rawIcs',
  'ics',
  'ical',
  'iCalendar',
  'vevent',
  'rfc822',
  'mime',
  'contactId',
  'companyRefId',
  'dealId',
  'subjectType',
  'amount',
  'value',
  'price',
  'total',
  'currency',
])

/** Nested `content` keys that would reintroduce HTML/MIME/ICS/vendor payloads. */
export const CALENDAR_FORBIDDEN_CONTENT_FIELDS = Object.freeze([
  'html',
  'raw',
  'rawMime',
  'rawIcs',
  'ics',
  'ical',
  'mime',
  'vevent',
  'graphId',
  'googleEventId',
])
