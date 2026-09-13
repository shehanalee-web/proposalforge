/**
 * H16.15 Slice 15.6 — Agent-origin read facade.
 *
 * Reads persisted Native Activities from the existing ActivityRepository
 * only when they remain origin AGENT and actor.kind AGENT. Company-scoped.
 * Does not emit, rewrite attribution, or use the USER authoring facade.
 * An agent is not a Studio Principal.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { getActivityRepository } from '../../persistence/activities/port.js'
import { ACTIVITY_ACTOR_KIND, ACTIVITY_ORIGIN } from './types.js'

function trim(value) {
  return value == null ? '' : String(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function assertCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw invalid('companyId is required.', 'companyId')
  }
  return check.companyId
}

function assertActivityId(id) {
  const key = trim(id)
  if (!key) {
    throw invalid('Activity id is required.', 'id')
  }
  return key
}

function isAgentOriginActivity(activity) {
  return (
    activity &&
    activity.origin === ACTIVITY_ORIGIN.AGENT &&
    activity.actor &&
    activity.actor.kind === ACTIVITY_ACTOR_KIND.AGENT
  )
}

function assertAgentOriginActivity(activity) {
  if (!activity || activity.origin !== ACTIVITY_ORIGIN.AGENT) {
    throw invalid('origin must be agent.', 'origin')
  }
  const kind = activity.actor && typeof activity.actor === 'object' ? activity.actor.kind : ''
  if (kind !== ACTIVITY_ACTOR_KIND.AGENT) {
    throw invalid('actor.kind must be agent.', 'kind')
  }
  return activity
}

/**
 * @param {string} id
 * @param {string} companyId
 * @returns {Promise<object>}
 */
export async function getAgentOriginActivity(id, companyId) {
  const scoped = assertCompany(companyId)
  const activity = await getActivityRepository().get(assertActivityId(id), scoped)
  const storedScope = evaluateIntegrationCompanyScope(activity?.companyId, scoped)
  if (!storedScope.ok) {
    throw invalid('companyId does not match the requested workspace.', 'companyId')
  }
  return assertAgentOriginActivity(activity)
}

/**
 * @param {object} [query]
 * @returns {Promise<{ entries: object[], nextCursor: string | null }>}
 */
export async function listAgentOriginActivities(query = {}) {
  const source = query && typeof query === 'object' && !Array.isArray(query) ? query : {}
  const scoped = assertCompany(source.companyId)
  const page = await getActivityRepository().list({
    companyId: scoped,
    subjectType: source.subjectType,
    subjectId: source.subjectId,
    kinds: source.kinds,
    audience: source.audience,
    since: source.since,
    until: source.until,
    limit: source.limit,
    cursor: source.cursor,
    includeArchived: source.includeArchived,
    origins: [ACTIVITY_ORIGIN.AGENT],
  })
  const actorId = trim(source.actorId)
  const entries = (Array.isArray(page?.entries) ? page.entries : []).filter((row) => {
    if (!isAgentOriginActivity(row)) return false
    if (actorId && trim(row.actor?.id) !== actorId) return false
    return true
  })
  return {
    entries,
    nextCursor: page?.nextCursor ?? null,
  }
}
