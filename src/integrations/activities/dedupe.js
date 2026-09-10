/**
 * H16.7 — Two-tier de-duplication.
 *
 * The same real-world fact can reach the timeline twice: once as a raw legacy
 * record and once as the H16.2 AutomationEvent normalized from it. Both tiers
 * collapse those pairs without erasing history the ledger never saw.
 *
 * Tier 1 — canonical source policy. Some facts are owned by a domain no matter
 * which store recorded them. Mirrors the H16.2 normalizer so the timeline and
 * the automation stack can never disagree about who owns an event.
 *
 * Tier 2 — identity de-duplication. The ledger records the originating event's
 * native id in source.eventId, which is exactly the nativeId the legacy source
 * emits. That gives an exact join rather than a heuristic one.
 *
 * Deliberately NOT done: dropping every legacy row whose domain the ledger
 * claims. Intake only began at H16.2, so a blanket domain drop would delete all
 * earlier history. Only rows with a demonstrable ledger twin are collapsed.
 *
 * Pure. Reads nothing, writes nothing.
 */

import { AUTOMATION_SOURCE_DOMAIN } from '../events/types.js'
import {
  TIMELINE_DROP_REASON,
  TIMELINE_LIVING_CANONICAL_INTERACTION_TYPES,
} from './types.js'

function emptyDrops() {
  return {
    [TIMELINE_DROP_REASON.CANONICAL_SOURCE_ELSEWHERE]: 0,
    [TIMELINE_DROP_REASON.DUPLICATE]: 0,
  }
}

/** Strip the domain namespace so `interaction.comment_added` compares as `comment_added`. */
function typeTail(type, domain) {
  const value = String(type ?? '').trim()
  const prefix = `${domain}.`
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

/**
 * Tier 1. Engagement mirrors are canonical on living, so the same fact arriving
 * through any other domain is discarded.
 */
function isCanonicalElsewhere(entry) {
  const domain = String(entry?.source?.domain ?? '').trim()
  if (!domain || domain === AUTOMATION_SOURCE_DOMAIN.LIVING) return false
  return TIMELINE_LIVING_CANONICAL_INTERACTION_TYPES.includes(
    typeTail(entry?.type, domain),
  )
}

/**
 * Exact join key. Present whenever the originating event carried a persisted id.
 */
function eventKey(entry) {
  const domain = String(entry?.source?.domain ?? '').trim()
  const eventId = String(entry?.source?.eventId ?? '').trim()
  if (!domain || !eventId) return null
  return `event|${entry.companyId}|${domain}|${eventId}`
}

/**
 * Fallback for rows the ledger stored without a native event id, where it fell
 * back to a synthetic `type:entityId` identity. Narrowed by type and instant so
 * it cannot collapse two genuinely distinct events on the same entity.
 */
function entityKey(entry) {
  const domain = String(entry?.source?.domain ?? '').trim()
  const entityId = String(entry?.source?.entityId ?? '').trim()
  if (!domain || !entityId) return null
  const tail = typeTail(entry?.type, domain)
  return `entity|${entry.companyId}|${domain}|${tail}|${entityId}|${entry.occurredAt}`
}

/**
 * Highest priority wins, ties broken by id so the survivor never depends on
 * source registration order or on which store happened to be read first.
 */
function comparePreference(left, right) {
  const leftPriority = Number(left?.priority ?? 0)
  const rightPriority = Number(right?.priority ?? 0)
  if (leftPriority !== rightPriority) return rightPriority - leftPriority
  if (left.id === right.id) return 0
  return left.id < right.id ? -1 : 1
}

/**
 * Collapse duplicate views of the same fact.
 *
 * @param {object[]} entries projected TimelineEntry records
 * @returns {{ entries: object[], drops: Record<string, number> }}
 */
export function dedupeTimelineEntries(entries) {
  const drops = emptyDrops()
  const list = Array.isArray(entries) ? entries : []

  const surviving = []
  for (const entry of list) {
    if (isCanonicalElsewhere(entry)) {
      drops[TIMELINE_DROP_REASON.CANONICAL_SOURCE_ELSEWHERE] += 1
      continue
    }
    surviving.push(entry)
  }

  const ranked = [...surviving].sort(comparePreference)
  const claimed = new Set()
  const kept = []

  for (const entry of ranked) {
    const exact = eventKey(entry)
    const fallback = entityKey(entry)

    // An entry with its own event id is only ever a duplicate of another entry
    // with the same event id. Matching it on the fallback key too would let a
    // ledger row swallow a sibling event that merely shares an entity and
    // instant.
    const lookup = exact ?? fallback

    if (lookup && claimed.has(lookup)) {
      drops[TIMELINE_DROP_REASON.DUPLICATE] += 1
      continue
    }

    if (exact) claimed.add(exact)
    if (fallback) claimed.add(fallback)
    kept.push(entry)
  }

  return { entries: kept, drops }
}
