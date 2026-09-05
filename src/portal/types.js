/**
 * Horizon 11 Client Portal identifiers.
 *
 * This domain references an existing proposal by proposalId. It does not own
 * proposal content, workflow, Health, Intelligence, or generation.
 *
 * Future delivery / auth / payment flags stay explicit and off.
 */

export const PORTAL_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
})

export const PORTAL_STATUSES = Object.freeze(Object.values(PORTAL_STATUS))

export const PORTAL_EVENT = Object.freeze({
  CREATED: 'portal.created',
  PUBLISHED: 'portal.published',
  REVOKED: 'portal.revoked',
  EXPIRED: 'portal.expired',
  ACCESS_DENIED: 'portal.access_denied',
})

export const PORTAL_EVENTS = Object.freeze(Object.values(PORTAL_EVENT))

export const PORTAL_ACCESS_REASON = Object.freeze({
  UNKNOWN: 'unknown',
  UNPUBLISHED: 'unpublished',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  COMPANY_MISMATCH: 'company_mismatch',
})

/** Workflow states that may be published. Approval or Ready to Send never auto-publishes. */
export const PORTAL_PUBLISHABLE_WORKFLOW = Object.freeze([
  'ready_to_send',
  'sent',
  'viewed',
  'accepted',
])

/** Future Horizons. All remain off in Horizon 11. */
export const PORTAL_CAPABILITIES = Object.freeze({
  thirdPartyAuth: false,
  enterpriseAuth: false,
  emailDelivery: false,
  whatsapp: false,
  digitalSignature: false,
  paymentProcessing: false,
  crm: false,
  clientComments: false,
  clientApprovals: false,
  marketingSite: false,
  unguessableUrlIsAuth: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export { WORKFLOW_ISOLATION_COMPANY_ID as PORTAL_ISOLATION_COMPANY_ID } from '../workflow/types.js'
