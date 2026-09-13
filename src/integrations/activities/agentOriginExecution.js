/**
 * H16.15 Slice 15.3 — Agent-origin execution-boundary contract.
 *
 * Authorizes an already-approved agent-origin request for execution.
 * Company-scoped. Preserves origin AGENT and actor.kind AGENT. Does not
 * persist, emit, execute, or add HTTP. The USER authoring path is unchanged.
 * An agent is not a Studio Principal.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { makeAgentOriginActivityRequest } from './agentOrigin.js'
import {
  AGENT_ORIGIN_APPROVAL_STATUS,
  makeAgentOriginApproval,
} from './agentOriginApproval.js'
import { ACTIVITY_ACTOR_KIND, ACTIVITY_ORIGIN } from './types.js'

export const AGENT_ORIGIN_EXECUTION_SCHEMA_VERSION = 1

export const AGENT_ORIGIN_EXECUTION_STATUS = Object.freeze({
  AUTHORIZED: 'authorized',
})

function trim(value) {
  return value == null ? '' : String(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function assertTenantMatch(leftCompanyId, rightCompanyId) {
  const scoped = evaluateIntegrationCompanyScope(leftCompanyId, rightCompanyId)
  if (!scoped.ok) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function assertOriginalAgentRequest(input) {
  if (trim(input.origin) !== ACTIVITY_ORIGIN.AGENT) {
    throw invalid('origin must be agent.', 'origin')
  }
  const actor = input.actor && typeof input.actor === 'object' && !Array.isArray(input.actor) ? input.actor : {}
  if (trim(actor.kind) !== ACTIVITY_ACTOR_KIND.AGENT) {
    throw invalid('actor.kind must be agent.', 'kind')
  }
}

function requestsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * @param {object} [requestInput]
 * @param {object} [approvalInput]
 * @returns {{
 *   status: string,
 *   companyId: string,
 *   origin: string,
 *   actor: { id: string, kind: string, displayName: string | null },
 *   request: { origin: string, actor: object, companyId: string },
 *   approval: object,
 * }}
 */
export function authorizeAgentOriginExecution(requestInput, approvalInput) {
  if (!requestInput || typeof requestInput !== 'object' || Array.isArray(requestInput)) {
    throw invalid('request is required.', 'request')
  }
  if (!approvalInput || typeof approvalInput !== 'object' || Array.isArray(approvalInput)) {
    throw invalid('approval is required.', 'approval')
  }

  assertOriginalAgentRequest(requestInput)

  const request = makeAgentOriginActivityRequest(requestInput)
  const approval = makeAgentOriginApproval(approvalInput)

  assertTenantMatch(request.companyId, approval.companyId)
  assertTenantMatch(request.companyId, approval.request.companyId)

  if (!requestsMatch(request, approval.request)) {
    throw invalid('approval does not match the agent-origin request.', 'approval')
  }

  if (approval.status !== AGENT_ORIGIN_APPROVAL_STATUS.APPROVED) {
    throw invalid('approval must be approved before execution.', 'status')
  }

  return Object.freeze({
    status: AGENT_ORIGIN_EXECUTION_STATUS.AUTHORIZED,
    companyId: request.companyId,
    origin: ACTIVITY_ORIGIN.AGENT,
    actor: Object.freeze({
      id: request.actor.id,
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: request.actor.displayName,
    }),
    request,
    approval,
  })
}
