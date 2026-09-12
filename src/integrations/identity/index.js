/**
 * H16.14 — Studio Principal.
 *
 * Slice 14.1: canonical identity contract only. No HTTP binding, login,
 * JWT, cookies, sessions, OAuth, or authoring write-path change.
 */

export {
  STUDIO_PRINCIPAL_SCHEMA_VERSION,
  STUDIO_PRINCIPAL_KIND,
  STUDIO_PRINCIPAL_KINDS,
  STUDIO_PRINCIPAL_LIMITS,
  STUDIO_PRINCIPAL_FORBIDDEN_FIELDS,
} from './types.js'

export { makeStudioPrincipal, cloneStudioPrincipal } from './schema.js'
