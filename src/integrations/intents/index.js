/**
 * H16.4 — Automation Action Intent public surface.
 */

export {
  AUTOMATION_ACTION_INTENT_SCHEMA_VERSION,
  AUTOMATION_ACTION_INTENT_STATUS,
  AUTOMATION_ACTION_INTENT_STATUSES,
  AUTOMATION_ACTION_INTENT_LIMITS,
  AUTOMATION_ACTION_INTENT_CANCEL_REASON,
} from './types.js'

export {
  makeAutomationActionIntentIdempotencyKey,
  makeAutomationActionIntent,
  cloneAutomationActionIntent,
  presentStudioAutomationActionIntent,
} from './schema.js'

export {
  configureAutomationActionIntentStore,
  allAutomationActionIntents,
  replaceAutomationActionIntents,
  resetAutomationActionIntentStore,
  serializeAutomationActionIntents,
  findAutomationActionIntentById,
  findAutomationActionIntentByIdempotencyKey,
  getAutomationActionIntentForCompany,
  listAutomationActionIntentsForCompany,
  recordAutomationActionIntent,
  cancelAutomationActionIntent,
} from './store.js'

export {
  isDeferredEnqueueActionType,
  kindForDeferredEnqueueAction,
  recordDeferredAutomationActionIntent,
} from './record.js'

export {
  listStudioAutomationActionIntents,
  getStudioAutomationActionIntent,
  cancelStudioAutomationActionIntent,
} from './repository.js'
