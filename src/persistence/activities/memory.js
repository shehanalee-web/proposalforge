/**
 * H16.8 — In-process memory ActivityRepository (Slice 8.2).
 *
 * durable: false. Used by offline verify suites. Not a JSON file and not
 * production storage. Clone on every return via makeNativeActivity.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { TIMELINE_LIMITS } from '../../integrations/activities/types.js'
import { makeNativeActivity } from './schema.js'
import { ACTIVITY_REPOSITORY_ID, ACTIVITY_REPOSITORY_MODE } from './types.js'

const UPDATE_ALLOWLIST = Object.freeze([
  'subjectLine',
  'body',
  'attributes',
  'audience',
  'occurredAt',
])

/** @type {Map<string, object>} */
const records = new Map()

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function nowIso() {
  return new Date().toISOString()
}

function cloneOf(record) {
  return makeNativeActivity(record)
}

function requireCompanyId(companyId, field = 'companyId') {
  const scoped = String(companyId ?? '').trim()
  if (!scoped) {
    throw invalid('Activity persistence requires companyId.', field)
  }
  return scoped
}

function findById(id) {
  const key = String(id ?? '').trim()
  if (!key) return null
  return records.get(key) || null
}

function assertCompanyAccess(record, companyId) {
  const scoped = requireCompanyId(companyId)
  if (!record) {
    throw new NotFoundError('Activity not found.')
  }
  if (record.companyId !== scoped) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return scoped
}

function sameIdempotencyPayload(existing, next) {
  return (
    existing.kind === next.kind &&
    existing.type === next.type &&
    existing.subject.type === next.subject.type &&
    existing.subject.id === next.subject.id &&
    existing.subjectLine === next.subjectLine &&
    existing.body === next.body
  )
}

function findByIdempotency(companyId, key) {
  if (!key) return null
  for (const record of records.values()) {
    if (record.companyId === companyId && record.idempotencyKey === key) return record
  }
  return null
}

function compareNativeActivities(left, right) {
  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt < right.occurredAt ? 1 : -1
  }
  if (left.recordedAt !== right.recordedAt) {
    return left.recordedAt < right.recordedAt ? 1 : -1
  }
  if (left.id === right.id) return 0
  return left.id < right.id ? 1 : -1
}

function encodeCursor(entry) {
  if (!entry) return null
  const raw = JSON.stringify({ o: entry.occurredAt, r: entry.recordedAt, i: entry.id })
  return Buffer.from(raw, 'utf8').toString('base64url')
}

function decodeCursor(cursor) {
  const value = String(cursor ?? '').trim()
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed?.o || !parsed?.r || !parsed?.i) return null
    return { occurredAt: String(parsed.o), recordedAt: String(parsed.r), id: String(parsed.i) }
  } catch {
    return null
  }
}

function clampLimit(limit) {
  const value = Number(limit)
  if (!Number.isFinite(value) || value <= 0) return TIMELINE_LIMITS.DEFAULT_LIMIT
  return Math.min(Math.floor(value), TIMELINE_LIMITS.MAX_LIMIT)
}

function assertAllowedPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw invalid('Activity update patch must be an object.', 'patch')
  }
  for (const key of Object.keys(patch)) {
    if (!UPDATE_ALLOWLIST.includes(key)) {
      throw invalid('Activity update cannot change this field.', key)
    }
  }
}

function buildCreateInput(input, context) {
  const source = input && typeof input === 'object' ? input : {}
  const ctx = context && typeof context === 'object' ? context : {}
  const actor = source.actor && typeof source.actor === 'object' ? source.actor : {}
  return {
    ...source,
    companyId: ctx.companyId ?? source.companyId,
    actor: {
      ...actor,
      id: ctx.actorId ?? actor.id,
      kind: ctx.actorKind ?? actor.kind,
    },
  }
}

export function resetMemoryActivityRepository() {
  records.clear()
}

export function createMemoryActivityRepository() {
  return {
    id: ACTIVITY_REPOSITORY_ID.MEMORY,

    describe() {
      return {
        id: ACTIVITY_REPOSITORY_ID.MEMORY,
        durable: false,
        mode: ACTIVITY_REPOSITORY_MODE.MEMORY,
      }
    },

    async health() {
      return {
        ok: true,
        durable: false,
        migrated: null,
        message: 'In-process memory repository.',
      }
    },

    async create(input, context = {}) {
      const record = makeNativeActivity(buildCreateInput(input, context))
      if (record.idempotencyKey) {
        const existing = findByIdempotency(record.companyId, record.idempotencyKey)
        if (existing) {
          if (!sameIdempotencyPayload(existing, record)) {
            throw invalid('Idempotency key conflicts with an existing activity.', 'idempotencyKey')
          }
          return cloneOf(existing)
        }
      }
      if (records.has(record.id)) {
        throw invalid('Activity id already exists.', 'id')
      }
      records.set(record.id, record)
      return cloneOf(record)
    },

    async get(id, companyId) {
      const record = findById(id)
      assertCompanyAccess(record, companyId)
      return cloneOf(record)
    },

    async list(query = {}) {
      const companyId = requireCompanyId(query.companyId)
      const includeArchived = query.includeArchived === true
      const kinds = Array.isArray(query.kinds) ? query.kinds : null
      const origins = Array.isArray(query.origins) ? query.origins : null
      const subjectType = String(query.subjectType ?? '').trim()
      const subjectId = String(query.subjectId ?? '').trim()
      const audience = String(query.audience ?? '').trim()
      const since = String(query.since ?? '').trim()
      const until = String(query.until ?? '').trim()
      const limit = clampLimit(query.limit)

      let cursor = null
      if (query.cursor) {
        cursor = decodeCursor(query.cursor)
        if (!cursor) {
          throw invalid('Activity list cursor is invalid.', 'cursor')
        }
      }

      const filtered = [...records.values()].filter((record) => {
        if (record.companyId !== companyId) return false
        if (!includeArchived && record.archivedAt) return false
        if (subjectType && record.subject.type !== subjectType) return false
        if (subjectId && record.subject.id !== subjectId) return false
        if (kinds && !kinds.includes(record.kind)) return false
        if (origins && !origins.includes(record.origin)) return false
        if (audience && record.audience !== audience) return false
        if (since && record.occurredAt < since) return false
        if (until && record.occurredAt > until) return false
        if (cursor && compareNativeActivities(cursor, record) >= 0) return false
        return true
      })

      filtered.sort(compareNativeActivities)
      const page = filtered.slice(0, limit)
      const nextCursor = filtered.length > limit ? encodeCursor(page[page.length - 1]) : null
      return {
        entries: page.map(cloneOf),
        nextCursor,
      }
    },

    async update(id, patch, companyId) {
      const existing = findById(id)
      assertCompanyAccess(existing, companyId)
      if (existing.archivedAt) {
        throw invalid('Archived activities cannot be updated.', 'id')
      }
      assertAllowedPatch(patch)
      const next = makeNativeActivity({
        ...existing,
        ...patch,
        id: existing.id,
        companyId: existing.companyId,
        kind: existing.kind,
        origin: existing.origin,
        subject: existing.subject,
        idempotencyKey: existing.idempotencyKey,
        source: existing.source,
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
      })
      records.set(next.id, next)
      return cloneOf(next)
    },

    async archive(id, companyId) {
      const existing = findById(id)
      assertCompanyAccess(existing, companyId)
      if (existing.archivedAt) return cloneOf(existing)
      const next = makeNativeActivity({
        ...existing,
        archivedAt: nowIso(),
        updatedAt: nowIso(),
      })
      records.set(next.id, next)
      return cloneOf(next)
    },
  }
}
