/**
 * H16.10 Slice 10.2 — Activity entity subject resolution.
 *
 * Authorizes contact / company / deal subjects against the in-memory entity
 * registry. Does not own a second store. Does not resolve proposal or close.
 * Tenant companyId is never treated as a company-kind entity.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import { ACTIVITY_SUBJECT_TYPE } from '../activities/types.js'
import {
  ACTIVITY_ENTITY_FORBIDDEN,
  ACTIVITY_ENTITY_KINDS,
  ACTIVITY_ENTITY_NOT_FOUND,
} from './types.js'
import { allActivityEntities, getActivityEntity } from './store.js'

function assertCompany(companyId) {
  const check = evaluateIntegrationCompanyScope(companyId)
  if (!check.ok) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return String(companyId).trim()
}

/**
 * Resolve a contact, company, or deal subject for one tenant.
 *
 * @param {{ companyId?: string, type?: string, id?: string }} [input]
 */
export function resolveActivityEntity(input = {}) {
  const companyId = assertCompany(input.companyId)
  const type = String(input.type ?? '').trim()
  const id = String(input.id ?? '').trim()

  if (!ACTIVITY_ENTITY_KINDS.includes(type)) {
    throw new ValidationError('Activity entity kind is not recognized.', [
      { field: 'type', message: 'Activity entity kind is not recognized.' },
    ])
  }
  if (!id) {
    throw new ValidationError('id is required.', [{ field: 'id', message: 'id is required.' }])
  }

  if (type === ACTIVITY_SUBJECT_TYPE.COMPANY && id === companyId) {
    throw new NotFoundError(ACTIVITY_ENTITY_NOT_FOUND)
  }

  const found = allActivityEntities().find((item) => item.kind === type && item.id === id)
  if (!found) {
    throw new NotFoundError(ACTIVITY_ENTITY_NOT_FOUND)
  }
  if (found.companyId !== companyId) {
    throw new ForbiddenError(ACTIVITY_ENTITY_FORBIDDEN)
  }

  return getActivityEntity(companyId, type, id)
}

/**
 * Authorize an Activity subject when it is a contact, company, or deal.
 * Proposal, close, missing subject, and missing id are no-ops.
 *
 * @param {string} companyId
 * @param {{ type?: string, id?: string } | null | undefined} subject
 */
export function assertActivityEntityAccess(companyId, subject) {
  if (!subject || typeof subject !== 'object') return
  const id = String(subject.id ?? '').trim()
  const type = String(subject.type ?? '').trim()
  if (!id) return
  if (!ACTIVITY_ENTITY_KINDS.includes(type)) return
  resolveActivityEntity({ companyId, type, id })
}
