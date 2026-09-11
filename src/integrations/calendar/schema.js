/**
 * H16.13 Slice 13.1 — Inbound calendar event envelope schema.
 *
 * Pure normalization. No store, no HTTP, no OAuth, no vendor SDK, no
 * ActivityRepository write, no entity resolution, no intake fan-out.
 */

import { EMAIL_PATTERN } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import { assertNoSecretValues } from '../schema.js'
import { stableHash } from '../activities/schema.js'
import {
  CALENDAR_ACTIVITY_KIND,
  CALENDAR_ACTIVITY_TYPE,
  CALENDAR_CONTENT_MEDIA_TYPE,
  CALENDAR_FORBIDDEN_CONTENT_FIELDS,
  CALENDAR_FORBIDDEN_FIELDS,
  CALENDAR_LIMITS,
  CALENDAR_SCHEMA_VERSION,
  CALENDAR_SOURCE_DOMAIN,
  CALENDAR_SOURCE_ENTITY_TYPE,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asTrimmed(value) {
  return asString(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function nowIso() {
  return new Date().toISOString()
}

function asRequiredId(value, field) {
  const id = asTrimmed(value).slice(0, CALENDAR_LIMITS.MAX_ID)
  if (!id) {
    throw invalid(`${field} is required.`, field)
  }
  return id
}

function asOptionalId(value, max = CALENDAR_LIMITS.MAX_ID) {
  const id = asTrimmed(value).slice(0, max)
  return id || null
}

function asIso(value) {
  if (value == null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function asRequiredIso(value, field) {
  const iso = asIso(value)
  if (!iso) {
    throw invalid(`Calendar envelope requires ${field}.`, field)
  }
  return iso
}

function asOptionalIso(value, field, fallback = null) {
  if (value == null || value === '') return fallback
  const iso = asIso(value)
  if (!iso) {
    throw invalid(`Calendar envelope requires a valid ${field}.`, field)
  }
  return iso
}

function assertNoForbiddenFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of CALENDAR_FORBIDDEN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid(
      'Calendar envelope cannot carry vendor, secret, ICS, or raw MIME fields.',
      key,
    )
  }
}

function makeAddress(input, field, required) {
  if (input == null || input === '') {
    if (required) throw invalid(`${field} is required.`, field)
    return null
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw invalid(`${field} must be an object.`, field)
  }
  const email = asTrimmed(input.email).slice(0, CALENDAR_LIMITS.MAX_EMAIL).toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw invalid(`${field} email is not valid.`, `${field}.email`)
  }
  const displayName =
    asTrimmed(input.displayName).slice(0, CALENDAR_LIMITS.MAX_NAME) || null
  return Object.freeze({ email, displayName })
}

function makeAttendees(input) {
  if (input == null) return Object.freeze([])
  if (!Array.isArray(input)) {
    throw invalid('attendees must be an array.', 'attendees')
  }
  if (input.length > CALENDAR_LIMITS.MAX_ATTENDEES) {
    throw invalid(
      `Calendar envelope permits at most ${CALENDAR_LIMITS.MAX_ATTENDEES} attendees.`,
      'attendees',
    )
  }
  return Object.freeze(
    input.map((row, index) => makeAddress(row, `attendees.${index}`, true)),
  )
}

function assertNoForbiddenContentFields(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of CALENDAR_FORBIDDEN_CONTENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid(
      'Calendar content cannot carry HTML, MIME, ICS, or vendor payload fields.',
      `${field}.${key}`,
    )
  }
}

function asBoundedText(value, field, max) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') {
    throw invalid(`${field} must be plain text.`, field)
  }
  const text = value.trim()
  if (text.length > max) {
    throw invalid(`${field} exceeds the ${max}-character bound.`, field)
  }
  return text
}

function asOptionalTimezone(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') {
    throw invalid('timezone must be a string.', 'timezone')
  }
  const timezone = value.trim()
  if (!timezone) return null
  if (timezone.length > CALENDAR_LIMITS.MAX_TIMEZONE) {
    throw invalid(
      `timezone exceeds the ${CALENDAR_LIMITS.MAX_TIMEZONE}-character bound.`,
      'timezone',
    )
  }
  return timezone
}

/**
 * Provider-neutral content: bounded text/plain plus an optional opaque ref.
 *
 * @param {object} input
 */
function makeContent(input) {
  const nested = input.content
  if (nested != null && (typeof nested !== 'object' || Array.isArray(nested))) {
    throw invalid('content must be an object.', 'content')
  }
  const source = nested && typeof nested === 'object' ? nested : {}
  assertNoSecretValues(source)
  assertNoForbiddenContentFields(source, 'content')

  const mediaType =
    asTrimmed(source.mediaType) || CALENDAR_CONTENT_MEDIA_TYPE.TEXT_PLAIN
  if (mediaType !== CALENDAR_CONTENT_MEDIA_TYPE.TEXT_PLAIN) {
    throw invalid('Calendar content mediaType must be text/plain.', 'content.mediaType')
  }

  if (input.description != null && typeof input.description !== 'string') {
    throw invalid('description must be plain text.', 'description')
  }
  if (input.body != null && typeof input.body !== 'string') {
    throw invalid('body must be plain text.', 'body')
  }

  const text = asBoundedText(
    source.text ?? input.description ?? input.body ?? input.text,
    nested?.text != null
      ? 'content.text'
      : input.description != null
        ? 'description'
        : input.text != null
          ? 'text'
          : 'body',
    CALENDAR_LIMITS.MAX_TEXT,
  )
  const snippet =
    asBoundedText(
      source.snippet ?? input.snippet,
      nested?.snippet != null ? 'content.snippet' : 'snippet',
      CALENDAR_LIMITS.MAX_SNIPPET,
    ) || text.slice(0, CALENDAR_LIMITS.MAX_SNIPPET)
  const ref = asOptionalId(
    source.ref ?? source.bodyRef ?? input.bodyRef,
    CALENDAR_LIMITS.MAX_BODY_REF,
  )

  return Object.freeze({
    mediaType: CALENDAR_CONTENT_MEDIA_TYPE.TEXT_PLAIN,
    text,
    snippet,
    ref,
  })
}

/**
 * Stable intake identity for a calendar event.
 * `companyId|calendar|<calendarId>|<externalEventId>`
 * Hashed when the composed key cannot fit the envelope bound.
 *
 * @param {object} input
 * @returns {string}
 */
export function makeCalendarIdempotencyKey(input = {}) {
  const companyId = asRequiredId(input.companyId, 'companyId')
  const calendarId = asRequiredId(input.calendarId, 'calendarId')
  const externalEventId = asRequiredId(input.externalEventId, 'externalEventId')
  const key = `${companyId}|calendar|${calendarId}|${externalEventId}`
  if (key.length <= CALENDAR_LIMITS.MAX_IDEMPOTENCY_KEY) return key
  return `cal:${stableHash(key)}`.slice(0, CALENDAR_LIMITS.MAX_IDEMPOTENCY_KEY)
}

/**
 * Normalize an inbound calendar event envelope.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function makeInboundCalendarEvent(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Calendar envelope must be an object.', 'event')
  }
  assertNoSecretValues(input)
  assertNoForbiddenFields(input)

  const companyId = asRequiredId(input.companyId, 'companyId')
  const calendarId = asRequiredId(input.calendarId, 'calendarId')
  const externalEventId = asRequiredId(input.externalEventId, 'externalEventId')
  const organizer = makeAddress(input.organizer, 'organizer', false)
  const attendees = makeAttendees(input.attendees)
  const title = asBoundedText(
    input.title ?? input.summary,
    input.title != null ? 'title' : 'summary',
    CALENDAR_LIMITS.MAX_TITLE,
  )
  const content = makeContent(input)
  const startsAt = asRequiredIso(input.startsAt, 'startsAt')
  const endsAt = input.endsAt == null || input.endsAt === '' ? null : asRequiredIso(input.endsAt, 'endsAt')
  if (endsAt && endsAt < startsAt) {
    throw invalid('endsAt must not precede startsAt.', 'endsAt')
  }
  const occurredAt = asOptionalIso(input.occurredAt, 'occurredAt', startsAt)
  const timezone = asOptionalTimezone(input.timezone)
  const recordedAt = asOptionalIso(input.recordedAt, 'recordedAt', nowIso())
  const derivedKey = makeCalendarIdempotencyKey({
    companyId,
    calendarId,
    externalEventId,
  })
  const providedKey = asTrimmed(input.idempotencyKey)
  if (providedKey && providedKey !== derivedKey) {
    throw invalid('Idempotency key must match calendar identity.', 'idempotencyKey')
  }

  return Object.freeze({
    companyId,
    calendarId,
    externalEventId,
    title,
    content,
    startsAt,
    endsAt,
    occurredAt,
    timezone,
    organizer,
    attendees,
    recordedAt,
    source: Object.freeze({
      domain: CALENDAR_SOURCE_DOMAIN,
      entityType: CALENDAR_SOURCE_ENTITY_TYPE,
      entityId: externalEventId,
      eventId: externalEventId,
    }),
    activityKind: CALENDAR_ACTIVITY_KIND,
    activityType: CALENDAR_ACTIVITY_TYPE,
    idempotencyKey: derivedKey,
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : CALENDAR_SCHEMA_VERSION,
  })
}

/**
 * @param {object} [event]
 * @returns {object}
 */
export function cloneInboundCalendarEvent(event) {
  return makeInboundCalendarEvent(event ?? {})
}
