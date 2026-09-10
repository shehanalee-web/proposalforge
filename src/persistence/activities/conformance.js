/**
 * H16.8 — ActivityRepository conformance (Slice 8.2).
 *
 * Shared cases for memory now and postgres in Slice 8.4. Not an HTTP surface.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { ACTIVITY_KIND, ACTIVITY_ORIGIN, ACTIVITY_SUBJECT_TYPE, TIMELINE_LIMITS } from '../../integrations/activities/types.js'
import {
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_REPOSITORY_IDS,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_NATIVE_ID_PREFIX,
} from './types.js'

async function threwAsync(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

function note(studio, overrides = {}) {
  return {
    companyId: studio,
    origin: ACTIVITY_ORIGIN.USER,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    type: ACTIVITY_NATIVE_TYPE.NOTE_CREATED,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h168-conformance' },
    occurredAt: '2026-09-10T12:00:00.000Z',
    actor: { id: 'user-1', kind: 'user' },
    subjectLine: 'Conformance note',
    body: 'Body',
    ...overrides,
  }
}

/**
 * @param {object} repo
 * @param {{ studio: string, other: string }} companies
 * @param {(name: string, condition: boolean, detail?: string) => void} assert
 */
export async function assertActivityRepositoryConformance(repo, { studio, other }, assert) {
  const descriptor = repo.describe()
  assert(
    'conformance.describe id and durable match mode',
    ACTIVITY_REPOSITORY_IDS.includes(descriptor.id) &&
      typeof descriptor.durable === 'boolean' &&
      (descriptor.mode === ACTIVITY_REPOSITORY_MODE.MEMORY
        ? descriptor.durable === false
        : descriptor.mode === ACTIVITY_REPOSITORY_MODE.POSTGRES
          ? descriptor.durable === true
          : descriptor.durable === false),
  )

  const created = await repo.create(note(studio), { companyId: studio })
  assert(
    'conformance.create note',
    created.id.startsWith(`${ACTIVITY_NATIVE_ID_PREFIX}-`) &&
      created.origin === ACTIVITY_ORIGIN.USER &&
      created.kind === ACTIVITY_NATIVE_KIND.NOTE &&
      created.state === null &&
      created.companyId === studio,
  )

  const fetched = await repo.get(created.id, studio)
  const cross = await threwAsync(() => repo.get(created.id, other))
  assert(
    'conformance.get same company',
    fetched.id === created.id && fetched.subjectLine === created.subjectLine,
  )
  assert(
    'conformance.get other company is ForbiddenError without leaks',
    cross instanceof ForbiddenError &&
      !String(cross.message).includes(created.id) &&
      !String(cross.message).includes(studio),
  )

  const missing = await threwAsync(() => repo.get('act-does-not-exist', studio))
  assert('conformance.get unknown is NotFoundError', missing instanceof NotFoundError)

  const otherPage = await repo.list({ companyId: other, limit: 50 })
  assert(
    'conformance.list is company-scoped',
    otherPage.entries.every((entry) => entry.companyId === other) &&
      !otherPage.entries.some((entry) => entry.id === created.id),
  )

  const t1 = await repo.create(
    note(studio, { occurredAt: '2026-09-10T15:00:00.000Z', subjectLine: 'Late' }),
  )
  const t2 = await repo.create(
    note(studio, { occurredAt: '2026-09-10T10:00:00.000Z', subjectLine: 'Early' }),
  )
  const t3 = await repo.create(
    note(studio, { occurredAt: '2026-09-10T13:00:00.000Z', subjectLine: 'Mid' }),
  )
  const ordered = await repo.list({ companyId: studio, limit: 200 })
  const ids = ordered.entries.map((entry) => entry.id)
  const lateIdx = ids.indexOf(t1.id)
  const midIdx = ids.indexOf(t3.id)
  const earlyIdx = ids.indexOf(t2.id)
  assert(
    'conformance.list order occurredAt DESC',
    lateIdx !== -1 && midIdx !== -1 && earlyIdx !== -1 && lateIdx < midIdx && midIdx < earlyIdx,
  )

  const first = await repo.list({ companyId: studio, limit: 2 })
  const second = await repo.list({ companyId: studio, limit: 2, cursor: first.nextCursor })
  const firstIds = new Set(first.entries.map((entry) => entry.id))
  assert(
    'conformance.keyset cursor does not overlap',
    first.nextCursor &&
      second.entries.length > 0 &&
      second.entries.every((entry) => !firstIds.has(entry.id)),
  )

  const archived = await repo.archive(created.id, studio)
  const hidden = await repo.list({ companyId: studio, limit: 200 })
  const shown = await repo.list({ companyId: studio, includeArchived: true, limit: 200 })
  assert(
    'conformance.archive hides from default list',
    archived.archivedAt &&
      !hidden.entries.some((entry) => entry.id === created.id) &&
      shown.entries.some((entry) => entry.id === created.id),
  )

  const live = await repo.create(note(studio, { subjectLine: 'Patchable' }))
  const blocked = await threwAsync(() =>
    repo.update(
      live.id,
      {
        companyId: other,
        kind: ACTIVITY_NATIVE_KIND.CALL,
        subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-hijack' },
      },
      studio,
    ),
  )
  const after = await repo.get(live.id, studio)
  assert(
    'conformance.update cannot change companyId, kind, or subject',
    blocked instanceof ValidationError &&
      after.companyId === studio &&
      after.kind === ACTIVITY_NATIVE_KIND.NOTE &&
      after.subject.id === 'prop-h168-conformance',
  )

  const projectedKind = await threwAsync(() =>
    repo.create({
      ...note(studio),
      kind: ACTIVITY_KIND.SYSTEM_EVENT,
      type: 'proposal.viewed',
    }),
  )
  const projectedOrigin = await threwAsync(() =>
    repo.create({ ...note(studio), origin: ACTIVITY_ORIGIN.SYSTEM }),
  )
  assert(
    'conformance.create rejects projected shapes',
    projectedKind instanceof ValidationError && projectedOrigin instanceof ValidationError,
  )

  const key = `idem-${Date.now()}`
  const firstIdem = await repo.create(note(studio, { idempotencyKey: key, subjectLine: 'Same' }))
  const secondIdem = await repo.create(note(studio, { idempotencyKey: key, subjectLine: 'Same' }))
  assert('conformance.duplicate idempotency returns same id', firstIdem.id === secondIdem.id)

  const conflict = await threwAsync(() =>
    repo.create(note(studio, { idempotencyKey: key, subjectLine: 'Different' })),
  )
  assert('conformance.conflicting idempotency throws', conflict instanceof ValidationError)

  const sanitized = await repo.create(
    note(studio, { attributes: { summary: 'ok', apiKey: 'secret', token: 'x' } }),
  )
  assert(
    'conformance.attributes drop credentials',
    sanitized.attributes.summary === 'ok' &&
      !('apiKey' in sanitized.attributes) &&
      !('token' in sanitized.attributes),
  )

  const longLine = 'S'.repeat(TIMELINE_LIMITS.MAX_SUBJECT_LINE + 40)
  const longBody = 'B'.repeat(TIMELINE_LIMITS.MAX_BODY + 40)
  const truncated = await repo.create(note(studio, { subjectLine: longLine, body: longBody }))
  assert(
    'conformance.subjectLine and body truncated',
    truncated.subjectLine.length === TIMELINE_LIMITS.MAX_SUBJECT_LINE &&
      truncated.body.length === TIMELINE_LIMITS.MAX_BODY,
  )

  const contact = await repo.create(
    note(studio, { subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' } }),
  )
  assert(
    'conformance.contact subject stores without resolution',
    contact.subject.type === ACTIVITY_SUBJECT_TYPE.CONTACT && contact.subject.id === 'contact-1',
  )

  const health = await repo.health()
  assert(
    'conformance.health message has no postgres URL',
    typeof health.message === 'string' && !health.message.includes('postgres://'),
  )

  const concurrent = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      repo.create(
        note(studio, {
          subjectLine: `Concurrent ${index}`,
          occurredAt: `2026-09-11T${String(index).padStart(2, '0')}:00:00.000Z`,
        }),
      ),
    ),
  )
  const concurrentIds = new Set(concurrent.map((entry) => entry.id))
  const listed = await repo.list({ companyId: studio, includeArchived: true, limit: 200 })
  assert(
    'conformance.concurrent creates persist',
    concurrentIds.size === 10 &&
      concurrent.every((entry) => listed.entries.some((row) => row.id === entry.id)),
  )
}
