/**
 * H16.1 — Integration Foundation contracts.
 *
 * Vendor-neutral kinds, lifecycle, capabilities, and rejection reasons.
 * H16.2 enables eventIntake. Rules/delivery/vendors/workers stay off.
 * CommercialClose providers remain H15.6.
 */

export const INTEGRATION_KIND = Object.freeze({
  DELIVERY: 'delivery',
  CRM: 'crm',
  CALENDAR: 'calendar',
  MESSAGING: 'messaging',
  OUTBOUND_WEBHOOK: 'outboundWebhook',
})

export const INTEGRATION_KINDS = Object.freeze(Object.values(INTEGRATION_KIND))

export const INTEGRATION_KIND_LABELS = Object.freeze({
  [INTEGRATION_KIND.DELIVERY]: 'Delivery',
  [INTEGRATION_KIND.CRM]: 'CRM',
  [INTEGRATION_KIND.CALENDAR]: 'Calendar',
  [INTEGRATION_KIND.MESSAGING]: 'Messaging',
  [INTEGRATION_KIND.OUTBOUND_WEBHOOK]: 'Outbound webhook',
})

/**
 * Configuration lifecycle only — does not imply execution is live.
 * H16.1 never executes integrations even when status is enabled.
 */
export const INTEGRATION_STATUS = Object.freeze({
  DISABLED: 'disabled',
  CONFIGURED: 'configured',
  ENABLED: 'enabled',
})

export const INTEGRATION_STATUSES = Object.freeze(
  Object.values(INTEGRATION_STATUS),
)

export const INTEGRATION_STATUS_LABELS = Object.freeze({
  [INTEGRATION_STATUS.DISABLED]: 'Disabled',
  [INTEGRATION_STATUS.CONFIGURED]: 'Configured',
  [INTEGRATION_STATUS.ENABLED]: 'Enabled',
})

export const INTEGRATION_REJECTION_REASON = Object.freeze({
  COMPANY_REQUIRED: 'company_required',
  COMPANY_MISMATCH: 'company_mismatch',
  UNKNOWN_ADAPTER: 'unknown_adapter',
  DISABLED_ADAPTER: 'disabled_adapter',
  INVALID_KIND: 'invalid_kind',
  INVALID_STATUS: 'invalid_status',
  INVALID_CONFIG: 'invalid_config',
  SECRET_VALUE_FORBIDDEN: 'secret_value_forbidden',
  BOUNDARY_VIOLATION: 'boundary_violation',
})

/**
 * Honest H16.1 capability surface.
 * Only the foundation itself is true. All execution / vendor flags stay false.
 */
export const INTEGRATION_CAPABILITIES = Object.freeze({
  integrationFoundation: true,
  eventIntake: true,
  automationRules: false,
  deliveryExecution: false,
  emailDelivery: false,
  crm: false,
  calendar: false,
  messaging: false,
  outboundWebhooks: false,
  backgroundWorkers: false,
  thirdPartyIntegrations: false,
  oauth: false,
  vendorSdks: false,
  liveWebhookIngress: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export { WORKFLOW_ISOLATION_COMPANY_ID as INTEGRATION_ISOLATION_COMPANY_ID } from '../workflow/types.js'
