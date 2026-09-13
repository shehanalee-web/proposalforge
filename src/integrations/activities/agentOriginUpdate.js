/**
 * H16.15 Slice 15.7 — Agent-origin update facade.
 *
 * Updates mutable Native Activity fields on a persisted agent-origin record
 * through the existing ActivityRepository. Fail-closed on attribution and
 * tenancy. Does not emit, rewrite origin/actor/companyId, or use the USER
 * authoring facade. An agent is not a Studio Principal.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { getActivityRepository } from '../../persistence/activities/port.js'
import { ACTIVITY_ACTOR_KIND, ACTIVITY_ORIGIN } from './types.js'

const MUTABLE_FIELDS = Object.freeze([
  'subjectLine',
  'body',
  'attributes',
  'audience',
  'occurredAt',
])

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
  const storedScope = evaluateIntegrationCompanyScope(activity?.companyId, scoped)
  if (!storedScope.ok) {
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

function assertMutablePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw invalid('Activity update patch must be an object.', 'patch')
  }
  for (const key of Object.keys(patch)) {
    if (!MUTABLE_FIELDS.includes(key)) {
      throw invalid('Activity update cannot change this field.', key)
    }
  }
  return patch
}

/**
 * @param {string} id
 * @param {string} companyId
 * @param {object} patch
 * @returns {Promise<object>}
 */
export async function updateAgentOriginActivity(id, companyId, patch) {
  const scoped = assertCompany(companyId)
  const key = assertActivityId(id)
  const source = assertMutablePatch(patch)
  const existing = await getActivityRepository().get(key, scoped)
  assertStoredCompany(existing, scoped)
  assertAgentOriginActivity(existing)
  const updated = await getActivityRepository().update(key, source, scoped)
  assertStoredCompany(updated, scoped)
  return assertAgentOriginActivity(updated)
}
