/**
 * H16.5 — Outbound webhook public surface.
 *
 * Sync consumer for H16.4 outboundWebhook intents.
 * Live HTTPS requires OUTBOUND_WEBHOOK_NETWORK=1.
 * Not an outbox, worker, retry scheduler, or inbound ingress.
 */

export {
  OUTBOUND_WEBHOOK_SCHEMA_VERSION,
  OUTBOUND_WEBHOOK_ENVELOPE_TYPE,
  OUTBOUND_WEBHOOK_NETWORK_ENV,
  OUTBOUND_WEBHOOK_DESTINATION_STATUS,
  OUTBOUND_WEBHOOK_DESTINATION_STATUSES,
  OUTBOUND_WEBHOOK_OUTCOME_STATUS,
  OUTBOUND_WEBHOOK_OUTCOME_STATUSES,
  OUTBOUND_WEBHOOK_FAILURE_CODE,
  OUTBOUND_WEBHOOK_FAILURE_CODES,
  OUTBOUND_WEBHOOK_ALLOWED_HEADERS,
  OUTBOUND_WEBHOOK_BLOCKED_HEADERS,
  OUTBOUND_WEBHOOK_LIMITS,
  HTTP_OUTBOUND_WEBHOOK_ADAPTER_ID,
} from './types.js'

export {
  normalizeOutboundWebhookHeaders,
  makeOutboundWebhookDestination,
  cloneOutboundWebhookDestination,
  presentStudioOutboundWebhookDestination,
  serializeOutboundWebhookDestination,
  makeOutboundWebhookDeliveryOutcome,
  cloneOutboundWebhookDeliveryOutcome,
  presentStudioOutboundWebhookDeliveryOutcome,
  sanitizeOutboundWebhookData,
} from './schema.js'

export {
  configureOutboundWebhookDestinationStore,
  allOutboundWebhookDestinations,
  replaceOutboundWebhookDestinations,
  resetOutboundWebhookDestinationStore,
  serializeOutboundWebhookDestinations,
  listOutboundWebhookDestinationsForCompany,
  getOutboundWebhookDestinationForCompany,
  upsertOutboundWebhookDestinationForCompany,
  setOutboundWebhookDestinationEnabled,
  deleteOutboundWebhookDestinationForCompany,
} from './destinations.js'

export {
  configureOutboundWebhookOutcomeStore,
  allOutboundWebhookOutcomes,
  replaceOutboundWebhookOutcomes,
  resetOutboundWebhookOutcomeStore,
  serializeOutboundWebhookOutcomes,
  findOutboundWebhookOutcomeByIntentId,
  listOutboundWebhookOutcomesForCompany,
  getOutboundWebhookOutcomeForCompany,
  recordOutboundWebhookOutcome,
} from './outcomes.js'

export {
  stableStringify,
  buildOutboundWebhookEnvelope,
  serializeOutboundWebhookEnvelope,
} from './envelope.js'

export {
  setOutboundWebhookTestSecrets,
  clearOutboundWebhookTestSecrets,
  resolveOutboundWebhookSecretRef,
} from './secrets.js'

export {
  signOutboundWebhookBody,
  buildOutboundWebhookSignatureHeaders,
} from './sign.js'

export {
  setOutboundWebhookDnsResolverForTests,
  expandOutboundWebhookIpv6,
  extractIpv4FromMappedIpv6,
  normalizeOutboundWebhookIp,
  isBlockedOutboundWebhookIp,
  validateOutboundWebhookUrl,
} from './ssrf.js'

export {
  setOutboundWebhookTransportForTests,
  clearOutboundWebhookTransportForTests,
  isOutboundWebhookNetworkEnabled,
  createFakeOutboundWebhookTransport,
  createLiveOutboundWebhookTransport,
  getOutboundWebhookTransport,
  truncateOutboundWebhookResponseBody,
} from './transport.js'

export {
  setOutboundWebhooksCapabilityOverrideForTests,
  executeOutboundWebhookForIntent,
} from './execute.js'

export {
  listStudioOutboundWebhookDestinations,
  getStudioOutboundWebhookDestination,
  upsertStudioOutboundWebhookDestination,
  patchStudioOutboundWebhookDestination,
  deleteStudioOutboundWebhookDestination,
  listStudioOutboundWebhookOutcomes,
  getStudioOutboundWebhookOutcome,
  executeStudioOutboundWebhook,
} from './repository.js'
