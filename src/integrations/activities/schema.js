/**
 * H16.7 — TimelineEntry schema, deterministic identity, and projections.
 *
 * Entries are computed, never persisted. Identity must therefore be derived
 * from source coordinates rather than generated: a random id would change per
 * request and break both keyset pagination and UI keying.
 */

import { ValidationError } from '../../services/errors.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ACTOR_KINDS,
  ACTIVITY_AUDIENCE,
  ACTIVITY_AUDIENCES,
  ACTIVITY_KIND,
  ACTIVITY_KINDS,
  ACTIVITY_ORIGIN,
  ACTIVITY_ORIGINS,
  ACTIVITY_SCHEMA_VERSION,
  ACTIVITY_SUBJECT_TYPE,
  ACTIVITY_SUBJECT_TYPES,
  TIMELINE_ENTRY_ID_PREFIX,
  TIMELINE_LIMITS,
  TIMELINE_SOURCE_IDS,
  TIMELINE_SOURCE_PRIORITY,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asTrimmed(value) {
  return asString(value).trim()
}

function asOptionalId(value) {
  const id = asTrimmed(value)
  if (!id) return null
  return id.slice(0, TIMELINE_LIMITS.MAX_ID)
}

function asIso(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * Two independent 32-bit hashes combined to 64 bits. Kept dependency-free so
 * this module stays pure and portable. Identity here is a de-duplication key,
 * never a security boundary.
 */
function fnv1a32(input) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

function djb2(input) {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(hash, 33) + input.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

function stableHash(input) {
  const text = asString(input)
  return `${fnv1a32(text).toString(36)}${djb2(text).toString(36)}`
}

/**
 * Deterministic entry id. Stable across processes and requests for the same
 * source coordinates.
 *
 * @param {{ sourceId: string, nativeId: string, type: string }} input
 */
export function deriveTimelineEntryId({ sourceId, nativeId, type } = {}) {
  const source = asTrimmed(sourceId)
  const native = asTrimmed(nativeId)
  if (!source || !native) {
    throw new ValidationError('TimelineEntry identity requires source coordinates.', [
      { field: 'nativeId', message: 'sourceId and nativeId are required.' },
    ])
  }
  const digest = stableHash(`${source}|${native}|${asTrimmed(type)}`)
  return `${TIMELINE_ENTRY_ID_PREFIX}-${source}-${digest}`
}

function sanitizeAttributeValue(value) {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    return value.trim().slice(0, TIMELINE_LIMITS.MAX_ATTRIBUTE_VALUE)
  }
  return undefined
}

/**
 * Bounded attribute bag. Unknown-shaped values are dropped rather than
 * stringified so a nested domain document can never leak through.
 *
 * @param {unknown} input
 */
export function sanitizeTimelineAttributes(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({})
  }
  const next = {}
  let count = 0
  for (const [key, value] of Object.entries(input)) {
    if (count >= TIMELINE_LIMITS.MAX_ATTRIBUTE_KEYS) break
    const field = asTrimmed(key)
    if (!field) continue
    const lowered = field.toLowerCase()
    if (lowered.includes('secret')) continue
    if (lowered.includes('password')) continue
    if (lowered.includes('token')) continue
    if (lowered.includes('apikey')) continue
    const sanitized = sanitizeAttributeValue(value)
    if (sanitized === undefined) continue
    next[field] = sanitized
    count += 1
  }
  return Object.freeze(next)
}

/**
 * Resolve business time and ingestion time from a candidate.
 *
 * Returns null when the entry cannot be placed on a timeline at all. Callers
 * drop those and count them; inventing a timestamp would corrupt ordering.
 *
 * @param {{ occurredAtRaw?: unknown, recordedAtRaw?: unknown }} candidate
 */
export function resolveTimelineTimestamps(candidate = {}) {
  const occurred = asIso(candidate.occurredAtRaw)
  const recorded = asIso(candidate.recordedAtRaw)
  if (!occurred && !recorded) return null
  return {
    occurredAt: occurred || recorded,
    recordedAt: recorded || occurred,
  }
}

function coerceEnum(value, allowed, fallback) {
  const candidate = asTrimmed(value)
  return allowed.includes(candidate) ? candidate : fallback
}

/**
 * @param {object} [input]
 */
export function makeTimelineSubject(input = {}) {
  const type = coerceEnum(
    input.type,
    ACTIVITY_SUBJECT_TYPES,
    ACTIVITY_SUBJECT_TYPE.PROPOSAL,
  )
  const id = asOptionalId(input.id)
  if (!id) {
    throw new ValidationError('TimelineEntry requires a subject id.', [
      { field: 'subject.id', message: 'subject.id is required.' },
    ])
  }
  return Object.freeze({ type, id })
}

/**
 * @param {object} [input]
 */
export function makeTimelineSource(input = {}) {
  return Object.freeze({
    domain: asOptionalId(input.domain),
    entityType: asOptionalId(input.entityType),
    entityId: asOptionalId(input.entityId),
    eventId: asOptionalId(input.eventId),
  })
}

/**
 * @param {object} [input]
 */
export function makeTimelineActor(input = {}) {
  return Object.freeze({
    id: asOptionalId(input.id),
    kind: coerceEnum(input.kind, ACTIVITY_ACTOR_KINDS, ACTIVITY_ACTOR_KIND.SYSTEM),
    displayName: asTrimmed(input.displayName).slice(0, TIMELINE_LIMITS.MAX_ID) || null,
  })
}

/**
 * Normalize a projected candidate into a complete TimelineEntry.
 *
 * @param {object} [input]
 */
export function makeTimelineEntry(input = {}) {
  const companyId = asOptionalId(input.companyId)
  if (!companyId) {
    throw new ValidationError('TimelineEntry requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }

  const sourceId = asTrimmed(input.sourceId)
  if (!TIMELINE_SOURCE_IDS.includes(sourceId)) {
    throw new ValidationError('TimelineEntry requires a registered sourceId.', [
      { field: 'sourceId', message: 'sourceId is not a registered timeline source.' },
    ])
  }

  const type = asTrimmed(input.type)
  if (!type) {
    throw new ValidationError('TimelineEntry requires type.', [
      { field: 'type', message: 'type is required.' },
    ])
  }

  const timestamps =
    input.occurredAt || input.recordedAt
      ? resolveTimelineTimestamps({
          occurredAtRaw: input.occurredAt,
          recordedAtRaw: input.recordedAt,
        })
      : resolveTimelineTimestamps(input)

  if (!timestamps) {
    throw new ValidationError('TimelineEntry requires a placeable timestamp.', [
      { field: 'occurredAt', message: 'occurredAt or recordedAt is required.' },
    ])
  }

  const nativeId = asTrimmed(input.nativeId)
  const id = asTrimmed(input.id) || deriveTimelineEntryId({ sourceId, nativeId, type })

  return Object.freeze({
    id,
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : ACTIVITY_SCHEMA_VERSION,
    companyId,
    subject: makeTimelineSubject(input.subject ?? {}),
    kind: coerceEnum(input.kind, ACTIVITY_KINDS, ACTIVITY_KIND.SYSTEM_EVENT),
    type,
    origin: coerceEnum(input.origin, ACTIVITY_ORIGINS, ACTIVITY_ORIGIN.SYSTEM),
    audience: coerceEnum(
      input.audience,
      ACTIVITY_AUDIENCES,
      ACTIVITY_AUDIENCE.INTERNAL,
    ),
    occurredAt: timestamps.occurredAt,
    recordedAt: timestamps.recordedAt,
    actor: makeTimelineActor(input.actor ?? {}),
    subjectLine: asTrimmed(input.subjectLine).slice(0, TIMELINE_LIMITS.MAX_SUBJECT_LINE),
    body: asTrimmed(input.body).slice(0, TIMELINE_LIMITS.MAX_BODY),
    attributes: sanitizeTimelineAttributes(input.attributes),
    sourceId,
    nativeId: nativeId ? nativeId.slice(0, TIMELINE_LIMITS.MAX_ID) : null,
    priority:
      Number.isInteger(input.priority) && input.priority >= 0
        ? input.priority
        : (TIMELINE_SOURCE_PRIORITY[sourceId] ?? 0),
    source: makeTimelineSource(input.source ?? {}),
  })
}

export function cloneTimelineEntry(entry) {
  return makeTimelineEntry(entry ?? {})
}

/**
 * Studio projection retains provenance for diagnostics and support.
 *
 * @param {object | null | undefined} entry
 */
export function presentStudioTimelineEntry(entry) {
  if (!entry) return null
  const next = makeTimelineEntry(entry)
  return Object.freeze({
    id: next.id,
    schemaVersion: next.schemaVersion,
    companyId: next.companyId,
    subject: Object.freeze({ ...next.subject }),
    kind: next.kind,
    type: next.type,
    origin: next.origin,
    audience: next.audience,
    occurredAt: next.occurredAt,
    recordedAt: next.recordedAt,
    actor: Object.freeze({ ...next.actor }),
    subjectLine: next.subjectLine,
    body: next.body,
    attributes: Object.freeze({ ...next.attributes }),
    sourceId: next.sourceId,
    provenance: Object.freeze({ ...next.source }),
  })
}

/**
 * Client projection strips provenance, actor identity, and source coordinates.
 *
 * @param {object | null | undefined} entry
 */
export function presentClientTimelineEntry(entry) {
  if (!entry) return null
  const next = makeTimelineEntry(entry)
  return Object.freeze({
    id: next.id,
    schemaVersion: next.schemaVersion,
    subject: Object.freeze({ ...next.subject }),
    kind: next.kind,
    type: next.type,
    origin: next.origin,
    audience: next.audience,
    occurredAt: next.occurredAt,
    actor: Object.freeze({
      id: null,
      kind: next.actor.kind,
      displayName: next.actor.displayName,
    }),
    subjectLine: next.subjectLine,
    body: next.body,
    attributes: Object.freeze({ ...next.attributes }),
  })
}
