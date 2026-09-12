/**
 * H16.9 — Studio Activity authoring facade (Slice 9.1).
 * H16.14 Slice 14.3 stamps a supplied Studio Principal as the activity actor.
 *
 * Thin write surface over the registered ActivityRepository. Company-scoped.
 * Derives type from kind. Forces public origin to user. Does not read HTTP
 * request state. Direct callers without a principal keep the authoring
 * fixture fallback. Does not check the authoring flag — HTTP does that in 9.4.
 * Does not register adapters or mutation routes.
 */

import { ForbiddenError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { makeStudioPrincipal } from '../identity/schema.js'
import { ACTIVITY_ACTOR_KIND, ACTIVITY_ORIGIN } from './types.js'
import { ACTIVITY_NATIVE_TYPE_BY_KIND } from '../../persistence/activities/types.js'
import { getActivityRepository } from '../../persistence/activities/port.js'
import { emitNativeActivityCreated } from './events.js'

/**
 * Fallback Native Activity actor for non-principal callers.
 * HTTP authoring passes a resolved Studio Principal instead.
 * Not an HTTP-supplied identity and not a second principal type.
 */
export const STUDIO_ACTIVITY_AUTHORING_ACTOR = Object.freeze({
  id: 'user-studio',
  kind: ACTIVITY_ACTOR_KIND.USER,
  displayName: 'Studio',
})

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function assertCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return String(companyId).trim()
}

function assertActivityId(id) {
  const key = String(id ?? '').trim()
  if (!key) {
    throw invalid('Activity id is required.', 'id')
  }
  return key
}

function deriveNativeType(kind) {
  const type = ACTIVITY_NATIVE_TYPE_BY_KIND[kind]
  if (!type) {
    throw invalid('Native activity kind is not persistable.', 'kind')
  }
  return type
}

function actorFromPrincipal(principal) {
  return Object.freeze({
    id: principal.id,
    kind: principal.kind,
    displayName: principal.displayName,
  })
}

function fallbackAuthoringPrincipal(companyId) {
  return makeStudioPrincipal({
    id: STUDIO_ACTIVITY_AUTHORING_ACTOR.id,
    kind: STUDIO_ACTIVITY_AUTHORING_ACTOR.kind,
    displayName: STUDIO_ACTIVITY_AUTHORING_ACTOR.displayName,
    companyId,
  })
}

/**
 * @param {object} [input]
 * @returns {Promise<object>}
 */
export async function createStudioActivity(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const {
    principal: suppliedPrincipal,
    actor: _payloadActor,
    origin: _payloadOrigin,
    actorId: _payloadActorId,
    ...rest
  } = source

  const principal = suppliedPrincipal
    ? makeStudioPrincipal(suppliedPrincipal)
    : null
  const companyId = assertCompany(rest.companyId ?? principal?.companyId)
  const resolved =
    principal && principal.companyId !== companyId
      ? null
      : principal ?? fallbackAuthoringPrincipal(companyId)
  if (!resolved) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }

  const kind = String(rest.kind ?? '').trim()
  const type = deriveNativeType(kind)
  const actor = actorFromPrincipal(resolved)
  const activity = await getActivityRepository().create(
    {
      ...rest,
      companyId,
      kind,
      type,
      origin: ACTIVITY_ORIGIN.USER,
      actor,
    },
    {
      companyId,
      actorId: actor.id,
      actorKind: actor.kind,
    },
  )
  emitNativeActivityCreated(activity)
  return activity
}

/**
 * @param {string} id
 * @param {string} companyId
 * @returns {Promise<object>}
 */
export async function getStudioActivity(id, companyId) {
  const scoped = assertCompany(companyId)
  return getActivityRepository().get(assertActivityId(id), scoped)
}

/**
 * @param {string} id
 * @param {object} [patch]
 * @param {string} companyId
 * @returns {Promise<object>}
 */
export async function updateStudioActivity(id, patch, companyId) {
  const scoped = assertCompany(companyId)
  return getActivityRepository().update(assertActivityId(id), patch, scoped)
}

/**
 * @param {string} id
 * @param {string} companyId
 * @returns {Promise<object>}
 */
export async function archiveStudioActivity(id, companyId) {
  const scoped = assertCompany(companyId)
  return getActivityRepository().archive(assertActivityId(id), scoped)
}
