/**
 * H16.7 — Candidate normalization.
 *
 * Turns raw source candidates into complete TimelineEntry records. Pure: reads
 * nothing, writes nothing, and never throws for a single bad candidate — a
 * malformed legacy row is dropped and counted rather than blanking a timeline.
 */

import {
  ACTIVITY_AUDIENCE,
  TIMELINE_DROP_REASON,
  TIMELINE_SOURCE_PRIORITY,
} from './types.js'
import { makeTimelineEntry, resolveTimelineTimestamps } from './schema.js'

function emptyDrops() {
  return {
    [TIMELINE_DROP_REASON.UNPLACEABLE]: 0,
    [TIMELINE_DROP_REASON.OUT_OF_COMPANY_SCOPE]: 0,
    [TIMELINE_DROP_REASON.UNSUPPORTED_SHAPE]: 0,
  }
}

/**
 * Normalize candidates for one company.
 *
 * @param {object[]} candidates
 * @param {{ companyId: string }} context
 * @returns {{ entries: object[], drops: Record<string, number> }}
 */
export function projectTimelineCandidates(candidates, context = {}) {
  const companyId = String(context.companyId ?? '').trim()
  const drops = emptyDrops()
  const entries = []

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!candidate || typeof candidate !== 'object') {
      drops[TIMELINE_DROP_REASON.UNSUPPORTED_SHAPE] += 1
      continue
    }

    // Defense in depth: a source should already scope, but never trust it to.
    const candidateCompany = String(candidate.companyId ?? '').trim()
    if (!candidateCompany || candidateCompany !== companyId) {
      drops[TIMELINE_DROP_REASON.OUT_OF_COMPANY_SCOPE] += 1
      continue
    }

    if (!resolveTimelineTimestamps(candidate)) {
      drops[TIMELINE_DROP_REASON.UNPLACEABLE] += 1
      continue
    }

    try {
      entries.push(
        makeTimelineEntry({
          ...candidate,
          priority:
            candidate.priority ?? TIMELINE_SOURCE_PRIORITY[candidate.sourceId] ?? 0,
        }),
      )
    } catch {
      drops[TIMELINE_DROP_REASON.UNSUPPORTED_SHAPE] += 1
    }
  }

  return { entries, drops }
}

/**
 * Audience filter. Runs after de-duplication so a discarded duplicate can never
 * resurrect a row the client should not see.
 *
 * @param {object[]} entries
 * @param {string} audience
 * @returns {{ entries: object[], dropped: number }}
 */
export function filterTimelineAudience(entries, audience) {
  const requested = String(audience ?? '').trim() || ACTIVITY_AUDIENCE.INTERNAL
  const list = Array.isArray(entries) ? entries : []

  if (requested !== ACTIVITY_AUDIENCE.CLIENT) {
    return { entries: [...list], dropped: 0 }
  }

  const kept = list.filter((entry) => entry.audience === ACTIVITY_AUDIENCE.CLIENT)
  return { entries: kept, dropped: list.length - kept.length }
}
