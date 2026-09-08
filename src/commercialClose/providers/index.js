/**
 * H15.6 — CommercialClose provider adapter public surface.
 */

export {
  PROVIDER_KIND,
  PROVIDER_KINDS,
  NULL_PROVIDER_ID,
  PROVIDER_SIGNAL_OUTCOME,
  PROVIDER_SIGNAL_OUTCOMES,
  PROVIDER_APPLY_RESULT,
  PROVIDER_APPLY_RESULTS,
  PROVIDER_REJECTION_REASON,
  makeProviderRef,
  makeProviderEventEnvelope,
  makeProviderSignal,
  isValidProviderRef,
  isValidProviderEventEnvelope,
} from './types.js'

export {
  registerProviderAdapter,
  getProviderAdapter,
  listProviderAdapters,
  resetProviderAdapterRegistry,
  createNullSignatureAdapter,
  createNullPaymentAdapter,
  registerNullProviderAdapters,
  resolveEnabledProviderAdapter,
} from './adapter.js'

export {
  makeProviderIdempotencyKey,
  digestProviderPayload,
  resetProviderWebhookReceipts,
  hasProviderEventReceipt,
  recordProviderEventReceipt,
  normalizeProviderEvent,
  processProviderWebhookFoundation,
  evaluateProviderSignalOrdering,
  rejectUnknownProvider,
} from './webhook.js'

export {
  mapSignatureSignalToEvidence,
  mapPaymentSignalToEvidence,
} from './evidenceMap.js'

export {
  applyProviderSignatureSignal,
  applyProviderPaymentSignal,
} from './applySignal.js'
