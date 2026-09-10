/**
 * H16.7 — Timeline engine.
 *
 * Orchestrates source selection, projection, ordering, and keyset pagination.
 * Reads only. A source that throws is isolated and reported as degraded so one
 * broken legacy store cannot blank the whole timeline.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { INTEGRATION_CAPABILITIES } from '../types.js'
import { allAutomationEvents } from '../events/store.js'
import {
  ACTIVITY_AUDIENCE,
  ACTIVITY_AUDIENCES,
  ACTIVITY_RESOLVABLE_SUBJECT_TYPES,
  ACTIVITY_SUBJECT_TYPE,
  TIMELINE_DROP_REASON,
  TIMELINE_LIMITS,
  TIMELINE_UNSCOPED_SOURCE_IDS,
} from './types.js'
import { filterTimelineAudience, projectTimelineCandidates } from './projection.js'
import { dedupeTimelineEntries } from './dedupe.js'
import { listRegisteredTimelineSources } from './sources/index.js'
import { isDurableActivityRepositoryHealthy } from '../../persistence/activities/index.js'

let capabilityOverride = null
let authoringOverride = null

/** Test seam mirroring the H16.6 CRM capability override. */
export function setActivityTimelineCapabilityOverrideForTests(value) {
  capabilityOverride = typeof value === 'boolean' ? value : null
}

export function clearActivityTimelineCapabilityOverrideForTests() {
  capabilityOverride = null
}

/**
 * Test seam for the authoring *flag*. The durable-health gate still applies:
 * override true + a non-durable adapter remains disabled.
 *
 * @param {boolean | null} value
 */
export function setActivityAuthoringCapabilityOverrideForTests(value) {
  authoringOverride = typeof value === 'boolean' ? value : null
}

export function clearActivityAuthoringCapabilityOverrideForTests() {
  authoringOverride = null
}

export function isActivityTimelineEnabled() {
  if (typeof capabilityOverride === 'boolean') return capabilityOverride
  return INTEGRATION_CAPABILITIES.activityTimeline === true
}

/**
 * Native authoring requires the capability flag AND a healthy durable
 * repository. Slice 8.1 registers none, so this stays structurally false
 * even if a test forces the flag.
 */
export function isActivityAuthoringEnabled() {
  const requested =
    typeof authoringOverride === 'boolean'
      ? authoringOverride
      : INTEGRATION_CAPABILITIES.activityAuthoring === true
  return requested === true && isDurableActivityRepositoryHealthy() === true
}

function clampLimit(limit) {
  const value = Number(limit)
  if (!Number.isFinite(value) || value <= 0) return TIMELINE_LIMITS.DEFAULT_LIMIT
  return Math.min(Math.floor(value), TIMELINE_LIMITS.MAX_LIMIT)
}

/**
 * Total deterministic order: business time, then ingestion time, then id.
 */
export function compareTimelineEntries(left, right) {
  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt < right.occurredAt ? 1 : -1
  }
  if (left.recordedAt !== right.recordedAt) {
    return left.recordedAt < right.recordedAt ? 1 : -1
  }
  if (left.id === right.id) return 0
  return left.id < right.id ? 1 : -1
}

export function encodeTimelineCursor(entry) {
  if (!entry) return null
  const raw = JSON.stringify({ o: entry.occurredAt, r: entry.recordedAt, i: entry.id })
  return Buffer.from(raw, 'utf8').toString('base64url')
}

export function decodeTimelineCursor(cursor) {
  const value = String(cursor ?? '').trim()
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed?.o || !parsed?.i) return null
    return { occurredAt: parsed.o, recordedAt: parsed.r ?? parsed.o, id: parsed.i }
  } catch {
    throw new ValidationError('Timeline cursor is not valid.', [
      { field: 'cursor', message: 'cursor is malformed.' },
    ])
  }
}

/**
 * Proposal existence lookup. The HTTP plugin injects a reader over
 * proposals.json; tests inject fixtures. The engine never reads the file
 * itself, so it stays free of node:fs.
 *
 * @typedef {{ id: string, companyId: string }} TimelineProposalRecord
 * @type {(proposalId: string) => TimelineProposalRecord | null}
 */
let proposalLookup = null

/**
 * @param {(proposalId: string) => object | null} lookup
 */
export function configureTimelineProposalLookup(lookup) {
  proposalLookup = typeof lookup === 'function' ? lookup : null
}

export function resetTimelineProposalLookup() {
  proposalLookup = null
}

function lookupProposalRecord(proposalId) {
  const id = String(proposalId ?? '').trim()
  if (!id || typeof proposalLookup !== 'function') return null
  const record = proposalLookup(id)
  if (!record || typeof record !== 'object') return null
  const foundId = String(record.id ?? id).trim()
  if (foundId !== id) return null
  return {
    id,
    companyId: String(record.companyId ?? '').trim() || DEFAULT_COMPANY_ID,
  }
}

/**
 * Companies a subject is known to from the H16.2 ledger.
 *
 * Secondary to proposals.json: a proposal that never reached intake can still
 * exist as a legacy row. Ledger membership is kept so a company-scoped
 * proposal that is not in the unscoped file can still 403 rather than 404.
 */
function subjectCompaniesFromLedger(subjectType, subjectId) {
  if (subjectType !== ACTIVITY_SUBJECT_TYPE.PROPOSAL) return new Set()
  const companies = new Set()
  for (const event of allAutomationEvents()) {
    if (event?.correlation?.proposalId === subjectId) {
      companies.add(event.companyId)
    }
  }
  return companies
}

/**
 * Authorize a proposal subject before any audience filter.
 *
 * Existence comes from the proposal record first, then the ledger. Unknown
 * ids 404. A known proposal owned by another company 403s. A known proposal
 * with no remaining events after later filters is a 200 empty page, not 404.
 *
 * @param {string} companyId
 * @param {{ type: string | null, id: string | null }} subject
 */
function assertProposalAccess(companyId, subject) {
  if (!subject?.id || subject.type !== ACTIVITY_SUBJECT_TYPE.PROPOSAL) return

  const record = lookupProposalRecord(subject.id)
  const ledgerCompanies = subjectCompaniesFromLedger(subject.type, subject.id)
  const owners = new Set(ledgerCompanies)
  if (record) owners.add(record.companyId)

  if (!record && ledgerCompanies.size === 0) {
    throw new NotFoundError('Timeline subject not found.')
  }
  if (!owners.has(companyId)) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function assertSubject(subjectType, subjectId) {
  const type = String(subjectType ?? '').trim()
  const id = String(subjectId ?? '').trim()

  if (!type && !id) return { type: null, id: null }

  if (!ACTIVITY_RESOLVABLE_SUBJECT_TYPES.includes(type || ACTIVITY_SUBJECT_TYPE.PROPOSAL)) {
    throw new ValidationError('Subject type is not resolvable in H16.7.', [
      { field: 'subjectType', message: `subjectType ${type} is not resolvable yet.` },
    ])
  }

  if (!id) {
    throw new ValidationError('Subject id is required when subjectType is set.', [
      { field: 'subjectId', message: 'subjectId is required.' },
    ])
  }

  return { type: type || ACTIVITY_SUBJECT_TYPE.PROPOSAL, id }
}

/**
 * Sources permitted for this company.
 *
 * Unscoped legacy stores carry no companyId and are attributed to the default
 * company. Any other tenant must not see them, or pre-tenant history leaks.
 */
function selectSources(companyId) {
  return listRegisteredTimelineSources().filter((entry) => {
    if (
      TIMELINE_UNSCOPED_SOURCE_IDS.includes(entry.id) &&
      companyId !== DEFAULT_COMPANY_ID
    ) {
      return false
    }
    try {
      return entry.source.isEnabled({ companyId }) === true
    } catch {
      return false
    }
  })
}

/**
 * Build a page of the timeline.
 *
 * @param {object} query
 * @returns {{ entries: object[], nextCursor: string | null, diagnostics: object }}
 */
export function buildTimeline(query = {}) {
  if (!isActivityTimelineEnabled()) {
    throw new ForbiddenError('Activity timeline is not enabled.')
  }

  const companyId = String(query.companyId ?? '').trim()
  if (!companyId) {
    throw new ValidationError('Timeline requires companyId.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }

  const subject = assertSubject(query.subjectType, query.subjectId)
  assertProposalAccess(companyId, subject)
  const audience = ACTIVITY_AUDIENCES.includes(query.audience)
    ? query.audience
    : ACTIVITY_AUDIENCE.INTERNAL
  const limit = clampLimit(query.limit)
  const cursor = decodeTimelineCursor(query.cursor)

  const sources = selectSources(companyId)
  const degraded = []
  const candidates = []

  for (const entry of sources) {
    try {
      const produced = entry.source.list({
        companyId,
        subjectType: subject.type,
        subjectId: subject.id,
        since: query.since ?? null,
        until: query.until ?? null,
        limit: TIMELINE_LIMITS.MAX_SOURCE_CANDIDATES,
      })
      for (const candidate of Array.isArray(produced) ? produced : []) {
        candidates.push({ ...candidate, sourceId: entry.id, priority: entry.priority })
      }
    } catch {
      degraded.push(entry.id)
    }
  }

  const projected = projectTimelineCandidates(candidates, { companyId })

  // Runs before the audience filter so a duplicate can never be the row that
  // survives for the client while its canonical twin is discarded.
  const deduped =
    typeof query.dedupe === 'function'
      ? query.dedupe(projected.entries)
      : dedupeTimelineEntries(projected.entries)

  const audienceFiltered = filterTimelineAudience(deduped.entries, audience)

  let ordered = [...audienceFiltered.entries].sort(compareTimelineEntries)

  if (subject.id) {
    ordered = ordered.filter(
      (item) => item.subject.type === subject.type && item.subject.id === subject.id,
    )
  }

  if (Array.isArray(query.kinds) && query.kinds.length) {
    ordered = ordered.filter((item) => query.kinds.includes(item.kind))
  }

  if (Array.isArray(query.origins) && query.origins.length) {
    ordered = ordered.filter((item) => query.origins.includes(item.origin))
  }

  const afterCursor = cursor
    ? ordered.filter((item) => compareTimelineEntries(cursor, item) < 0)
    : ordered

  const page = afterCursor.slice(0, limit)
  const nextCursor =
    afterCursor.length > limit ? encodeTimelineCursor(page[page.length - 1]) : null

  return {
    entries: page,
    nextCursor,
    diagnostics: Object.freeze({
      sourcesQueried: sources.length,
      sourcesDegraded: Object.freeze([...degraded]),
      candidates: candidates.length,
      matched: ordered.length,
      drops: Object.freeze({
        ...projected.drops,
        ...(deduped.drops ?? {}),
        [TIMELINE_DROP_REASON.AUDIENCE_FILTERED]: audienceFiltered.dropped,
      }),
    }),
  }
}
