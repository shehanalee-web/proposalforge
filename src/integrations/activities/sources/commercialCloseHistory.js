/**
 * H16.7 — Commercial close status history timeline source.
 *
 * Projects H15.6 close status transitions. Records are companyId-scoped, so no
 * default-company attribution is needed.
 *
 * Only the from/to status pair is projected. Amounts, currency, signature, and
 * payment/invoice detail stay inside H15.6 — the timeline says a close moved,
 * not what it was worth.
 */

import { allCommercialCloses } from '../../../commercialClose/store.js'
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

function withinWindow(value, since, until) {
  if (!value) return false
  if (since && value < since) return false
  if (until && value > until) return false
  return true
}

function toCandidate(entry, record) {
  const proposalId = String(record?.proposalId ?? '').trim()
  if (!proposalId) return null

  const actorId = String(entry?.actorId ?? '').trim()

  return {
    sourceId: TIMELINE_SOURCE_ID.COMMERCIAL_CLOSE_HISTORY,
    nativeId: String(entry?.id ?? '').trim(),
    companyId: String(record?.companyId ?? '').trim(),
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: proposalId },
    kind: ACTIVITY_KIND.SYSTEM_EVENT,
    type: `${AUTOMATION_SOURCE_DOMAIN.COMMERCIAL_CLOSE}.status_changed`,
    origin: ACTIVITY_ORIGIN.SYSTEM,
    audience: ACTIVITY_AUDIENCE.INTERNAL,
    occurredAtRaw: entry?.at ?? null,
    recordedAtRaw: entry?.at ?? null,
    actor: {
      id: actorId || null,
      kind: actorId ? ACTIVITY_ACTOR_KIND.USER : ACTIVITY_ACTOR_KIND.SYSTEM,
      displayName: null,
    },
    subjectLine: `Close ${entry?.from ?? 'none'} to ${entry?.to ?? 'none'}`,
    body: '',
    // Status only. Monetary and signature detail stays in H15.6.
    attributes: { from: entry?.from ?? null, to: entry?.to ?? null },
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.COMMERCIAL_CLOSE,
      entityType: 'commercial_close',
      entityId: String(record?.id ?? '').trim(),
      eventId: String(entry?.id ?? '').trim(),
    },
  }
}

export function createCommercialCloseHistoryTimelineSource() {
  return {
    id: TIMELINE_SOURCE_ID.COMMERCIAL_CLOSE_HISTORY,
    canonicalFor: [],

    describe() {
      return {
        id: TIMELINE_SOURCE_ID.COMMERCIAL_CLOSE_HISTORY,
        readOnly: true,
        storeRef: 'commercial-closes.json',
      }
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

      const records = allCommercialCloses()
      const candidates = []

      for (const record of Array.isArray(records) ? records : []) {
        if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break
        if (String(record?.companyId ?? '').trim() !== companyId) continue
        if (subjectId && String(record?.proposalId ?? '').trim() !== subjectId) continue

        const history = Array.isArray(record?.statusHistory) ? record.statusHistory : []
        for (const entry of history) {
          if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break

          const candidate = toCandidate(entry, record)
          if (!candidate || !candidate.nativeId) continue

          if (subjectType && candidate.subject.type !== subjectType) continue
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
