/**
 * H16.13 Slice 13.2 — Map a calendar envelope onto createStudioActivity input.
 *
 * Pure. Does not persist, emit, look up H16.10 entities, or register sources.
 * Caller supplies an existing Native Activity subject. This mapper does not
 * derive subject from tenant companyId or calendar identity.
 * Native Activity remains canonical; calendar identity lives in attributes
 * and the repository idempotency key because Native Activity persistence
 * overwrites `source` with the activity record id.
 */

import { ValidationError } from '../../services/errors.js'
import { ACTIVITY_SUBJECT_TYPES } from '../activities/types.js'
import { NATIVE_ACTIVITY_LIMITS } from '../../persistence/activities/types.js'
import { stableHash } from '../activities/schema.js'
import { CALENDAR_ACTIVITY_KIND, CALENDAR_LIMITS } from './types.js'
import { makeInboundCalendarEvent } from './schema.js'

function asTrimmed(value) {
  return value == null ? '' : String(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

/**
 * Absent subject is ingest's uncorrelated path. Mapper requires a subject.
 *
 * @param {unknown} subject
 * @returns {boolean}
 */
export function isCalendarSubjectSupplied(subject) {
  if (subject == null || subject === '') return false
  if (typeof subject !== 'object' || Array.isArray(subject)) return true
  return Boolean(asTrimmed(subject.type) || asTrimmed(subject.id))
}

/**
 * Pass through type+id. Does not look up entities or rewrite ids.
 *
 * @param {unknown} subject
 * @returns {{ type: string, id: string }}
 */
function asSuppliedSubject(subject) {
  if (!isCalendarSubjectSupplied(subject)) {
    throw invalid('Native activity subject is required.', 'subject')
  }
  if (typeof subject !== 'object' || Array.isArray(subject)) {
    throw invalid('Native activity subject must be an object.', 'subject')
  }
  const type = asTrimmed(subject.type)
  const id = asTrimmed(subject.id)
  if (!ACTIVITY_SUBJECT_TYPES.includes(type)) {
    throw invalid('Native activity subject type is not recognized.', 'subject.type')
  }
  if (!id) {
    throw invalid('Native activity requires a subject id.', 'subject.id')
  }
  return Object.freeze({ type, id })
}

/**
 * Native idempotency is company-scoped and capped at 128 chars.
 * Prefer the Slice 13.1 calendar key; hash only when it cannot fit.
 *
 * @param {object} event
 * @returns {string}
 */
export function makeNativeCalendarIdempotencyKey(event) {
  const key = asTrimmed(event?.idempotencyKey)
  if (!key) {
    throw invalid('Calendar envelope requires idempotencyKey.', 'idempotencyKey')
  }
  if (key.length <= NATIVE_ACTIVITY_LIMITS.MAX_IDEMPOTENCY_KEY) return key
  return `cal:${stableHash(key)}`.slice(0, NATIVE_ACTIVITY_LIMITS.MAX_IDEMPOTENCY_KEY)
}

function makeParticipants(event) {
  const rows = []
  if (event.organizer) {
    rows.push({
      type: 'email',
      id: event.organizer.email,
      role: 'organizer',
    })
  }
  for (const row of event.attendees) {
    rows.push({
      type: 'email',
      id: row.email,
      role: 'attendee',
    })
  }
  return rows.slice(0, NATIVE_ACTIVITY_LIMITS.MAX_PARTICIPANTS)
}

function makeAttributes(event) {
  const attributes = {
    calendarId: event.calendarId,
    externalEventId: event.externalEventId,
  }
  if (event.timezone) attributes.timezone = event.timezone
  if (event.startsAt) attributes.startsAt = event.startsAt
  if (event.endsAt) attributes.endsAt = event.endsAt
  if (event.organizer?.email) attributes.organizerEmail = event.organizer.email
  if (event.content?.ref) attributes.bodyRef = event.content.ref
  return attributes
}

/**
 * @param {object} [input]
 * @param {{ type?: string, id?: string }} subject
 * @returns {object}
 */
export function mapCalendarEventToStudioActivityInput(input = {}, subject) {
  const event = makeInboundCalendarEvent(input)
  return Object.freeze({
    companyId: event.companyId,
    kind: CALENDAR_ACTIVITY_KIND,
    subject: asSuppliedSubject(subject),
    subjectLine: event.title.slice(0, CALENDAR_LIMITS.MAX_TITLE),
    body: event.content.text,
    occurredAt: event.occurredAt,
    participants: Object.freeze(makeParticipants(event)),
    attributes: Object.freeze(makeAttributes(event)),
    idempotencyKey: makeNativeCalendarIdempotencyKey(event),
  })
}
