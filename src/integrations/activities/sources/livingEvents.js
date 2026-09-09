/**
 * H16.7 — Living engagement timeline source.
 *
 * Covers living history that predates H16.2 intake. Bare living types are
 * prefixed to the `living.` form the ledger uses, so both paths speak one
 * vocabulary and de-duplication can match them.
 *
 * Read-only. Never emits, replays, or mutates a living event.
 */

import { allLivingEngagementEvents } from '../../../living/eventStore.js'
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

/**
 * @param {object} event
 */
function toCandidate(event) {
  if (!event?.proposalId) return null

  const type = String(event.type ?? '').trim()
  if (!type) return null

  return {
    sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    nativeId: event.id,
    companyId: event.companyId,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: event.proposalId },
    kind: ACTIVITY_KIND.SYSTEM_EVENT,
    type: type.startsWith(`${AUTOMATION_SOURCE_DOMAIN.LIVING}.`)
      ? type
      : `${AUTOMATION_SOURCE_DOMAIN.LIVING}.${type}`,
    origin: ACTIVITY_ORIGIN.SYSTEM,
    audience: ACTIVITY_AUDIENCE.INTERNAL,
    occurredAtRaw: event.at,
    recordedAtRaw: event.at,
    actor: { id: null, kind: ACTIVITY_ACTOR_KIND.CLIENT, displayName: null },
    subjectLine: type,
    body: '',
    attributes: {
      blockId: event.blockId ?? null,
      offerId: event.offerId ?? null,
      sessionId: event.sessionId ?? null,
    },
    source: {
      domain: AUTOMATION_SOURCE_DOMAIN.LIVING,
      entityType: AUTOMATION_SOURCE_DOMAIN.LIVING,
      entityId: event.id,
      eventId: event.id,
    },
  }
}

export function createLivingEventsTimelineSource() {
  return {
    id: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    canonicalFor: [AUTOMATION_SOURCE_DOMAIN.LIVING],

    describe() {
      return {
        id: TIMELINE_SOURCE_ID.LIVING_EVENTS,
        readOnly: true,
        storeRef: 'living-events.json',
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

      const candidates = []

      for (const event of allLivingEngagementEvents()) {
        if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break
        if (event?.companyId !== companyId) continue

        const candidate = toCandidate(event)
        if (!candidate) continue

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
