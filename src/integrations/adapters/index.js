export {
  NULL_INTEGRATION_ADAPTER_ID,
  NULL_INTEGRATION_ADAPTER_IDS,
  HTTP_OUTBOUND_WEBHOOK_ADAPTER_ID,
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
  createHttpOutboundWebhookAdapter,
  registerNullIntegrationAdapters,
  resolveEnabledIntegrationAdapter,
} from './adapter.js'
