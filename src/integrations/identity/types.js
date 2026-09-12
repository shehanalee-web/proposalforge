/**
 * H16.14 Slice 14.1 — Studio Principal contract.
 *
 * Canonical studio identity. Combines the Native Activity actor fields
 * (id, kind, displayName) with tenant companyId. Not a login, session,
 * JWT, cookie, OAuth client, IdP, or TimelineSource.
 * companyId is workspace identity, not a CRM Company subject.
 * HTTP binding and createStudioActivity stay unchanged until later slices.
 */

import { ACTIVITY_ACTOR_KIND, TIMELINE_LIMITS } from '../activities/types.js'

export const STUDIO_PRINCIPAL_SCHEMA_VERSION = 1

/** Studio principals are user actors. Agent origin remains H16.15. */
export const STUDIO_PRINCIPAL_KIND = ACTIVITY_ACTOR_KIND.USER

export const STUDIO_PRINCIPAL_KINDS = Object.freeze([STUDIO_PRINCIPAL_KIND])

export const STUDIO_PRINCIPAL_LIMITS = Object.freeze({
  MAX_ID: TIMELINE_LIMITS.MAX_ID,
  MAX_DISPLAY_NAME: TIMELINE_LIMITS.MAX_ID,
})

/**
 * Secrets, sessions, vendor OAuth, and CRM-subject smuggling.
 * Presence of a non-empty value is a hard reject.
 */
export const STUDIO_PRINCIPAL_FORBIDDEN_FIELDS = Object.freeze([
  'oauth',
  'accessToken',
  'refreshToken',
  'idToken',
  'authorizationCode',
  'password',
  'jwt',
  'cookie',
  'session',
  'sessionId',
  'bearer',
  'apiKey',
  'clientSecret',
  'companyRefId',
  'subjectType',
  'contactId',
  'dealId',
])
