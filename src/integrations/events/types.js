/**
 * H16.2 — Automation event intake contracts.
 *
 * Normalized triggers for future rules. Not a second living/activity audit store.
 * H15.6 provider webhooks are not an authoritative intake source.
 */

export const AUTOMATION_EVENT_SCHEMA_VERSION = 1

export const AUTOMATION_SOURCE_DOMAIN = Object.freeze({
  LIVING: 'living',
  FOLLOWUP: 'followup',
  WORKFLOW: 'workflow',
  PORTAL: 'portal',
  INTERACTION: 'interaction',
  ACTIVITY: 'activity',
  COMMERCIAL_CLOSE: 'commercial_close',
})

export const AUTOMATION_SOURCE_DOMAINS = Object.freeze(
  Object.values(AUTOMATION_SOURCE_DOMAIN),
)

/** Domains that may produce accepted AutomationEvents in H16.2. */
export const AUTOMATION_INTAKE_SOURCE_DOMAINS = Object.freeze([
  AUTOMATION_SOURCE_DOMAIN.LIVING,
  AUTOMATION_SOURCE_DOMAIN.FOLLOWUP,
  AUTOMATION_SOURCE_DOMAIN.WORKFLOW,
  AUTOMATION_SOURCE_DOMAIN.PORTAL,
  AUTOMATION_SOURCE_DOMAIN.INTERACTION,
])

export const AUTOMATION_INTAKE_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  DUPLICATE: 'duplicate',
  IGNORED: 'ignored',
  REJECTED: 'rejected',
})

export const AUTOMATION_INTAKE_STATUSES = Object.freeze(
  Object.values(AUTOMATION_INTAKE_STATUS),
)

export const AUTOMATION_INTAKE_REASON = Object.freeze({
  COMPANY_REQUIRED: 'company_required',
  COMPANY_MISMATCH: 'company_mismatch',
  MALFORMED_EVENT: 'malformed_event',
  UNSUPPORTED_EVENT: 'unsupported_event',
  UNSUPPORTED_DOMAIN: 'unsupported_domain',
  MISSING_SOURCE_IDENTITY: 'missing_source_identity',
  CANONICAL_SOURCE_ELSEWHERE: 'canonical_source_elsewhere',
  PROVIDER_WEBHOOK_FORBIDDEN: 'provider_webhook_forbidden',
  INTAKE_DISABLED: 'intake_disabled',
  DUPLICATE: 'duplicate',
})

/**
 * Canonical source for facts that can arrive on multiple paths.
 * Living owns client engagement mirrors; interaction lifecycle emits remain
 * interaction.* (created/acked/resolved) and are not engagement duplicates.
 */
export const AUTOMATION_CANONICAL_SOURCE = Object.freeze({
  [AUTOMATION_SOURCE_DOMAIN.LIVING]: AUTOMATION_SOURCE_DOMAIN.LIVING,
  [AUTOMATION_SOURCE_DOMAIN.FOLLOWUP]: AUTOMATION_SOURCE_DOMAIN.FOLLOWUP,
  [AUTOMATION_SOURCE_DOMAIN.WORKFLOW]: AUTOMATION_SOURCE_DOMAIN.WORKFLOW,
  [AUTOMATION_SOURCE_DOMAIN.PORTAL]: AUTOMATION_SOURCE_DOMAIN.PORTAL,
  [AUTOMATION_SOURCE_DOMAIN.INTERACTION]: AUTOMATION_SOURCE_DOMAIN.INTERACTION,
})
