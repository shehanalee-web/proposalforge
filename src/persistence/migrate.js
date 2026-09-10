/**
 * H16.8 — Numbered SQL migration runner (Slice 8.3).
 *
 * Ops command only. Never import this module from the HTTP plugin.
 * Does not auto-migrate on request. Does not implement the Postgres
 * ActivityRepository (Slice 8.4).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  activityDatabaseSslOption,
  resolveActivityDatabaseUrl,
} from './secrets.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const ACTIVITY_SQL_DIR = join(__dirname, 'sql')

export const ACTIVITY_MIGRATE_EXIT = Object.freeze({
  OK: 0,
  FAILED: 1,
  NO_DSN: 2,
})

const MIGRATION_FILE = /^(\d{4}_[A-Za-z0-9_]+)\.sql$/

function redact(message) {
  return String(message ?? '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/(env|vault|secretref):[A-Za-z0-9_./:-]+/gi, '[ref]')
}

function safeMessage(message, fallback) {
  const text = redact(message)
  if (/postgres(?:ql)?:\/\//i.test(text)) return fallback
  return text || fallback
}

function fail(code, message) {
  return Object.freeze({
    ok: false,
    code,
    applied: Object.freeze([]),
    current: false,
    message: safeMessage(message, 'Activity migration failed.'),
  })
}

/**
 * @returns {{ id: string, filename: string, sql: string }[]}
 */
export function listActivityMigrationFiles() {
  const names = readdirSync(ACTIVITY_SQL_DIR)
    .filter((name) => MIGRATION_FILE.test(name))
    .sort()
  return names.map((filename) => {
    const id = filename.replace(/\.sql$/, '')
    return Object.freeze({
      id,
      filename,
      sql: readFileSync(join(ACTIVITY_SQL_DIR, filename), 'utf8'),
    })
  })
}

export function expectedActivityMigrationIds() {
  return Object.freeze(listActivityMigrationFiles().map((file) => file.id))
}

async function loadPgClient() {
  try {
    const mod = await import('pg')
    const pg = mod.default ?? mod
    if (typeof pg.Client !== 'function') return null
    return pg.Client
  } catch {
    return null
  }
}

async function listAppliedIds(client) {
  try {
    const result = await client.query('SELECT id FROM schema_migrations')
    return new Set(result.rows.map((row) => String(row.id)))
  } catch (error) {
    if (error && error.code === '42P01') return new Set()
    throw error
  }
}

/**
 * Apply pending numbered SQL files. Exit 2 when the DSN cannot be resolved.
 * Exit 0 when already current. Never dumps the DSN or env.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   code: number,
 *   applied: string[],
 *   current: boolean,
 *   message: string,
 * }>}
 */
export async function migrateActivities() {
  const resolved = resolveActivityDatabaseUrl()
  if (!resolved.ok || !resolved.url) {
    return fail(
      ACTIVITY_MIGRATE_EXIT.NO_DSN,
      resolved.message || 'Activity database URL is not configured.',
    )
  }

  const files = listActivityMigrationFiles()
  if (files.length === 0) {
    return fail(ACTIVITY_MIGRATE_EXIT.FAILED, 'No activity migration files were found.')
  }

  const Client = await loadPgClient()
  if (!Client) {
    return fail(
      ACTIVITY_MIGRATE_EXIT.FAILED,
      'PostgreSQL protocol client is unavailable.',
    )
  }

  const client = new Client({
    connectionString: resolved.url,
    ssl: activityDatabaseSslOption(resolved.url),
  })

  try {
    await client.connect()
    const appliedIds = await listAppliedIds(client)
    const pending = files.filter((file) => !appliedIds.has(file.id))
    const applied = []

    for (const file of pending) {
      await client.query('BEGIN')
      try {
        await client.query(file.sql)
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file.id])
        await client.query('COMMIT')
        applied.push(file.id)
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // ignore rollback failure; the original error is reported
        }
        throw error
      }
    }

    return Object.freeze({
      ok: true,
      code: ACTIVITY_MIGRATE_EXIT.OK,
      applied: Object.freeze(applied),
      current: true,
      message:
        applied.length === 0
          ? 'Activity migrations are current.'
          : 'Applied activity migrations.',
    })
  } catch (error) {
    return fail(
      ACTIVITY_MIGRATE_EXIT.FAILED,
      error instanceof Error ? error.message : 'Activity migration failed.',
    )
  } finally {
    try {
      await client.end()
    } catch {
      // ignore disconnect errors
    }
  }
}
