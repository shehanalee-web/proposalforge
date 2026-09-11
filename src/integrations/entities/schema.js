/**
 * H16.10 Slice 10.1 — Activity entity schema.
 *
 * In-memory registry records only. No HTTP, no CRM adapter, no Postgres.
 * companyId is always the tenant workspace. A company-kind entity's identity
 * is id + kind, never the tenant id.
 */

import { EMAIL_PATTERN } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import { assertNoSecretValues } from '../schema.js'
import { ACTIVITY_SUBJECT_TYPE } from '../activities/types.js'
import {
  ACTIVITY_ENTITY_FORBIDDEN_FIELDS,
  ACTIVITY_ENTITY_KIND,
  ACTIVITY_ENTITY_KINDS,
  ACTIVITY_ENTITY_LIMITS,
  ACTIVITY_ENTITY_SCHEMA_VERSION,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asTrimmed(value) {
  return asString(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function nowIso() {
  return new Date().toISOString()
}

function asRequiredId(value, field) {
  const id = asTrimmed(value).slice(0, ACTIVITY_ENTITY_LIMITS.MAX_ID)
  if (!id) {
    throw invalid(`${field} is required.`, field)
  }
  return id
}

function asOptionalId(value) {
  const id = asTrimmed(value).slice(0, ACTIVITY_ENTITY_LIMITS.MAX_ID)
  return id || null
}

function asIso(value, fallback = null) {
  if (value == null || value === '') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function assertNoForbiddenFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of ACTIVITY_ENTITY_FORBIDDEN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid('Activity entities cannot store vendor or monetary fields.', key)
  }
}

function asKind(value) {
  const kind = asTrimmed(value)
  if (kind === ACTIVITY_SUBJECT_TYPE.CLOSE || kind === ACTIVITY_SUBJECT_TYPE.PROPOSAL) {
    throw invalid('Activity entity kind is not supported in H16.10.', 'kind')
  }
  if (!ACTIVITY_ENTITY_KINDS.includes(kind)) {
    throw invalid('Activity entity kind is not recognized.', 'kind')
  }
  return kind
}

function asEmail(kind, value) {
  const email = asTrimmed(value).slice(0, ACTIVITY_ENTITY_LIMITS.MAX_EMAIL)
  if (!email) return null
  if (kind !== ACTIVITY_ENTITY_KIND.CONTACT) {
    throw invalid('email is only valid on contact entities.', 'email')
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw invalid('Contact email is not valid.', 'email')
  }
  return email
}

function asDomain(kind, value) {
  const domain = asTrimmed(value).slice(0, ACTIVITY_ENTITY_LIMITS.MAX_DOMAIN).toLowerCase()
  if (!domain) return null
  if (kind !== ACTIVITY_ENTITY_KIND.COMPANY) {
    throw invalid('domain is only valid on company entities.', 'domain')
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(domain) || domain.includes('/')) {
    throw invalid('Company domain must not be a URL.', 'domain')
  }
  return domain
}

function asDealRef(kind, value, field) {
  const id = asOptionalId(value)
  if (!id) return null
  if (kind !== ACTIVITY_ENTITY_KIND.DEAL) {
    throw invalid(`${field} is only valid on deal entities.`, field)
  }
  return id
}

/**
 * @param {object} [input]
 * @returns {object}
 */
export function makeActivityEntity(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Activity entity must be an object.', 'entity')
  }
  assertNoSecretValues(input)
  assertNoForbiddenFields(input)

  const companyId = asRequiredId(input.companyId, 'companyId')
  const kind = asKind(input.kind ?? input.type)
  const id = asRequiredId(input.id, 'id')
  const displayName =
    asTrimmed(input.displayName).slice(0, ACTIVITY_ENTITY_LIMITS.MAX_NAME) || id
  const createdAt = asIso(input.createdAt, nowIso())

  return Object.freeze({
    id,
    companyId,
    kind,
    displayName,
    email: asEmail(kind, input.email),
    domain: asDomain(kind, input.domain),
    proposalId: asOptionalId(input.proposalId),
    contactId: asDealRef(kind, input.contactId, 'contactId'),
    companyRefId: asDealRef(kind, input.companyRefId, 'companyRefId'),
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : ACTIVITY_ENTITY_SCHEMA_VERSION,
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  })
}

/**
 * @param {object} [entity]
 */
export function cloneActivityEntity(entity) {
  return makeActivityEntity(entity ?? {})
}
