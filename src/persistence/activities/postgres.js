/**
 * H16.8 — Postgres ActivityRepository (Slice 8.4).
 *
 * The only adapter that imports `pg`. Provider-agnostic protocol client.
 * snake_case SQL ↔ camelCase JS mapping lives here. Not a vendor SDK.
 * Boot registration is Slice 8.5.
 */

import pg from 'pg'
import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { TIMELINE_LIMITS } from '../../integrations/activities/types.js'
import {
  activityDatabaseSslOption,
  resolveActivityDatabasePoolMax,
  resolveActivityDatabaseUrl,
} from '../secrets.js'
import { makeNativeActivity } from './schema.js'
import { ACTIVITY_REPOSITORY_ID, ACTIVITY_REPOSITORY_MODE } from './types.js'

const UPDATE_ALLOWLIST = Object.freeze([
  'subjectLine',
  'body',
  'attributes',
  'audience',
  'occurredAt',
])

const REQUIRED_MIGRATION_ID = '0002_activities'
const UNIQUE_VIOLATION = '23505'

const INSERT_SQL = `
INSERT INTO activities (
  id, company_id, schema_version, subject_type, subject_id,
  origin, kind, type, audience, occurred_at, recorded_at,
  actor_id, actor_kind, actor_display_name, subject_line, body,
  attributes, state, participants, source_domain, source_entity_type,
  source_entity_id, source_event_id, idempotency_key, created_at, updated_at,
  archived_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
  $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
) RETURNING *
`

/** @type {import('pg').Pool | null} */
let pool = null
/** @type {Promise<void>} */
let ending = Promise.resolve()

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function redact(message) {
  return String(message ?? '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/(env|vault|secretref):[A-Za-z0-9_./:-]+/gi, '[ref]')
}

function unavailable(error) {
  const text = redact(error instanceof Error ? error.message : '')
  if (/postgres(?:ql)?:\/\//i.test(text)) {
    return new ForbiddenError('Activity persistence is not healthy.')
  }
  return new ForbiddenError(text || 'Activity persistence is not healthy.')
}

function nowIso() {
  return new Date().toISOString()
}

function asIso(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function requireCompanyId(companyId, field = 'companyId') {
  const scoped = String(companyId ?? '').trim()
  if (!scoped) {
    throw invalid('Activity persistence requires companyId.', field)
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

/**
 * @param {object} row
 */
export function rowToActivity(row) {
  return makeNativeActivity({
    id: row.id,
    companyId: row.company_id,
    schemaVersion: row.schema_version,
    subject: { type: row.subject_type, id: row.subject_id },
    origin: row.origin,
    kind: row.kind,
    type: row.type,
    audience: row.audience,
    occurredAt: asIso(row.occurred_at),
    recordedAt: asIso(row.recorded_at),
    actor: {
      id: row.actor_id,
      kind: row.actor_kind,
      displayName: row.actor_display_name,
    },
    subjectLine: row.subject_line,
    body: row.body,
    attributes: row.attributes,
    state: row.state,
    participants: row.participants,
    idempotencyKey: row.idempotency_key,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    archivedAt: asIso(row.archived_at),
  })
}

/**
 * @param {object} activity
 */
export function activityToRow(activity) {
  return Object.freeze({
    id: activity.id,
    company_id: activity.companyId,
    schema_version: activity.schemaVersion,
    subject_type: activity.subject.type,
    subject_id: activity.subject.id,
    origin: activity.origin,
    kind: activity.kind,
    type: activity.type,
    audience: activity.audience,
    occurred_at: activity.occurredAt,
    recorded_at: activity.recordedAt,
    actor_id: activity.actor.id,
    actor_kind: activity.actor.kind,
    actor_display_name: activity.actor.displayName,
    subject_line: activity.subjectLine,
    body: activity.body,
    attributes: activity.attributes,
    state: activity.state,
    participants: activity.participants,
    source_domain: activity.source.domain,
    source_entity_type: activity.source.entityType,
    source_entity_id: activity.source.entityId,
    source_event_id: activity.source.eventId,
    idempotency_key: activity.idempotencyKey,
    created_at: activity.createdAt,
    updated_at: activity.updatedAt,
    archived_at: activity.archivedAt,
  })
}

function insertValues(activity) {
  const row = activityToRow(activity)
  return [
    row.id,
    row.company_id,
    row.schema_version,
    row.subject_type,
    row.subject_id,
    row.origin,
    row.kind,
    row.type,
    row.audience,
    row.occurred_at,
    row.recorded_at,
    row.actor_id,
    row.actor_kind,
    row.actor_display_name,
    row.subject_line,
    row.body,
    row.attributes,
    row.state,
    row.participants,
    row.source_domain,
    row.source_entity_type,
    row.source_entity_id,
    row.source_event_id,
    row.idempotency_key,
    row.created_at,
    row.updated_at,
    row.archived_at,
  ]
}

function createPool() {
  const resolved = resolveActivityDatabaseUrl()
  if (!resolved.ok || !resolved.url) return null
  return new pg.Pool({
    connectionString: resolved.url,
    max: resolveActivityDatabasePoolMax(),
    idleTimeoutMillis: 10_000,
    ssl: activityDatabaseSslOption(resolved.url),
  })
}

async function requirePool() {
  await ending
  if (pool) return pool
  pool = createPool()
  return pool
}

async function query(text, params = []) {
  const current = await requirePool()
  if (!current) {
    throw new ForbiddenError('Activity persistence is not healthy.')
  }
  try {
    return await current.query(text, params)
  } catch (error) {
    if (error && error.code === UNIQUE_VIOLATION) throw error
    throw unavailable(error)
  }
}

export async function resetPostgresActivityRepository() {
  const current = pool
  pool = null
  if (!current) return
  ending = current.end().catch(() => {})
  await ending
}

export function createPostgresActivityRepository() {
  return {
    id: ACTIVITY_REPOSITORY_ID.POSTGRES,

    describe() {
      return {
        id: ACTIVITY_REPOSITORY_ID.POSTGRES,
        durable: true,
        mode: ACTIVITY_REPOSITORY_MODE.POSTGRES,
      }
    },

    async health() {
      const resolved = resolveActivityDatabaseUrl()
      if (!resolved.ok) {
        return {
          ok: false,
          durable: true,
          migrated: false,
          message: resolved.message,
        }
      }
      try {
        const current = await requirePool()
        if (!current) {
          return {
            ok: false,
            durable: true,
            migrated: false,
            message: 'Activity persistence is not healthy.',
          }
        }
        await current.query('SELECT 1')
        const migrated = await current.query('SELECT 1 FROM schema_migrations WHERE id = $1', [
          REQUIRED_MIGRATION_ID,
        ])
        const currentSchema = migrated.rowCount > 0
        return {
          ok: currentSchema,
          durable: true,
          migrated: currentSchema,
          message: currentSchema
            ? 'Postgres activity repository is healthy.'
            : 'Activity migrations are not current.',
        }
      } catch {
        return {
          ok: false,
          durable: true,
          migrated: false,
          message: 'Activity persistence is not healthy.',
        }
      }
    },

    async create(input, context = {}) {
      const record = makeNativeActivity(buildCreateInput(input, context))
      try {
        const result = await query(INSERT_SQL, insertValues(record))
        return rowToActivity(result.rows[0])
      } catch (error) {
        if (!error || error.code !== UNIQUE_VIOLATION) throw error
        if (record.idempotencyKey) {
          const existing = await findByIdempotency(record.companyId, record.idempotencyKey)
          if (existing) {
            if (!sameIdempotencyPayload(existing, record)) {
              throw invalid(
                'Idempotency key conflicts with an existing activity.',
                'idempotencyKey',
              )
            }
            return existing
          }
        }
        throw invalid('Activity id already exists.', 'id')
      }
    },

    async get(id, companyId) {
      const scoped = requireCompanyId(companyId)
      const key = String(id ?? '').trim()
      const result = await query('SELECT * FROM activities WHERE id = $1', [key])
      const row = result.rows[0]
      if (!row) throw new NotFoundError('Activity not found.')
      if (row.company_id !== scoped) {
        throw new ForbiddenError('You cannot access another company workspace.')
      }
      return rowToActivity(row)
    },

    async list(queryInput = {}) {
      const companyId = requireCompanyId(queryInput.companyId)
      const includeArchived = queryInput.includeArchived === true
      const kinds = Array.isArray(queryInput.kinds) ? queryInput.kinds : null
      const origins = Array.isArray(queryInput.origins) ? queryInput.origins : null
      const subjectType = String(queryInput.subjectType ?? '').trim()
      const subjectId = String(queryInput.subjectId ?? '').trim()
      const audience = String(queryInput.audience ?? '').trim()
      const since = String(queryInput.since ?? '').trim()
      const until = String(queryInput.until ?? '').trim()
      const limit = clampLimit(queryInput.limit)

      let cursor = null
      if (queryInput.cursor) {
        cursor = decodeCursor(queryInput.cursor)
        if (!cursor) {
          throw invalid('Activity list cursor is invalid.', 'cursor')
        }
      }

      const params = [companyId]
      let where = 'company_id = $1'
      if (!includeArchived) where += ' AND archived_at IS NULL'
      if (subjectType) {
        params.push(subjectType)
        where += ` AND subject_type = $${params.length}`
      }
      if (subjectId) {
        params.push(subjectId)
        where += ` AND subject_id = $${params.length}`
      }
      if (kinds) {
        params.push(kinds)
        where += ` AND kind = ANY($${params.length}::text[])`
      }
      if (origins) {
        params.push(origins)
        where += ` AND origin = ANY($${params.length}::text[])`
      }
      if (audience) {
        params.push(audience)
        where += ` AND audience = $${params.length}`
      }
      if (since) {
        params.push(since)
        where += ` AND occurred_at >= $${params.length}::timestamptz`
      }
      if (until) {
        params.push(until)
        where += ` AND occurred_at <= $${params.length}::timestamptz`
      }
      if (cursor) {
        params.push(cursor.occurredAt, cursor.recordedAt, cursor.id)
        const o = params.length - 2
        const r = params.length - 1
        const i = params.length
        where += ` AND (occurred_at, recorded_at, id) < ($${o}::timestamptz, $${r}::timestamptz, $${i})`
      }
      params.push(limit + 1)
      const result = await query(
        `SELECT * FROM activities WHERE ${where} ORDER BY occurred_at DESC, recorded_at DESC, id DESC LIMIT $${params.length}`,
        params,
      )
      const rows = result.rows
      const hasMore = rows.length > limit
      const page = hasMore ? rows.slice(0, limit) : rows
      const entries = page.map(rowToActivity)
      return {
        entries,
        nextCursor: hasMore ? encodeCursor(entries[entries.length - 1]) : null,
      }
    },

    async update(id, patch, companyId) {
      const existing = await this.get(id, companyId)
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
      const result = await query(
        `UPDATE activities
         SET subject_line = $1,
             body = $2,
             attributes = $3,
             audience = $4,
             occurred_at = $5,
             updated_at = $6
         WHERE id = $7 AND company_id = $8
         RETURNING *`,
        [
          next.subjectLine,
          next.body,
          next.attributes,
          next.audience,
          next.occurredAt,
          next.updatedAt,
          next.id,
          next.companyId,
        ],
      )
      if (!result.rows[0]) throw new NotFoundError('Activity not found.')
      return rowToActivity(result.rows[0])
    },

    async archive(id, companyId) {
      const existing = await this.get(id, companyId)
      if (existing.archivedAt) return existing
      const archivedAt = nowIso()
      const result = await query(
        `UPDATE activities
         SET archived_at = $1, updated_at = $2
         WHERE id = $3 AND company_id = $4
         RETURNING *`,
        [archivedAt, archivedAt, existing.id, existing.companyId],
      )
      if (!result.rows[0]) throw new NotFoundError('Activity not found.')
      return rowToActivity(result.rows[0])
    },
  }
}

async function findByIdempotency(companyId, key) {
  const result = await query(
    'SELECT * FROM activities WHERE company_id = $1 AND idempotency_key = $2',
    [companyId, key],
  )
  const row = result.rows[0]
  return row ? rowToActivity(row) : null
}
