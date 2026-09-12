/**
 * H16.14 Slice 14.2 — Studio request binding.
 *
 * Derives a Studio Principal from an explicit bound request principal, or
 * from the current trusted source: the H10 workflow actor catalog plus the
 * companyId tenant selector. Query/body actorId and companyId are claims.
 * They cannot replace a bound principal or select another tenant.
 *
 * Not a login, JWT, cookie, session, OAuth client, or IdP.
 */

import { ForbiddenError } from '../../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../../knowledge/types.js'
import { DEFAULT_ACTOR_ID, getWorkflowActor } from '../../workflow/actors.js'
import { makeStudioPrincipal } from './schema.js'

const STUDIO_PRINCIPAL_REQUEST_KEY = Symbol('proposalforge.studioPrincipal')

function asTrimmed(value) {
  return value == null ? '' : String(value).trim()
}

/**
 * Untrusted actorId/companyId from a studio request. Empty means omitted.
 *
 * @param {object | null | undefined} body
 * @param {{ get?: (key: string) => string | null } | null | undefined} query
 */
export function readClaimedStudioIdentity(body, query) {
  const actorId = asTrimmed(body?.actorId || query?.get?.('actorId'))
  const companyId = asTrimmed(body?.companyId || query?.get?.('companyId'))
  return Object.freeze({
    actorId: actorId || null,
    companyId: companyId || null,
  })
}

/**
 * @param {object | null | undefined} req
 * @returns {object | null}
 */
export function getRequestStudioPrincipal(req) {
  if (!req || typeof req !== 'object') return null
  return req[STUDIO_PRINCIPAL_REQUEST_KEY] ?? null
}

/**
 * Attach a bound Studio Principal to a request. This is a request-slot, not
 * a session or cookie.
 *
 * @param {object} req
 * @param {object} principal
 * @returns {object}
 */
export function setRequestStudioPrincipal(req, principal) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) {
    throw new ForbiddenError('Studio request is required to bind a principal.')
  }
  const bound = makeStudioPrincipal(principal)
  req[STUDIO_PRINCIPAL_REQUEST_KEY] = bound
  return bound
}

/**
 * Enforce that request claims cannot impersonate or cross tenants.
 *
 * @param {{ bound?: object, claimed?: { actorId?: string | null, companyId?: string | null } }} [input]
 * @returns {object}
 */
export function bindStudioPrincipal(input = {}) {
  const principal = makeStudioPrincipal(input.bound)
  const claimed = input.claimed && typeof input.claimed === 'object' ? input.claimed : {}
  const actorId = asTrimmed(claimed.actorId)
  const companyId = asTrimmed(claimed.companyId)
  if (actorId && actorId !== principal.id) {
    throw new ForbiddenError('You cannot impersonate another actor.')
  }
  if (companyId && companyId !== principal.companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return principal
}

/**
 * Provisional trusted source until real auth exists: catalog actor + tenant
 * selector. companyId defaults to company-studio when omitted, matching
 * existing studio HTTP helpers.
 *
 * @param {{ actorId?: string | null, companyId?: string | null }} [claimed]
 * @returns {object}
 */
export function resolveStudioCatalogPrincipal(claimed = {}) {
  const actorId = asTrimmed(claimed.actorId) || DEFAULT_ACTOR_ID
  const companyId = asTrimmed(claimed.companyId) || DEFAULT_COMPANY_ID
  const known = getWorkflowActor(actorId)
  if (known && known.companyId !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
  return makeStudioPrincipal({
    id: known?.id ?? actorId,
    name: known?.name ?? 'Studio',
    companyId,
  })
}

/**
 * Bind a studio request. Prefer an explicit request-bound principal; otherwise
 * use the workflow catalog. Claims cannot override the bound identity.
 *
 * @param {{ req?: object | null, body?: object | null, query?: { get?: Function } | null }} [input]
 * @returns {object}
 */
export function bindStudioRequest(input = {}) {
  const claimed = readClaimedStudioIdentity(input.body, input.query)
  const attached = getRequestStudioPrincipal(input.req)
  if (attached) {
    return bindStudioPrincipal({ bound: attached, claimed })
  }
  return resolveStudioCatalogPrincipal(claimed)
}

/**
 * Plugin helper. Returns { companyId, actor: { id } } for existing repository
 * call sites. Does not change Native Activity authoring.
 *
 * @param {object | null | undefined} req
 * @param {object | null | undefined} body
 * @param {{ get?: Function } | null | undefined} query
 */
export function studioRequestIdentity(req, body, query) {
  const principal = bindStudioRequest({ req, body, query })
  return Object.freeze({
    companyId: principal.companyId,
    actor: Object.freeze({ id: principal.id }),
  })
}
