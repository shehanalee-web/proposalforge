export {
  AUTOMATION_EVENT_SCHEMA_VERSION,
  AUTOMATION_SOURCE_DOMAIN,
  AUTOMATION_SOURCE_DOMAINS,
  AUTOMATION_INTAKE_SOURCE_DOMAINS,
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_INTAKE_STATUSES,
  AUTOMATION_INTAKE_REASON,
  AUTOMATION_CANONICAL_SOURCE,
} from './types.js'

export {
  sanitizeAutomationPayload,
  makeAutomationEventSource,
  makeAutomationEventCorrelation,
  makeAutomationIdempotencyKey,
  makeAutomationEvent,
  cloneAutomationEvent,
  presentClientAutomationEvent,
  presentStudioAutomationEvent,
  makeAutomationIntakeReceipt,
} from './schema.js'

export { normalizeDomainEvent } from './normalize.js'

export {
  configureAutomationIntakeStore,
  allAutomationEvents,
  allAutomationIntakeReceipts,
  replaceAutomationIntakeLedger,
  resetAutomationIntakeStore,
  serializeAutomationIntakeLedger,
  findAutomationIntakeReceipt,
  findAutomationEventById,
  getAutomationEventById,
  listAcceptedAutomationEventsForCompany,
  listAutomationIntakeReceiptsForCompany,
  recordAcceptedAutomationIntake,
  recordAutomationIntakeReceiptOnly,
} from './store.js'

export {
  ingestAutomationEvent,
  normalizeDomainEventForIntake,
} from './intake.js'

export {
  startAutomationEventIntake,
  stopAutomationEventIntake,
  isAutomationEventIntakeRunning,
} from './subscribe.js'

export {
  fanoutDomainEmission,
  fanoutFollowupEmission,
  fanoutWorkflowEmission,
  fanoutPortalEmission,
  fanoutInteractionEmission,
} from './fanout.js'
