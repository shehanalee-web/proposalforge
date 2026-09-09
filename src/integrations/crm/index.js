/**
 * H16.6 — CRM public surface.
 *
 * Vendor-neutral sync consumer for H16.4 `crm` intents.
 * mock_crm is in-process only. No OAuth, no vendor SDKs, no network.
 */

export {
  CRM_SCHEMA_VERSION,
  CRM_PROVIDER_NETWORK_ENV,
  CRM_PROVIDER_ID,
  CRM_PROVIDER_IDS,
  CRM_CONNECTION_STATUS,
  CRM_CONNECTION_STATUSES,
  CRM_CONNECTION_CONFIG_KEYS,
  CRM_OPERATION,
  CRM_OPERATIONS,
  CRM_RECORD_TYPE,
  CRM_RECORD_TYPES,
  CRM_RECORD_TYPE_BY_OPERATION,
  CRM_RECORD_FIELDS,
  CRM_FORBIDDEN_RECORD_FIELDS,
  CRM_OUTCOME_STATUS,
  CRM_OUTCOME_STATUSES,
  CRM_FAILURE_CODE,
  CRM_FAILURE_CODES,
  CRM_LIMITS,
} from './types.js'

export {
  normalizeCrmConnectionConfig,
  normalizeCrmCredentialRefs,
  makeCrmConnection,
  cloneCrmConnection,
  presentStudioCrmConnection,
  serializeCrmConnection,
  sanitizeCrmResult,
  makeCrmExecutionOutcome,
  cloneCrmExecutionOutcome,
  presentStudioCrmExecutionOutcome,
} from './schema.js'

export {
  configureCrmConnectionStore,
  allCrmConnections,
  replaceCrmConnections,
  resetCrmConnectionStore,
  serializeCrmConnections,
  listCrmConnectionsForCompany,
  getCrmConnectionForCompany,
  upsertCrmConnectionForCompany,
  setCrmConnectionEnabled,
  deleteCrmConnectionForCompany,
} from './connections.js'

export {
  collectCrmRecordInput,
  extractCrmRecord,
  makeCrmExternalKey,
  buildCrmMutation,
} from './mapping.js'

export {
  registerCrmAdapter,
  getCrmAdapter,
  listCrmAdapters,
  clearCrmAdapterRegistry,
  normalizeCrmAdapterResult,
} from './adapter.js'

export {
  registerBuiltInCrmAdapters,
  createNullCrmAdapter,
  createMockCrmAdapter,
  resetMockCrmRecords,
  setMockCrmFailureForTests,
  clearMockCrmFailureForTests,
  getMockCrmRecord,
  listMockCrmRecords,
} from './adapters.js'

export {
  configureCrmOutcomeStore,
  allCrmOutcomes,
  replaceCrmOutcomes,
  resetCrmOutcomeStore,
  serializeCrmOutcomes,
  findCrmOutcomeByIntentId,
  listCrmOutcomesForCompany,
  getCrmOutcomeForCompany,
  recordCrmOutcome,
} from './outcomes.js'

export {
  CRM_INTENT_ACTION_TYPE,
  setCrmCapabilityOverrideForTests,
  isCrmCapabilityEnabled,
  executeCrmIntent,
} from './execute.js'

export {
  listStudioCrmConnections,
  getStudioCrmConnection,
  upsertStudioCrmConnection,
  patchStudioCrmConnection,
  deleteStudioCrmConnection,
  listStudioCrmOutcomes,
  getStudioCrmOutcome,
  executeStudioCrmIntent,
} from './repository.js'
