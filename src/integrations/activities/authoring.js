/**
 * H16.9 — Studio Activity authoring facade (Slice 9.1).
 *
 * Thin write surface over the registered ActivityRepository. Company-scoped.
 * Derives type from kind. Forces public origin to user. Uses a fixture actor
 * until H16.14. Does not check the authoring flag — HTTP does that in 9.4.
 * Does not register adapters or mutation routes.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { ACTIVITY_ACTOR_KIND, ACTIVITY_ORIGIN } from './types.js'
import { ACTIVITY_NATIVE_TYPE_BY_KIND } from '../../persistence/activities/types.js'
import { getActivityRepository } from '../../persistence/activities/port.js'

/** Fixture actor until real auth exists. Not an HTTP-supplied identity. */
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

/**
 * @param {object} [input]
 * @returns {Promise<object>}
 */
export async function createStudioActivity(input = {}) {
  const companyId = assertCompany(input.companyId)
  const kind = String(input.kind ?? '').trim()
  const type = deriveNativeType(kind)
  return getActivityRepository().create(
    {
      ...input,
      companyId,
      kind,
      type,
      origin: ACTIVITY_ORIGIN.USER,
      actor: STUDIO_ACTIVITY_AUTHORING_ACTOR,
    },
    {
      companyId,
      actorId: STUDIO_ACTIVITY_AUTHORING_ACTOR.id,
      actorKind: STUDIO_ACTIVITY_AUTHORING_ACTOR.kind,
    },
  )
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
