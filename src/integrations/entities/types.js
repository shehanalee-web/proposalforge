/**
 * H16.10 — Vendor-neutral Activity entity contracts (Slice 10.1).
 *
 * First-class Contact / Company / Deal records for subject resolution.
 * Not CRM sync records, not tenant companyId, not proposals.json.
 * CLOSE is not an H16.10 entity kind.
 */

import { ACTIVITY_SUBJECT_TYPE } from '../activities/types.js'

export const ACTIVITY_ENTITY_SCHEMA_VERSION = 1

/**
 * Entity kinds are the Activity subject types H16.10 resolves.
 * Tenant workspace ids remain companyId on the record, never this enum.
 */
export const ACTIVITY_ENTITY_KIND = Object.freeze({
  CONTACT: ACTIVITY_SUBJECT_TYPE.CONTACT,
  COMPANY: ACTIVITY_SUBJECT_TYPE.COMPANY,
  DEAL: ACTIVITY_SUBJECT_TYPE.DEAL,
})

export const ACTIVITY_ENTITY_KINDS = Object.freeze(Object.values(ACTIVITY_ENTITY_KIND))

export const ACTIVITY_ENTITY_LIMITS = Object.freeze({
  MAX_ID: 128,
  MAX_NAME: 120,
  MAX_EMAIL: 200,
  MAX_DOMAIN: 200,
})

/** Exact H16.7/H16.10 isolation copy. Store get uses these; do not interpolate ids. */
export const ACTIVITY_ENTITY_NOT_FOUND = 'Activity subject not found.'
export const ACTIVITY_ENTITY_FORBIDDEN = 'You cannot access another company workspace.'

/**
 * Monetary and vendor-sync fields are not part of the H16.10 entity.
 * H16.6 CRM records stay in their own identifier space.
 */
export const ACTIVITY_ENTITY_FORBIDDEN_FIELDS = Object.freeze([
  'amount',
  'value',
  'price',
  'total',
  'subtotal',
  'grandTotal',
  'currency',
  'mrr',
  'arr',
  'revenue',
  'dealValue',
  'packageAmount',
  'unitPrice',
  'selectedTotal',
  'externalKey',
  'externalId',
  'oauth',
  'accessToken',
  'refreshToken',
])
