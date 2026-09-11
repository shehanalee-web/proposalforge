/**
 * H16.7 — Automation ledger timeline source.
 *
 * Reads accepted H16.2 AutomationEvents. This is the canonical spine of the
 * timeline: the ledger form already carries H16.2's normalization and canonical
 * source policy, so it outranks every legacy store it was derived from.
 *
 * Read-only. Never records, replays, or re-emits an intake event.
 */

import { listAcceptedAutomationEventsForCompany } from '../../events/store.js'
import {
  AUTOMATION_INTAKE_SOURCE_DOMAINS,
  AUTOMATION_SOURCE_DOMAIN,
} from '../../events/types.js'
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
  const proposalId = event?.correlation?.proposalId
  if (!proposalId) return null

  const actorId = event?.correlation?.actorId ?? null

  return {
    sourceId: TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
    nativeId: event.id,
    companyId: event.companyId,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: proposalId },
    kind: ACTIVITY_KIND.SYSTEM_EVENT,
    type: event.type,
    origin: ACTIVITY_ORIGIN.SYSTEM,
    audience: ACTIVITY_AUDIENCE.INTERNAL,
    occurredAtRaw: event.occurredAt,
    recordedAtRaw: event.receivedAt,
    actor: {
      id: actorId,
      kind: actorId ? ACTIVITY_ACTOR_KIND.USER : ACTIVITY_ACTOR_KIND.SYSTEM,
      displayName: null,
    },
    subjectLine: event.type,
    body: '',
    attributes: event.payload,
    source: {
      domain: event.source?.domain ?? null,
      entityType: event.source?.entityType ?? null,
      entityId: event.source?.entityId ?? null,
      eventId: event.source?.eventId ?? null,
    },
  }
}

export function createAutomationLedgerTimelineSource() {
  return {
    id: TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
    canonicalFor: AUTOMATION_INTAKE_SOURCE_DOMAINS.filter(
      (domain) => domain !== AUTOMATION_SOURCE_DOMAIN.ACTIVITY,
    ),

    describe() {
      return {
        id: TIMELINE_SOURCE_ID.AUTOMATION_LEDGER,
        readOnly: true,
        storeRef: 'automation-intake.json',
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

      const events = listAcceptedAutomationEventsForCompany(companyId)
      const candidates = []

      for (const event of events) {
        if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break

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
