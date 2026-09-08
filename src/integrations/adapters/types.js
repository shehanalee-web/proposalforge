/**
 * H16.1 — Neutral integration adapter contracts.
 *
 * Separate from H15.6 CommercialClose provider adapters.
 * Null adapters only — no vendor SDKs, OAuth, or network I/O.
 */

import { INTEGRATION_KIND } from '../types.js'

export const NULL_INTEGRATION_ADAPTER_ID = Object.freeze({
  [INTEGRATION_KIND.DELIVERY]: 'null_delivery',
  [INTEGRATION_KIND.CRM]: 'null_crm',
  [INTEGRATION_KIND.CALENDAR]: 'null_calendar',
  [INTEGRATION_KIND.MESSAGING]: 'null_messaging',
  [INTEGRATION_KIND.OUTBOUND_WEBHOOK]: 'null_outbound_webhook',
})

export const NULL_INTEGRATION_ADAPTER_IDS = Object.freeze(
  Object.values(NULL_INTEGRATION_ADAPTER_ID),
)

/**
 * Minimal adapter description for registry / studio projection.
 *
 * @param {object} [input]
 */
export function makeIntegrationAdapterDescriptor(input = {}) {
  return Object.freeze({
    id: String(input.id ?? '').trim() || null,
    kind: String(input.kind ?? '').trim() || null,
    enabled: false,
    vendorNeutral: true,
    network: false,
    oauth: false,
  })
}
