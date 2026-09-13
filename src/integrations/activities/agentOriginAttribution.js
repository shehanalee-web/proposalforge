/**
 * H16.15 Slice 15.4 — Agent-origin attribution contract.
 *
 * Maps an already-authorized agent-origin execution plus Native Activity
 * fields onto a write shape that keeps origin AGENT and actor.kind AGENT.
 * Does not persist, emit, execute, or add HTTP. The USER authoring path is
 * unchanged. An agent is not a Studio Principal.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { ACTIVITY_NATIVE_TYPE_BY_KIND } from '../../persistence/activities/types.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { authorizeAgentOriginExecution } from './agentOriginExecution.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPES,
} from './types.js'

export const AGENT_ORIGIN_ATTRIBUTION_SCHEMA_VERSION = 1

const OPTIONAL_WRITE_FIELDS = Object.freeze([
  'subjectLine',
  'body',
  'occurredAt',
  'recordedAt',
  'audience',
  'attributes',
  'participants',
  'idempotencyKey',
])

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

function deriveNativeType(kind) {
  const type = ACTIVITY_NATIVE_TYPE_BY_KIND[kind]
  if (!type) {
    throw invalid('Native activity kind is not persistable.', 'kind')
  }
  return type
}

function asSubject(subject) {
  if (subject == null || subject === '') {
    throw invalid('Native activity subject is required.', 'subject')
  }
  if (typeof subject !== 'object' || Array.isArray(subject)) {
    throw invalid('Native activity subject must be an object.', 'subject')
  }
  const type = trim(subject.type)
  const id = trim(subject.id)
  if (!ACTIVITY_SUBJECT_TYPES.includes(type)) {
    throw invalid('Native activity subject type is not recognized.', 'subject.type')
  }
  if (!id) {
    throw invalid('Native activity requires a subject id.', 'subject.id')
  }
  return Object.freeze({ type, id })
}

function assertAttributionFromAuthorized(activityInput, authorized) {
  const suppliedOrigin = trim(activityInput.origin)
  if (suppliedOrigin && suppliedOrigin !== ACTIVITY_ORIGIN.AGENT) {
    throw invalid('origin must be agent.', 'origin')
  }

  if (activityInput.actor == null || activityInput.actor === '') return
  if (typeof activityInput.actor !== 'object' || Array.isArray(activityInput.actor)) {
    throw invalid('actor must be an object.', 'actor')
  }

  const suppliedKind = trim(activityInput.actor.kind)
  const suppliedId = trim(activityInput.actor.id)
  if (suppliedKind !== ACTIVITY_ACTOR_KIND.AGENT) {
    throw invalid('actor.kind must be agent.', 'kind')
  }
  if (!suppliedId) {
    throw invalid('actor.id is required.', 'actor.id')
  }
  if (suppliedId !== authorized.actor.id) {
    throw invalid('actor.id must match the authorized agent.', 'actor.id')
  }
}

function pickOptionalWriteFields(input) {
  const extras = {}
  for (const key of OPTIONAL_WRITE_FIELDS) {
    if (input[key] != null && input[key] !== '') extras[key] = input[key]
  }
  return extras
}

/**
 * @param {object} [authorizedExecution]
 * @param {object} [activityInput]
 * @returns {{
 *   origin: string,
 *   actor: { id: string, kind: string, displayName: string | null },
 *   companyId: string,
 *   kind: string,
 *   subject: { type: string, id: string },
 *   type: string,
 * }}
 */
export function makeAgentOriginAttributedActivity(authorizedExecution, activityInput = {}) {
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

  if (!activityInput || typeof activityInput !== 'object' || Array.isArray(activityInput)) {
    throw invalid('activity is required.', 'activity')
  }

  assertAttributionFromAuthorized(activityInput, authorized)

  if (trim(activityInput.companyId)) {
    assertTenantMatch(authorized.companyId, activityInput.companyId)
  }

  const kind = trim(activityInput.kind)
  const type = deriveNativeType(kind)
  const suppliedType = trim(activityInput.type)
  if (suppliedType && suppliedType !== type) {
    throw invalid('Native activity type does not match kind.', 'type')
  }

  return Object.freeze({
    origin: ACTIVITY_ORIGIN.AGENT,
    actor: Object.freeze({
      id: authorized.actor.id,
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: authorized.actor.displayName,
    }),
    companyId: authorized.companyId,
    kind,
    subject: asSubject(activityInput.subject),
    type,
    ...pickOptionalWriteFields(activityInput),
  })
}
