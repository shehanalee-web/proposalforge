/**
 * H16.15 Slice 15.8 — Agent-origin archive facade.
 *
 * Soft-archives a persisted agent-origin Native Activity through the
 * existing ActivityRepository. Fail-closed on attribution and tenancy.
 * Does not emit, rewrite origin/actor/companyId, or use the USER
 * authoring facade. An agent is not a Studio Principal.
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

function assertStoredCompany(activity, scoped) {
  if (trim(activity?.companyId) !== scoped) {
    throw invalid('companyId does not match the requested workspace.', 'companyId')
  }
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
export async function archiveAgentOriginActivity(id, companyId) {
  const scoped = assertCompany(companyId)
  const key = assertActivityId(id)
  const existing = await getActivityRepository().get(key, scoped)
  assertStoredCompany(existing, scoped)
  assertAgentOriginActivity(existing)
  const archived = await getActivityRepository().archive(key, scoped)
  assertStoredCompany(archived, scoped)
  return assertAgentOriginActivity(archived)
}
