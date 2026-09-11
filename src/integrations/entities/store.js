/**
 * H16.10 Slice 10.1 — In-memory Activity entity registry.
 *
 * v1 resolution store. Not durable Postgres, not entities.json, not CRM mock.
 * Identity is (kind, id) globally; companyId is ownership.
 * Production population is later; this module only reset/upsert/get/list.
 */

import { ForbiddenError, NotFoundError, ValidationError } from '../../services/errors.js'
import { cloneActivityEntity, makeActivityEntity } from './schema.js'
import {
  ACTIVITY_ENTITY_FORBIDDEN,
  ACTIVITY_ENTITY_KINDS,
  ACTIVITY_ENTITY_NOT_FOUND,
} from './types.js'

/** @type {object[]} */
let records = []

function identityKey(kind, id) {
  return `${kind}:${id}`
}

function cloneList(list) {
  return list.map((item) => cloneActivityEntity(item))
}

function asCompanyId(companyId) {
  const company = String(companyId ?? '').trim()
  if (!company) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return company
}

function asKind(type) {
  const kind = String(type ?? '').trim()
  if (!ACTIVITY_ENTITY_KINDS.includes(kind)) {
    throw new ValidationError('Activity entity kind is not recognized.', [
      { field: 'type', message: 'Activity entity kind is not recognized.' },
    ])
  }
  return kind
}

function asEntityId(id) {
  const key = String(id ?? '').trim()
  if (!key) {
    throw new ValidationError('id is required.', [{ field: 'id', message: 'id is required.' }])
  }
  return key
}

function findByKindAndId(kind, id) {
  return records.find((item) => item.kind === kind && item.id === id) ?? null
}

function assertOwned(entity, companyId) {
  if (entity.companyId === companyId) return
  throw new ForbiddenError(ACTIVITY_ENTITY_FORBIDDEN)
}

/**
 * @param {object[] | { entities?: object[] }} [seed]
 */
export function resetActivityEntityStore(seed = []) {
  const list = Array.isArray(seed) ? seed : Array.isArray(seed?.entities) ? seed.entities : []
  const next = []
  const seen = new Set()
  for (const item of list) {
    const entity = makeActivityEntity(item)
    const key = identityKey(entity.kind, entity.id)
    if (seen.has(key)) {
      throw new ValidationError('Activity entity id is already registered for this kind.', [
        { field: 'id', message: 'Activity entity id is already registered for this kind.' },
      ])
    }
    seen.add(key)
    next.push(entity)
  }
  records = next
  return cloneList(records)
}

export function allActivityEntities() {
  return cloneList(records)
}

/**
 * @param {object} input
 */
export function upsertActivityEntity(input = {}) {
  const entity = makeActivityEntity(input)
  const existing = findByKindAndId(entity.kind, entity.id)
  if (existing) {
    assertOwned(existing, entity.companyId)
    records = records.map((item) =>
      item.kind === entity.kind && item.id === entity.id
        ? makeActivityEntity({
            ...entity,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
          })
        : item,
    )
  } else {
    records = [...records, entity]
  }
  return cloneActivityEntity(findByKindAndId(entity.kind, entity.id))
}

/**
 * Lookup by kind + id. Absent globally → 404. Other tenant → 403.
 * Error messages never include the entity id or foreign companyId.
 *
 * @param {string} companyId
 * @param {string} type
 * @param {string} id
 */
export function getActivityEntity(companyId, type, id) {
  const company = asCompanyId(companyId)
  const kind = asKind(type)
  const key = asEntityId(id)
  const found = findByKindAndId(kind, key)
  if (!found) {
    throw new NotFoundError(ACTIVITY_ENTITY_NOT_FOUND)
  }
  assertOwned(found, company)
  return cloneActivityEntity(found)
}

/**
 * @param {string} companyId
 * @param {{ type?: string }} [query]
 */
export function listActivityEntities(companyId, query = {}) {
  const company = asCompanyId(companyId)
  const type = String(query.type ?? '').trim()
  if (type) asKind(type)
  return cloneList(
    records.filter((item) => {
      if (item.companyId !== company) return false
      if (type && item.kind !== type) return false
      return true
    }),
  )
}
