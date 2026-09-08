export {
  NULL_INTEGRATION_ADAPTER_ID,
  NULL_INTEGRATION_ADAPTER_IDS,
  makeIntegrationAdapterDescriptor,
} from './types.js'
export {
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
} from './adapter.js'
