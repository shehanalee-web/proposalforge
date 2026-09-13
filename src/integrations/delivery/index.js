/**
 * H16.16 — Delivery execution barrel.
 *
 * Slice 16.1: authorization contract.
 * Slice 16.2: fail-closed execute + in-memory rejected outcome ledger.
 * No transport, OAuth, store.js, or outbox.
 */

export {
  DELIVERY_EXECUTION_SCHEMA_VERSION,
  DELIVERY_EXECUTION_STATUS,
  DELIVERY_EXECUTION_STATUSES,
  DELIVERY_EXECUTION_FORBIDDEN_FIELDS,
  DELIVERY_OUTCOME_STATUS,
  DELIVERY_OUTCOME_STATUSES,
  DELIVERY_FAILURE_CODE,
  DELIVERY_FAILURE_CODES,
} from './types.js'

export {
  makeDeliveryExecutionRequest,
  cloneDeliveryExecutionRequest,
  presentStudioDeliveryExecutionRequest,
  makeDeliveryExecutionOutcome,
  cloneDeliveryExecutionOutcome,
  presentStudioDeliveryExecutionOutcome,
} from './schema.js'

export {
  findDeliveryOutcomeByIntentId,
  listDeliveryOutcomesForCompany,
  resetDeliveryOutcomeStore,
} from './outcomes.js'

export {
  setDeliveryExecutionCapabilityOverrideForTests,
  executeDeliveryForIntent,
} from './execute.js'
