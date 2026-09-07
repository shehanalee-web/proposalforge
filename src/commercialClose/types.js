/**
 * H15.1–H15.3 — Commercial Close Domain contracts.
 *
 * Post-acceptance business object bound to the H14 decision snapshot.
 * H15.2 adds an authoritative vendor-neutral close state machine.
 * H15.3 adds a provider-neutral internal signature path owned by CommercialClose.
 * Real signature/payment vendors arrive in later slices.
 */

export const COMMERCIAL_CLOSE_STATUS = Object.freeze({
  OPEN: 'open',
  SIGNATURE_PENDING: 'signature_pending',
  SIGNED: 'signed',
  PAYMENT_PENDING: 'payment_pending',
  PAID: 'paid',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
})

export const COMMERCIAL_CLOSE_STATUSES = Object.freeze(
  Object.values(COMMERCIAL_CLOSE_STATUS),
)

export const COMMERCIAL_CLOSE_STATUS_LABELS = Object.freeze({
  [COMMERCIAL_CLOSE_STATUS.OPEN]: 'Open',
  [COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING]: 'Signature pending',
  [COMMERCIAL_CLOSE_STATUS.SIGNED]: 'Signed',
  [COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING]: 'Payment pending',
  [COMMERCIAL_CLOSE_STATUS.PAID]: 'Paid',
  [COMMERCIAL_CLOSE_STATUS.CLOSED]: 'Closed',
  [COMMERCIAL_CLOSE_STATUS.CANCELLED]: 'Cancelled',
  [COMMERCIAL_CLOSE_STATUS.EXPIRED]: 'Expired',
})

export const COMMERCIAL_CLOSE_TERMINAL_STATUSES = Object.freeze([
  COMMERCIAL_CLOSE_STATUS.CLOSED,
  COMMERCIAL_CLOSE_STATUS.CANCELLED,
  COMMERCIAL_CLOSE_STATUS.EXPIRED,
])

/** Provider-neutral signature status on CommercialClose (not proposal.signature). */
export const CLOSE_SIGNATURE_STATUS = Object.freeze({
  NOT_REQUESTED: 'not_requested',
  PENDING: 'pending',
  COMPLETED: 'completed',
  VOID: 'void',
})

export const CLOSE_SIGNATURE_STATUSES = Object.freeze(
  Object.values(CLOSE_SIGNATURE_STATUS),
)

export const CLOSE_SIGNATURE_STATUS_LABELS = Object.freeze({
  [CLOSE_SIGNATURE_STATUS.NOT_REQUESTED]: 'Not requested',
  [CLOSE_SIGNATURE_STATUS.PENDING]: 'Pending',
  [CLOSE_SIGNATURE_STATUS.COMPLETED]: 'Completed',
  [CLOSE_SIGNATURE_STATUS.VOID]: 'Void',
})

/** Only `internal` is supported in H15.3. Vendor enums stay for future slices. */
export const CLOSE_SIGNATURE_METHOD = Object.freeze({
  INTERNAL: 'internal',
})

export const CLOSE_SIGNATURE_METHODS = Object.freeze(
  Object.values(CLOSE_SIGNATURE_METHOD),
)

export const CLOSE_SIGNATURE_PARTY_ROLE = Object.freeze({
  CLIENT: 'client',
  STUDIO: 'studio',
})

export const CLOSE_SIGNATURE_PARTY_ROLES = Object.freeze(
  Object.values(CLOSE_SIGNATURE_PARTY_ROLE),
)

/** Studio audit events recorded via living engagement store (no new event store). */
export const COMMERCIAL_CLOSE_EVENT = Object.freeze({
  OPENED: 'close.opened',
  STATE_CHANGED: 'close.state_changed',
  COMPLETED: 'close.completed',
  CANCELLED: 'close.cancelled',
  EXPIRED: 'close.expired',
  SIGNATURE_REQUESTED: 'signature.requested',
  SIGNATURE_COMPLETED: 'signature.completed',
})

export const COMMERCIAL_CLOSE_EVENTS = Object.freeze(
  Object.values(COMMERCIAL_CLOSE_EVENT),
)

/**
 * Honest H15.3 capability surface.
 * commercialCloseSignaturePath = internal architecture only.
 * Vendor / digital-signature flags remain false.
 */
export const COMMERCIAL_CLOSE_CAPABILITIES = Object.freeze({
  commercialCloseDomain: true,
  commercialCloseStateMachine: true,
  commercialCloseSignaturePath: true,
  digitalSignature: false,
  paymentProcessing: false,
  thirdPartyIntegrations: false,
  signatureVendors: false,
  paymentVendors: false,
  crm: false,
  whatsapp: false,
  slack: false,
  teams: false,
  clientForge: false,
  llm: false,
  rive: false,
  externalWebhooks: false,
})

export function isTerminalCommercialCloseStatus(status) {
  return COMMERCIAL_CLOSE_TERMINAL_STATUSES.includes(status)
}
