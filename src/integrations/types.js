/**
 * H16.1 — Integration Foundation contracts.
 *
 * Vendor-neutral kinds, lifecycle, capabilities, and rejection reasons.
 * H16.2 enables eventIntake. H16.3 enables automationRules.
 * H16.4 enables actionIntents (recorded only — no intent execution states).
 * H16.5 enables outboundWebhooks (sync consumer; live network still env-gated).
 * H16.6 enables crm (vendor-neutral sync consumer; mock adapter only, no network).
 * H16.7 enables activityTimeline (read-only projection; no native write path).
 * Delivery/vendors/workers stay off. CommercialClose providers remain H15.6.
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
 * Honest H16 capability surface.
 * Foundation + event intake + automation rules + action intents + outbound
 * webhooks + CRM architecture are true. Live webhook HTTPS still requires
 * OUTBOUND_WEBHOOK_NETWORK=1, and CRM ships with an in-process mock adapter
 * only. Delivery / vendors / OAuth / workers stay false.
 *
 * activityTimeline is a read-only projection. activityAuthoring stays false
 * until H16.8 registers a durable repository — native Activity records must
 * never be written to ephemeral JSON storage, so the write surface cannot be
 * enabled before durable persistence exists.
 */
export const INTEGRATION_CAPABILITIES = Object.freeze({
  integrationFoundation: true,
  eventIntake: true,
  automationRules: true,
  actionIntents: true,
  deliveryExecution: false,
  emailDelivery: false,
  crm: true,
  calendar: false,
  messaging: false,
  outboundWebhooks: true,
  activityTimeline: true,
  activityAuthoring: false,
  backgroundWorkers: false,
  thirdPartyIntegrations: false,
  oauth: false,
  vendorSdks: false,
  liveWebhookIngress: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export { WORKFLOW_ISOLATION_COMPANY_ID as INTEGRATION_ISOLATION_COMPANY_ID } from '../workflow/types.js'
