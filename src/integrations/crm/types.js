/**
 * H16.6 — Vendor-neutral CRM contracts.
 *
 * Sync consumer boundary for recorded H16.4 `crm` intents.
 * Not an outbox, worker, retry scheduler, OAuth flow, or vendor SDK.
 */

export const CRM_SCHEMA_VERSION = 1

/** Reserved for a future non-mock provider transport. Real network stays OFF in H16.6. */
export const CRM_PROVIDER_NETWORK_ENV = 'CRM_PROVIDER_NETWORK'

export const CRM_PROVIDER_ID = Object.freeze({
  NULL: 'null_crm',
  MOCK: 'mock_crm',
})

export const CRM_PROVIDER_IDS = Object.freeze(Object.values(CRM_PROVIDER_ID))

export const CRM_CONNECTION_STATUS = Object.freeze({
  DISABLED: 'disabled',
  CONFIGURED: 'configured',
  ENABLED: 'enabled',
})

export const CRM_CONNECTION_STATUSES = Object.freeze(
  Object.values(CRM_CONNECTION_STATUS),
)

/** Approved H16.6 v1 universal operations. Nothing vendor-specific. */
export const CRM_OPERATION = Object.freeze({
  UPSERT_CONTACT: 'upsert_contact',
  UPSERT_COMPANY: 'upsert_company',
  UPSERT_DEAL: 'upsert_deal',
  CREATE_NOTE: 'create_note',
})

export const CRM_OPERATIONS = Object.freeze(Object.values(CRM_OPERATION))

export const CRM_RECORD_TYPE = Object.freeze({
  CONTACT: 'contact',
  COMPANY: 'company',
  DEAL: 'deal',
  NOTE: 'note',
})

export const CRM_RECORD_TYPES = Object.freeze(Object.values(CRM_RECORD_TYPE))

export const CRM_RECORD_TYPE_BY_OPERATION = Object.freeze({
  [CRM_OPERATION.UPSERT_CONTACT]: CRM_RECORD_TYPE.CONTACT,
  [CRM_OPERATION.UPSERT_COMPANY]: CRM_RECORD_TYPE.COMPANY,
  [CRM_OPERATION.UPSERT_DEAL]: CRM_RECORD_TYPE.DEAL,
  [CRM_OPERATION.CREATE_NOTE]: CRM_RECORD_TYPE.NOTE,
})

/** Bounded universal fields per record type. No vendor object names, no money. */
export const CRM_RECORD_FIELDS = Object.freeze({
  [CRM_RECORD_TYPE.CONTACT]: Object.freeze([
    'email',
    'fullName',
    'phone',
    'proposalId',
  ]),
  [CRM_RECORD_TYPE.COMPANY]: Object.freeze(['name', 'domain']),
  [CRM_RECORD_TYPE.DEAL]: Object.freeze([
    'name',
    'stage',
    'proposalId',
    'contactExternalKey',
    'companyExternalKey',
  ]),
  [CRM_RECORD_TYPE.NOTE]: Object.freeze([
    'body',
    'relatedExternalKey',
    'relatedType',
  ]),
})

/**
 * Monetary/commercial fields are never mapped in H16.6 v1.
 * H16.4 sanitization already strips most of these; this is a second wall.
 */
export const CRM_FORBIDDEN_RECORD_FIELDS = Object.freeze([
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
])

export const CRM_OUTCOME_STATUS = Object.freeze({
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REJECTED: 'rejected',
})

export const CRM_OUTCOME_STATUSES = Object.freeze(Object.values(CRM_OUTCOME_STATUS))

export const CRM_FAILURE_CODE = Object.freeze({
  INVALID_CONFIGURATION: 'invalid_configuration',
  CONNECTION_DISABLED: 'connection_disabled',
  INTENT_CANCELLED: 'intent_cancelled',
  CAPABILITY_DISABLED: 'capability_disabled',
  PROVIDER_DISABLED: 'provider_disabled',
  AUTH_FAILURE: 'auth_failure',
  NOT_FOUND: 'not_found',
  VALIDATION_FAILURE: 'validation_failure',
  RATE_LIMITED: 'rate_limited',
  NETWORK_FAILURE: 'network_failure',
  TIMEOUT: 'timeout',
  PROVIDER_ERROR: 'provider_error',
  UNSUPPORTED_OPERATION: 'unsupported_operation',
})

export const CRM_FAILURE_CODES = Object.freeze(Object.values(CRM_FAILURE_CODE))

/** Bounded, non-secret connection settings. No provider base URLs. */
export const CRM_CONNECTION_CONFIG_KEYS = Object.freeze([
  'pipelineLabel',
  'defaultStage',
  'ownerLabel',
  'environmentLabel',
])

export const CRM_LIMITS = Object.freeze({
  MAX_NAME: 120,
  MAX_ID: 128,
  MAX_FIELD_VALUE: 200,
  MAX_NOTE_BODY: 500,
  MAX_RECORD_FIELDS: 8,
  MAX_CONFIG_KEYS: 8,
  MAX_CONFIG_VALUE: 120,
  MAX_ERROR: 200,
  MAX_RESULT_KEYS: 6,
})
