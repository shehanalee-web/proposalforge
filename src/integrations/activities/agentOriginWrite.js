/**
 * H16.15 Slice 15.5 — Agent-origin write facade.
 *
 * Persists an already-authorized, agent-attributed Native Activity through
 * the existing ActivityRepository and emits H16.11. Does not use the USER
 * authoring facade. An agent is not a Studio Principal.
 */

import { ValidationError } from '../../services/errors.js'
import { getActivityRepository } from '../../persistence/activities/port.js'
import { authorizeAgentOriginExecution } from './agentOriginExecution.js'
import { makeAgentOriginAttributedActivity } from './agentOriginAttribution.js'
import { emitNativeActivityCreated } from './events.js'

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

/**
 * @param {object} authorizedExecution
 * @param {object} [activityInput]
 * @returns {Promise<object>}
 */
export async function createAgentOriginActivity(authorizedExecution, activityInput = {}) {
  if (
    !authorizedExecution ||
    typeof authorizedExecution !== 'object' ||
    Array.isArray(authorizedExecution)
  ) {
    throw invalid('authorized execution is required.', 'execution')
  }

  const authorized = authorizeAgentOriginExecution(
    authorizedExecution.request,
    authorizedExecution.approval,
  )
  const writeShape = makeAgentOriginAttributedActivity(authorized, activityInput)
  const activity = await getActivityRepository().create(writeShape, {
    companyId: authorized.companyId,
    actorId: authorized.actor.id,
    actorKind: authorized.actor.kind,
  })
  emitNativeActivityCreated(activity)
  return activity
}
