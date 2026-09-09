/**
 * H16.7 — Shared mapper for nested domain activity logs.
 *
 * Workflow, portal, and interaction records each carry an append-only
 * `activity[]` array of structurally identical events, so they share one
 * mapper rather than three near-copies. Each domain still registers as its own
 * TimelineSource with its own priority and canonical scope.
 *
 * Read-only. Never touches the parent record.
 */

import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_AUDIENCE,
  ACTIVITY_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
  TIMELINE_LIMITS,
} from '../types.js'

function withinWindow(value, since, until) {
  if (!value) return false
  if (since && value < since) return false
  if (until && value > until) return false
  return true
}

/**
 * @param {object} config
 * @param {string} config.sourceId
 * @param {string} config.domain
 * @param {string} config.storeRef
 * @param {() => object[]} config.listRecords
 * @param {(event: object) => boolean} [config.acceptEvent]
 */
export function createDomainActivityTimelineSource(config) {
  const { sourceId, domain, storeRef, listRecords, acceptEvent } = config

  function toCandidate(event, record) {
    const proposalId =
      String(event?.proposalId ?? '').trim() || String(record?.proposalId ?? '').trim()
    if (!proposalId) return null

    const type = String(event?.type ?? '').trim()
    if (!type) return null

    const actorId = String(event?.actorId ?? '').trim() || null

    return {
      sourceId,
      nativeId: event.id,
      companyId: record.companyId,
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: proposalId },
      kind: ACTIVITY_KIND.SYSTEM_EVENT,
      type: type.startsWith(`${domain}.`) ? type : `${domain}.${type}`,
      origin: ACTIVITY_ORIGIN.SYSTEM,
      audience: ACTIVITY_AUDIENCE.INTERNAL,
      occurredAtRaw: event.createdAt,
      recordedAtRaw: event.createdAt,
      actor: {
        id: actorId,
        kind: actorId ? ACTIVITY_ACTOR_KIND.USER : ACTIVITY_ACTOR_KIND.SYSTEM,
        displayName: String(event?.actorName ?? '').trim() || null,
      },
      subjectLine: type,
      body: '',
      attributes: {
        from: event.from ?? null,
        to: event.to ?? null,
      },
      source: {
        domain,
        entityType: domain,
        entityId: String(record?.id ?? '').trim() || null,
        eventId: event.id,
      },
    }
  }

  return {
    id: sourceId,
    canonicalFor: [domain],

    describe() {
      return { id: sourceId, readOnly: true, storeRef }
    },

    isEnabled() {
      return true
    },

    list(query = {}) {
      const companyId = String(query.companyId ?? '').trim()
      if (!companyId) return []

      const subjectId = String(query.subjectId ?? '').trim()
      const subjectType = String(query.subjectType ?? '').trim()
      const since = query.since ? String(query.since) : null
      const until = query.until ? String(query.until) : null

      const candidates = []

      for (const record of listRecords()) {
        if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break
        if (record?.companyId !== companyId) continue

        for (const event of Array.isArray(record.activity) ? record.activity : []) {
          if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break
          if (typeof acceptEvent === 'function' && !acceptEvent(event)) continue

          const candidate = toCandidate(event, record)
          if (!candidate) continue

          if (subjectType && candidate.subject.type !== subjectType) continue
          if (subjectId && candidate.subject.id !== subjectId) continue
          if ((since || until) && !withinWindow(candidate.occurredAtRaw, since, until)) {
            continue
          }

          candidates.push(candidate)
        }
      }

      return candidates
    },
  }
}
