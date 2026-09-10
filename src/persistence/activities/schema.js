/**
 * H16.8 — Native Activity schema.
 *
 * Builds the write-side record. Projected shapes (system_event, origin system)
 * are rejected here so a later adapter cannot persist them by accident.
 * Mapping to snake_case SQL columns is Slice 8.4 — not this module.
 */

import { createRecordId } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ACTOR_KINDS,
  ACTIVITY_AUDIENCE,
  ACTIVITY_AUDIENCES,
  ACTIVITY_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPES,
  TIMELINE_LIMITS,
} from '../../integrations/activities/types.js'
import {
  sanitizeTimelineAttributes,
  resolveTimelineTimestamps,
} from '../../integrations/activities/schema.js'
import {
  ACTIVITY_NATIVE_ID_PREFIX,
  ACTIVITY_NATIVE_KINDS,
  ACTIVITY_NATIVE_ORIGINS,
  ACTIVITY_NATIVE_SOURCE_DOMAIN,
  ACTIVITY_NATIVE_SOURCE_ENTITY_TYPE,
  ACTIVITY_NATIVE_TYPE_BY_KIND,
  ACTIVITY_NATIVE_TYPES,
  NATIVE_ACTIVITY_ID_PATTERN,
  NATIVE_ACTIVITY_LIMITS,
  NATIVE_ACTIVITY_SCHEMA_VERSION,
} from './types.js'

const FORBIDDEN_RECORD_KEY =
  /^(password|token|apikey|apisecret|secret|accesstoken|refreshtoken|databaseurl|connectionstring|dsn)$/i

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

function asOptionalId(value) {
  const id = asTrimmed(value)
  if (!id) return null
  return id.slice(0, TIMELINE_LIMITS.MAX_ID)
}

function asIso(value, fallback = null) {
  if (value == null || value === '') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function assertNoSecretRecordFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of Object.keys(input)) {
    if (!FORBIDDEN_RECORD_KEY.test(key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid(
      'Raw secret values are forbidden on native activity records.',
      key,
    )
  }
}

function makeSubject(input = {}) {
  const type = asTrimmed(input.type)
  if (!ACTIVITY_SUBJECT_TYPES.includes(type)) {
    throw invalid('Native activity subject type is not recognized.', 'subject.type')
  }
  const id = asOptionalId(input.id)
  if (!id) {
    throw invalid('Native activity requires a subject id.', 'subject.id')
  }
  return Object.freeze({ type, id })
}

function makeActor(input = {}) {
  const kind = asTrimmed(input.kind) || ACTIVITY_ACTOR_KIND.USER
  if (!ACTIVITY_ACTOR_KINDS.includes(kind)) {
    throw invalid('Native activity actor kind is not recognized.', 'actor.kind')
  }
  if (kind === ACTIVITY_ACTOR_KIND.SYSTEM) {
    throw invalid('Projected activities cannot be persisted.', 'actor.kind')
  }
  return Object.freeze({
    id: asOptionalId(input.id),
    kind,
    displayName: asTrimmed(input.displayName).slice(0, TIMELINE_LIMITS.MAX_ID) || null,
  })
}

function makeParticipants(input) {
  if (input == null) return Object.freeze([])
  if (!Array.isArray(input)) {
    throw invalid('Native activity participants must be an array.', 'participants')
  }
  if (input.length > NATIVE_ACTIVITY_LIMITS.MAX_PARTICIPANTS) {
    throw invalid(
      `Native activity permits at most ${NATIVE_ACTIVITY_LIMITS.MAX_PARTICIPANTS} participants.`,
      'participants',
    )
  }
  return Object.freeze(
    input.map((row, index) => {
      const participant = row && typeof row === 'object' ? row : {}
      const type = asTrimmed(participant.type)
      const id = asOptionalId(participant.id)
      const role = asTrimmed(participant.role)
      if (!type || !id || !role) {
        throw invalid(
          'Each participant requires type, id, and role.',
          `participants.${index}`,
        )
      }
      return Object.freeze({ type, id, role })
    }),
  )
}

function makeNativeId(value) {
  const provided = asTrimmed(value)
  if (!provided) return createRecordId(ACTIVITY_NATIVE_ID_PREFIX)
  if (
    provided.length > TIMELINE_LIMITS.MAX_ID ||
    !NATIVE_ACTIVITY_ID_PATTERN.test(provided)
  ) {
    throw invalid('Native activity id is invalid.', 'id')
  }
  return provided
}

function makeIdempotencyKey(value) {
  if (value == null || value === '') return null
  const key = asTrimmed(value)
  if (!key) return null
  if (key.length > NATIVE_ACTIVITY_LIMITS.MAX_IDEMPOTENCY_KEY) {
    throw invalid('Idempotency key exceeds the bound.', 'idempotencyKey')
  }
  return key
}

function makeSource(id) {
  return Object.freeze({
    domain: ACTIVITY_NATIVE_SOURCE_DOMAIN,
    entityType: ACTIVITY_NATIVE_SOURCE_ENTITY_TYPE,
    entityId: id,
    eventId: id,
  })
}

/**
 * Normalize a native Activity record.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function makeNativeActivity(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Native activity must be an object.', 'activity')
  }
  assertNoSecretRecordFields(input)

  const companyId = asOptionalId(input.companyId)
  if (!companyId) {
    throw invalid('Native activity requires companyId.', 'companyId')
  }

  const origin = asTrimmed(input.origin)
  if (origin === ACTIVITY_ORIGIN.SYSTEM || origin === ACTIVITY_ORIGIN.INTEGRATION) {
    throw invalid('Projected activities cannot be persisted.', 'origin')
  }
  if (!ACTIVITY_NATIVE_ORIGINS.includes(origin)) {
    throw invalid('Native activity origin is not persistable.', 'origin')
  }

  const kind = asTrimmed(input.kind)
  if (kind === ACTIVITY_KIND.SYSTEM_EVENT || kind === 'task') {
    throw invalid('Projected activities cannot be persisted.', 'kind')
  }
  if (!ACTIVITY_NATIVE_KINDS.includes(kind)) {
    throw invalid('Native activity kind is not persistable.', 'kind')
  }

  const type = asTrimmed(input.type)
  if (!ACTIVITY_NATIVE_TYPES.includes(type) || ACTIVITY_NATIVE_TYPE_BY_KIND[kind] !== type) {
    throw invalid('Native activity type does not match kind.', 'type')
  }

  if (input.state != null && input.state !== '') {
    throw invalid('Native activity state is not used in H16.8.', 'state')
  }

  const timestamps = resolveTimelineTimestamps({
    occurredAtRaw: input.occurredAt,
    recordedAtRaw: input.recordedAt,
  })
  if (!timestamps) {
    throw invalid('Native activity requires a placeable timestamp.', 'occurredAt')
  }

  const id = makeNativeId(input.id)
  const createdAt = asIso(input.createdAt, nowIso())
  const updatedAt = asIso(input.updatedAt, createdAt)
  const archivedAt = asIso(input.archivedAt, null)

  return Object.freeze({
    id,
    companyId,
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : NATIVE_ACTIVITY_SCHEMA_VERSION,
    subject: makeSubject(input.subject ?? {}),
    origin,
    kind,
    type,
    audience: ACTIVITY_AUDIENCES.includes(asTrimmed(input.audience))
      ? asTrimmed(input.audience)
      : ACTIVITY_AUDIENCE.INTERNAL,
    occurredAt: timestamps.occurredAt,
    recordedAt: timestamps.recordedAt,
    actor: makeActor(input.actor ?? {}),
    subjectLine: asTrimmed(input.subjectLine).slice(0, TIMELINE_LIMITS.MAX_SUBJECT_LINE),
    body: asTrimmed(input.body).slice(0, TIMELINE_LIMITS.MAX_BODY),
    attributes: sanitizeTimelineAttributes(input.attributes),
    state: null,
    participants: makeParticipants(input.participants),
    source: makeSource(id),
    idempotencyKey: makeIdempotencyKey(input.idempotencyKey),
    createdAt,
    updatedAt,
    archivedAt,
  })
}

/**
 * @param {object} [activity]
 */
export function cloneNativeActivity(activity) {
  return makeNativeActivity(activity ?? {})
}
