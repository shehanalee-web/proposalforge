/**
 * Horizon 12 Client Interactions identifiers.
 *
 * Records client feedback against an existing published portal. Does not own
 * proposal content, workflow, or portal publication.
 */

export const INTERACTION_TYPE = Object.freeze({
  COMMENT: 'comment',
  CHANGE_REQUEST: 'change_request',
  APPROVAL: 'approval',
  QUESTION: 'question',
})

export const INTERACTION_TYPES = Object.freeze(Object.values(INTERACTION_TYPE))

export const INTERACTION_STATUS = Object.freeze({
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
})

export const INTERACTION_STATUSES = Object.freeze(Object.values(INTERACTION_STATUS))

export const INTERACTION_SOURCE = Object.freeze({
  CLIENT: 'client',
  STUDIO: 'studio',
})

export const INTERACTION_SOURCES = Object.freeze(Object.values(INTERACTION_SOURCE))

export const INTERACTION_EVENT = Object.freeze({
  CREATED: 'interaction.created',
  ACKNOWLEDGED: 'interaction.acknowledged',
  RESOLVED: 'interaction.resolved',
})

export const INTERACTION_EVENTS = Object.freeze(Object.values(INTERACTION_EVENT))

/** Future Horizons. All remain off in Horizon 12. */
export const INTERACTION_CAPABILITIES = Object.freeze({
  realtimeChat: false,
  websockets: false,
  typingIndicators: false,
  presence: false,
  notifications: false,
  emailDelivery: false,
  whatsapp: false,
  crm: false,
  digitalSignature: false,
  paymentProcessing: false,
  thirdPartyAuth: false,
  enterpriseAuth: false,
  unguessableUrlIsAuth: false,
  autoWorkflowTransition: false,
  autoProposalEdit: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export { WORKFLOW_ISOLATION_COMPANY_ID as INTERACTION_ISOLATION_COMPANY_ID } from '../workflow/types.js'
