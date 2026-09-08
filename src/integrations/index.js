/**
 * H16.1 — Integration Foundation public surface.
 *
 * Event intake, rules, outbox, delivery execution, and vendor SDKs are out of
 * scope. CommercialClose provider adapters remain exclusively under H15.6.
 */

export {
  INTEGRATION_KIND,
  INTEGRATION_KINDS,
  INTEGRATION_KIND_LABELS,
  INTEGRATION_STATUS,
  INTEGRATION_STATUSES,
  INTEGRATION_STATUS_LABELS,
  INTEGRATION_REJECTION_REASON,
  INTEGRATION_CAPABILITIES,
  DEFAULT_COMPANY_ID,
  INTEGRATION_ISOLATION_COMPANY_ID,
} from './types.js'

export {
  SECRET_REF_PATTERN,
  normalizeSecretRef,
  assertNoSecretValues,
  makeSecretRefs,
  makeIntegrationConfig,
  cloneIntegrationConfig,
  presentClientIntegrationConfig,
  presentStudioIntegrationConfig,
  serializeIntegrationConfig,
  integrationConfigHasSecretMaterial,
} from './schema.js'

export {
  configureIntegrationConfigStore,
  allIntegrationConfigs,
  replaceIntegrationConfigs,
  resetIntegrationConfigStore,
  assertIntegrationCompanyScope,
  evaluateIntegrationCompanyScope,
  listIntegrationConfigsForCompany,
  getIntegrationConfigForCompany,
  upsertIntegrationConfigForCompany,
  deleteIntegrationConfigForCompany,
} from './config.js'

export {
  NULL_INTEGRATION_ADAPTER_ID,
  NULL_INTEGRATION_ADAPTER_IDS,
  makeIntegrationAdapterDescriptor,
  registerIntegrationAdapter,
  getIntegrationAdapter,
  listIntegrationAdapters,
  resetIntegrationAdapterRegistry,
  createNullDeliveryAdapter,
  createNullCrmAdapter,
  createNullCalendarAdapter,
  createNullMessagingAdapter,
  createNullOutboundWebhookAdapter,
  registerNullIntegrationAdapters,
  resolveEnabledIntegrationAdapter,
} from './adapters/index.js'

export {
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
  rejectIntegrationBoundary,
} from './boundaries.js'
