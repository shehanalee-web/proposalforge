/**
 * H16.7 — Studio audit log timeline source.
 *
 * Reads the legacy `activityEvents.json` rows, which use SQL-style snake_case
 * columns and carry no companyId. Rows are attributed to the default company
 * and the engine refuses to serve this source to any other tenant.
 *
 * `user_id` on these rows only ever holds 'studio', 'client', or 'system' — it
 * is an audience label, not a user reference, so no actor id is emitted.
 *
 * The row reader is injected so this source never imports node:fs and stays
 * testable against fixtures.
 */

import { DEFAULT_COMPANY_ID } from '../../../knowledge/types.js'
import { AUTOMATION_SOURCE_DOMAIN } from '../../events/types.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_AUDIENCE,
  ACTIVITY_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
  TIMELINE_LIMITS,
  TIMELINE_SOURCE_ID,
} from '../types.js'

const ACTOR_KIND_BY_USER_ID = Object.freeze({
  studio: ACTIVITY_ACTOR_KIND.USER,
  client: ACTIVITY_ACTOR_KIND.CLIENT,
  system: ACTIVITY_ACTOR_KIND.SYSTEM,
})

function withinWindow(value, since, until) {
  if (!value) return false
  if (since && value < since) return false
  if (until && value > until) return false
  return true
}

function toCandidate(row) {
  const proposalId = String(row?.proposal_id ?? row?.proposalId ?? '').trim()
  if (!proposalId) return null

  const eventType = String(row?.event_type ?? row?.eventType ?? '').trim()
  if (!eventType) return null

  const userId = String(row?.user_id ?? row?.userId ?? '').trim()
  const metadata = row?.metadata ?? {}

  return {
    sourceId: TIMELINE_SOURCE_ID.STUDIO_AUDIT,
    nativeId: String(row.id ?? '').trim(),
    companyId: DEFAULT_COMPANY_ID,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: proposalId },
    kind: ACTIVITY_KIND.SYSTEM_EVENT,
    type: `${AUTOMATION_SOURCE_DOMAIN.ACTIVITY}.${eventType}`,
    origin: ACTIVITY_ORIGIN.SYSTEM,
    // The studio audit log is internal by definition and never client-facing.
    audience: ACTIVITY_AUDIENCE.INTERNAL,
    occurredAtRaw: row.created_at ?? row.createdAt ?? null,
    recordedAtRaw: row.created_at ?? row.createdAt ?? null,
    actor: {
      id: null,
      kind: ACTOR_KIND_BY_USER_ID[userId] ?? ACTIVITY_ACTOR_KIND.SYSTEM,
      displayName: String(metadata.authorName ?? '').trim() || null,
    },
    subjectLine: String(row.event_title ?? row.eventTitle ?? eventType).trim(),
    body: String(metadata.description ?? metadata.detail ?? '').trim(),
    attributes: metadata,
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.ACTIVITY,
      entityType: 'activity_event',
      entityId: String(row.id ?? '').trim(),
      eventId: String(row.id ?? '').trim(),
    },
  }
}

/**
 * @param {{ read?: () => object[] }} [options]
 */
export function createStudioAuditTimelineSource(options = {}) {
  const read = typeof options.read === 'function' ? options.read : () => []

  return {
    id: TIMELINE_SOURCE_ID.STUDIO_AUDIT,
    canonicalFor: [AUTOMATION_SOURCE_DOMAIN.ACTIVITY],

    describe() {
      return {
        id: TIMELINE_SOURCE_ID.STUDIO_AUDIT,
        readOnly: true,
        storeRef: 'activityEvents.json',
      }
    },

    isEnabled() {
      return typeof options.read === 'function'
    },

    list(query = {}) {
      const companyId = String(query.companyId ?? '').trim()
      if (companyId !== DEFAULT_COMPANY_ID) return []

      const subjectId = String(query.subjectId ?? '').trim()
      const subjectType = String(query.subjectType ?? '').trim()
      const since = query.since ? String(query.since) : null
      const until = query.until ? String(query.until) : null

      const rows = read()
      const candidates = []

      for (const row of Array.isArray(rows) ? rows : []) {
        if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break

        const candidate = toCandidate(row)
        if (!candidate || !candidate.nativeId) continue

        if (subjectType && candidate.subject.type !== subjectType) continue
        if (subjectId && candidate.subject.id !== subjectId) continue
        if ((since || until) && !withinWindow(candidate.occurredAtRaw, since, until)) {
          continue
        }

        candidates.push(candidate)
      }

      return candidates
    },
  }
}
