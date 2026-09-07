/**
 * H15.1 — Commercial Close Domain contracts.
 *
 * Post-acceptance business object bound to the H14 decision snapshot.
 * Signature, payment, contract, and vendors arrive in later H15 slices.
 */

export const COMMERCIAL_CLOSE_STATUS = Object.freeze({
  OPEN: 'open',
})

export const COMMERCIAL_CLOSE_STATUSES = Object.freeze(
  Object.values(COMMERCIAL_CLOSE_STATUS),
)

export const COMMERCIAL_CLOSE_STATUS_LABELS = Object.freeze({
  [COMMERCIAL_CLOSE_STATUS.OPEN]: 'Open',
})

/** Studio audit event recorded via living engagement store (no new event store). */
export const COMMERCIAL_CLOSE_EVENT = Object.freeze({
  OPENED: 'close.opened',
})

/**
 * Honest H15.1 capability surface.
 * Vendor / signature / payment flags stay false until later slices.
 */
export const COMMERCIAL_CLOSE_CAPABILITIES = Object.freeze({
  commercialCloseDomain: true,
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
})
