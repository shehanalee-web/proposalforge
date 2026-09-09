/**
 * H16.7 — Embedded proposal activity timeline source.
 *
 * Reads `proposal.activity[]` from proposals.json. This is the client-visible
 * timeline, so it is the only source that can emit client-audience entries;
 * visibility follows the existing internal-comment convention.
 *
 * Proposals carry no companyId, so rows are attributed to the default company
 * and the engine refuses to serve this source to any other tenant.
 *
 * The proposal reader is injected so this source never imports node:fs.
 */

import { DEFAULT_COMPANY_ID } from '../../../knowledge/types.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_AUDIENCE,
  ACTIVITY_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
  TIMELINE_LIMITS,
  TIMELINE_SOURCE_ID,
} from '../types.js'

/** Timeline-local namespace: proposal.activity is not an H16.2 source domain. */
const PROPOSAL_ACTIVITY_NAMESPACE = 'proposal'

const INTERNAL_VISIBILITY = 'internal'

function withinWindow(value, since, until) {
  if (!value) return false
  if (since && value < since) return false
  if (until && value > until) return false
  return true
}

function toCandidate(event, proposal) {
  const proposalId =
    String(event?.proposalId ?? '').trim() || String(proposal?.id ?? '').trim()
  if (!proposalId) return null

  const type = String(event?.type ?? '').trim()
  if (!type) return null

  const metadata = event?.metadata ?? event?.meta ?? {}
  const actor = String(event?.actor ?? '').trim()
  const visibility = String(metadata.visibility ?? '').trim()

  return {
    sourceId: TIMELINE_SOURCE_ID.PROPOSAL_ACTIVITY,
    nativeId: String(event.id ?? '').trim(),
    companyId: DEFAULT_COMPANY_ID,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: proposalId },
    kind: ACTIVITY_KIND.SYSTEM_EVENT,
    type: `${PROPOSAL_ACTIVITY_NAMESPACE}.${type}`,
    origin: ACTIVITY_ORIGIN.SYSTEM,
    audience:
      visibility === INTERNAL_VISIBILITY
        ? ACTIVITY_AUDIENCE.INTERNAL
        : ACTIVITY_AUDIENCE.CLIENT,
    occurredAtRaw: event.createdAt ?? event.at ?? null,
    recordedAtRaw: event.createdAt ?? event.at ?? null,
    actor: {
      id: null,
      kind:
        actor === ACTIVITY_ACTOR_KIND.CLIENT
          ? ACTIVITY_ACTOR_KIND.CLIENT
          : ACTIVITY_ACTOR_KIND.USER,
      displayName: null,
    },
    subjectLine: type,
    body: String(metadata.detail ?? event.detail ?? '').trim(),
    attributes: metadata,
    source: {
      domain: PROPOSAL_ACTIVITY_NAMESPACE,
      entityType: 'proposal_activity',
      entityId: proposalId,
      eventId: String(event.id ?? '').trim(),
    },
  }
}

/**
 * @param {{ read?: () => object[] }} [options]
 */
export function createProposalActivityTimelineSource(options = {}) {
  const read = typeof options.read === 'function' ? options.read : () => []

  return {
    id: TIMELINE_SOURCE_ID.PROPOSAL_ACTIVITY,
    canonicalFor: [],

    describe() {
      return {
        id: TIMELINE_SOURCE_ID.PROPOSAL_ACTIVITY,
        readOnly: true,
        storeRef: 'proposals.json',
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

      const proposals = read()
      const candidates = []

      for (const proposal of Array.isArray(proposals) ? proposals : []) {
        if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break
        if (subjectId && String(proposal?.id ?? '').trim() !== subjectId) continue

        for (const event of Array.isArray(proposal?.activity) ? proposal.activity : []) {
          if (candidates.length >= TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES) break

          const candidate = toCandidate(event, proposal)
          if (!candidate || !candidate.nativeId) continue

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
