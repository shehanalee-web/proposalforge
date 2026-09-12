/**
 * H16.14 — Studio Principal.
 *
 * Slice 14.1: canonical identity contract.
 * Slice 14.2: request binding. Query/body actorId and companyId are claims.
 * The current trusted source is the workflow actor catalog until real auth
 * exists. No login, JWT, cookies, sessions, OAuth, or authoring write-path
 * change.
 */

export {
  STUDIO_PRINCIPAL_SCHEMA_VERSION,
  STUDIO_PRINCIPAL_KIND,
  STUDIO_PRINCIPAL_KINDS,
  STUDIO_PRINCIPAL_LIMITS,
  STUDIO_PRINCIPAL_FORBIDDEN_FIELDS,
} from './types.js'

export { makeStudioPrincipal, cloneStudioPrincipal } from './schema.js'

export {
  readClaimedStudioIdentity,
  getRequestStudioPrincipal,
  setRequestStudioPrincipal,
  bindStudioPrincipal,
  resolveStudioCatalogPrincipal,
  bindStudioRequest,
  studioRequestIdentity,
} from './bind.js'
