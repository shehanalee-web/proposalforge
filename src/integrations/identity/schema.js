/**
 * H16.14 Slice 14.1 — Studio Principal schema.
 *
 * Pure normalization. No HTTP, login, JWT, cookies, sessions, OAuth,
 * ActivityRepository write, mailbox/calendar ingest, or H16.11 emission.
 */

import { ValidationError } from '../../services/errors.js'
import { evaluateIntegrationCompanyScope } from '../config.js'
import {
  STUDIO_PRINCIPAL_FORBIDDEN_FIELDS,
  STUDIO_PRINCIPAL_KIND,
  STUDIO_PRINCIPAL_KINDS,
  STUDIO_PRINCIPAL_LIMITS,
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

function asRequiredId(value, field, max = STUDIO_PRINCIPAL_LIMITS.MAX_ID) {
  const id = asTrimmed(value).slice(0, max)
  if (!id) {
    throw invalid(`${field} is required.`, field)
  }
  return id
}

function assertNoForbiddenFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of STUDIO_PRINCIPAL_FORBIDDEN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid('Studio principal cannot carry secrets, sessions, or CRM subjects.', key)
  }
}

/**
 * Normalize a studio principal. Output is exactly
 * { id, kind, displayName, companyId }.
 *
 * `kind` defaults to user. Agent / client / system are rejected.
 * Workflow actors may pass `name`; it is stored as displayName.
 * companyId is tenant/workspace identity and is not defaulted.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function makeStudioPrincipal(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Studio principal must be an object.', 'principal')
  }
  assertNoForbiddenFields(input)

  const id = asRequiredId(input.id, 'id')
  const kind = asTrimmed(input.kind) || STUDIO_PRINCIPAL_KIND
  if (!STUDIO_PRINCIPAL_KINDS.includes(kind)) {
    throw invalid('Studio principal kind must be user.', 'kind')
  }

  const displayName =
    asTrimmed(input.displayName || input.name).slice(
      0,
      STUDIO_PRINCIPAL_LIMITS.MAX_DISPLAY_NAME,
    ) || null

  const scoped = evaluateIntegrationCompanyScope(input.companyId)
  if (!scoped.ok) {
    throw invalid('companyId is required.', 'companyId')
  }
  const companyId = scoped.companyId.slice(0, STUDIO_PRINCIPAL_LIMITS.MAX_ID)

  return Object.freeze({
    id,
    kind,
    displayName,
    companyId,
  })
}

/**
 * @param {object} [input]
 * @returns {object}
 */
export function cloneStudioPrincipal(input) {
  return makeStudioPrincipal(input)
}
