/**
 * H16.16 Slice 16.2 — Fail-closed delivery execute.
 * Independent consume checks. Does not nest other verifiers.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  AUTOMATION_ACTION_INTENT_STATUS,
  AUTOMATION_RULE_ACTION_TYPE,
  DELIVERY_EXECUTION_STATUS,
  DELIVERY_FAILURE_CODE,
  DELIVERY_OUTCOME_STATUS,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  allAutomationActionIntents,
  cancelAutomationActionIntent,
  cloneDeliveryExecutionOutcome,
  createNullDeliveryAdapter,
  executeDeliveryForIntent,
  findDeliveryOutcomeByIntentId,
  listDeliveryOutcomesForCompany,
  makeAutomationActionIntent,
  makeDeliveryExecutionRequest,
  presentStudioDeliveryExecutionOutcome,
  recordAutomationActionIntent,
  resetAutomationActionIntentStore,
  resetDeliveryOutcomeStore,
  setDeliveryExecutionCapabilityOverrideForTests,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const executeSource = readFileSync(
  join(root, 'src/integrations/delivery/execute.js'),
  'utf8',
)
const outcomesSource = readFileSync(
  join(root, 'src/integrations/delivery/outcomes.js'),
  'utf8',
)
const schemaSource = readFileSync(
  join(root, 'src/integrations/delivery/schema.js'),
  'utf8',
)
const typesSource = readFileSync(join(root, 'src/integrations/delivery/types.js'), 'utf8')
const indexSource = readFileSync(join(root, 'src/integrations/delivery/index.js'), 'utf8')
const deliverySource = `${typesSource}\n${schemaSource}\n${indexSource}\n${executeSource}\n${outcomesSource}`

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}`)
}

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function plant({ kind, actionType, companyId = DEFAULT_COMPANY_ID, extra = {} }) {
  return recordAutomationActionIntent(
    makeAutomationActionIntent({
      companyId,
      kind,
      actionType,
      eventId: extra.eventId || `evt-${kind}-${actionType}-${companyId}`,
      ruleId: extra.ruleId || 'rule-h1616-2',
      ruleVersion: 1,
      actionIndex: extra.actionIndex ?? 0,
      payload: extra.payload ?? { note: 'safe-note' },
      correlation: extra.correlation ?? { proposalId: 'prop-studio-1' },
    }),
  ).intent
}

function rejectedCodes(code) {
  return (
    code === DELIVERY_FAILURE_CODE.CAPABILITY_DISABLED ||
    code === DELIVERY_FAILURE_CODE.ADAPTER_DISABLED
  )
}

resetAutomationActionIntentStore({ intents: [] })
resetDeliveryOutcomeStore({ outcomes: [] })
setDeliveryExecutionCapabilityOverrideForTests(null)

const recorded = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-h1616-2-recorded' },
})
const authorized = makeDeliveryExecutionRequest(recorded, DEFAULT_COMPANY_ID)
const executed = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
const presented = presentStudioDeliveryExecutionOutcome(executed.outcome)

assert(
  '1. recorded enqueue_delivery_intent execute returns ok:false',
  executed.ok === false && executed.duplicate === false,
)
assert(
  '2. outcome status is rejected',
  executed.outcome.status === DELIVERY_OUTCOME_STATUS.REJECTED &&
    executed.outcome.status === 'rejected',
)
assert(
  '3. failure code is capability_disabled and/or adapter_disabled',
  rejectedCodes(executed.outcome.failureCode),
)
assert('4. adapterId is null_delivery', executed.outcome.adapterId === 'null_delivery')
assert('5. network=false', executed.outcome.network === false)
assert('6. oauth=false', executed.outcome.oauth === false)

const afterExecute = allAutomationActionIntents()
assert(
  '7. intent remains recorded',
  afterExecute.some(
    (row) =>
      row.id === recorded.id && row.status === AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
  ),
)
assert('8. no extra intent row', afterExecute.length === 1)

const replay = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
assert(
  '9. replay returns same outcome with duplicate=true',
  replay.ok === false &&
    replay.duplicate === true &&
    replay.outcome.intentId === executed.outcome.intentId &&
    replay.outcome.idempotencyKey === executed.outcome.idempotencyKey &&
    replay.outcome.failureCode === executed.outcome.failureCode &&
    afterExecute.length === allAutomationActionIntents().length,
)

const foreign = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  extra: { eventId: 'evt-h1616-2-foreign' },
})
const crossTenant = threw(() =>
  executeDeliveryForIntent({
    companyId: DEFAULT_COMPANY_ID,
    intentId: foreign.id,
  }),
)
assert(
  '10. cross-tenant execution fails closed',
  crossTenant instanceof ForbiddenError &&
    findDeliveryOutcomeByIntentId(foreign.id) == null,
)

const cancelled = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-h1616-2-cancelled' },
})
cancelAutomationActionIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: cancelled.id,
})
const cancelledResult = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: cancelled.id,
})
const cancelledIntent = allAutomationActionIntents().find((row) => row.id === cancelled.id)
assert(
  '11. cancelled intent remains cancelled',
  cancelledIntent?.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED,
)
assert(
  '12. cancelled intent is never sent',
  cancelledResult.ok === false &&
    cancelledResult.outcome.status === DELIVERY_OUTCOME_STATUS.REJECTED &&
    cancelledResult.outcome.failureCode === DELIVERY_FAILURE_CODE.INTENT_CANCELLED &&
    cancelledResult.request == null,
)

const malformed = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT,
  extra: { eventId: 'evt-h1616-2-malformed' },
})
const malformedError = threw(() =>
  executeDeliveryForIntent({
    companyId: DEFAULT_COMPANY_ID,
    intentId: malformed.id,
  }),
)
assert(
  '12b. malformed delivery-kind intent that fails 16.1 creates no outcome',
  malformedError instanceof ValidationError &&
    malformedError.errors?.[0]?.field === 'actionType' &&
    findDeliveryOutcomeByIntentId(malformed.id) == null,
)
assert(
  '12c. original 16.1 ValidationError is propagated',
  malformedError instanceof ValidationError &&
    /enqueue_delivery_intent/.test(malformedError.message),
)

const crmIntent = plant({
  kind: INTEGRATION_KIND.CRM,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT,
  extra: { eventId: 'evt-h1616-2-crm' },
})
const crmError = threw(() =>
  executeDeliveryForIntent({
    companyId: DEFAULT_COMPANY_ID,
    intentId: crmIntent.id,
  }),
)
assert(
  '13. CRM intent gets no delivery outcome',
  crmError instanceof ValidationError && findDeliveryOutcomeByIntentId(crmIntent.id) == null,
)

const webhookIntent = plant({
  kind: INTEGRATION_KIND.OUTBOUND_WEBHOOK,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
  extra: { eventId: 'evt-h1616-2-webhook' },
})
assert(
  '14. outboundWebhook intent gets no delivery outcome',
  threw(() =>
    executeDeliveryForIntent({
      companyId: DEFAULT_COMPANY_ID,
      intentId: webhookIntent.id,
    }),
  ) instanceof ValidationError && findDeliveryOutcomeByIntentId(webhookIntent.id) == null,
)

const calendarIntent = plant({
  kind: INTEGRATION_KIND.CALENDAR,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CALENDAR_INTENT,
  extra: { eventId: 'evt-h1616-2-calendar' },
})
assert(
  '15. calendar intent gets no delivery outcome',
  threw(() =>
    executeDeliveryForIntent({
      companyId: DEFAULT_COMPANY_ID,
      intentId: calendarIntent.id,
    }),
  ) instanceof ValidationError && findDeliveryOutcomeByIntentId(calendarIntent.id) == null,
)

const messagingIntent = plant({
  kind: INTEGRATION_KIND.MESSAGING,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_MESSAGING_INTENT,
  extra: { eventId: 'evt-h1616-2-messaging' },
})
assert(
  '16. messaging intent gets no delivery outcome',
  threw(() =>
    executeDeliveryForIntent({
      companyId: DEFAULT_COMPANY_ID,
      intentId: messagingIntent.id,
    }),
  ) instanceof ValidationError && findDeliveryOutcomeByIntentId(messagingIntent.id) == null,
)

assert(
  '17. missing companyId fails closed',
  threw(() => executeDeliveryForIntent({ companyId: '', intentId: recorded.id })) instanceof
    ValidationError &&
    threw(() => executeDeliveryForIntent({ intentId: recorded.id })) instanceof
      ValidationError,
)
assert(
  '18. missing intentId fails closed',
  threw(() =>
    executeDeliveryForIntent({ companyId: DEFAULT_COMPANY_ID, intentId: '' }),
  ) instanceof ValidationError &&
    threw(() => executeDeliveryForIntent({ companyId: DEFAULT_COMPANY_ID })) instanceof
      ValidationError,
)

assert(
  '19. capability remains false',
  INTEGRATION_CAPABILITIES.deliveryExecution === false,
)
assert(
  '20. all other disabled capabilities remain false',
  INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

const overrideIntent = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-h1616-2-override' },
})
setDeliveryExecutionCapabilityOverrideForTests(true)
let overrideResult
try {
  overrideResult = executeDeliveryForIntent({
    companyId: DEFAULT_COMPANY_ID,
    intentId: overrideIntent.id,
  })
} finally {
  setDeliveryExecutionCapabilityOverrideForTests(null)
}
assert(
  '21. capability override=true still rejects because null_delivery is disabled',
  overrideResult.ok === false &&
    overrideResult.outcome.failureCode === DELIVERY_FAILURE_CODE.ADAPTER_DISABLED &&
    INTEGRATION_CAPABILITIES.deliveryExecution === false,
)

const nullDelivery = createNullDeliveryAdapter()
assert(
  '22. null_delivery.isEnabled() remains false',
  nullDelivery.isEnabled({}) === false && nullDelivery.isEnabled({ enabled: true }) === false,
)

assert(
  '23. no fetch/http/nodemailer/smtp',
  !/\bfetch\b/.test(deliverySource) &&
    !/nodemailer/.test(deliverySource) &&
    !/\bsmtp\b/i.test(executeSource) &&
    !/\bhttps?:\/\//.test(executeSource) &&
    !outcomesSource.includes('createServer') &&
    !executeSource.includes('http.request'),
)
assert(
  '24. no vendor SDK',
  !/twilio|sendgrid|mailgun|postmark|nodemailer|stripe/i.test(deliverySource) &&
    !executeSource.includes('vendorSdk') &&
    !outcomesSource.includes('vendorSdk'),
)
assert(
  '25. no worker/queue/retry',
  !/createWorker|Bull|Agenda|setInterval|queue|leasing|DLQ/.test(executeSource) &&
    !/createWorker|Bull|Agenda/.test(outcomesSource),
)
assert(
  '26. no executeOutboundWebhookForIntent',
  !deliverySource.includes('executeOutboundWebhookForIntent'),
)
assert(
  '27. no CRM applyMutation',
  !deliverySource.includes('applyMutation') && !deliverySource.includes('executeCrmIntent'),
)
assert(
  '28. no H15 CommercialClose/providers',
  !deliverySource.includes('commercialClose') &&
    !deliverySource.includes('commercialClose/providers'),
)
assert(
  '29. no H16.15 activity write/archive',
  !deliverySource.includes('createStudioActivity') &&
    !deliverySource.includes('createAgentOriginActivity') &&
    !deliverySource.includes('archiveAgentOriginActivity') &&
    !deliverySource.includes('agentOriginWrite') &&
    !deliverySource.includes('agentOriginArchive'),
)

const deliveryFiles = existsSync(join(root, 'src/integrations/delivery'))
  ? readdirSync(join(root, 'src/integrations/delivery'))
      .filter((name) => name.endsWith('.js'))
      .sort()
  : []
assert(
  '30. no transport.js/oauth.js/store.js/outbox',
  deliveryFiles.join(',') === 'execute.js,index.js,outcomes.js,schema.js,types.js' &&
    !existsSync(join(root, 'src/integrations/delivery/transport.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/oauth.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/store.js')) &&
    !existsSync(join(root, 'src/integrations/outbox')),
)
assert('31. no mock_delivery', !deliverySource.includes('mock_delivery'))
assert(
  '32. no successful/executing delivery status',
  !typesSource.includes('SUCCEEDED') &&
    !typesSource.includes('SENT') &&
    !typesSource.includes('DELIVERED') &&
    !typesSource.includes('EXECUTING') &&
    executed.outcome.status === 'rejected',
)
assert(
  '32b. execute does not record INVALID_CONFIGURATION on 16.1 ValidationError',
  !executeSource.includes('INVALID_CONFIGURATION'),
)

const stillAuthorized = makeDeliveryExecutionRequest(recorded, DEFAULT_COMPANY_ID)
assert(
  '33. 16.1 makeDeliveryExecutionRequest still returns authorized',
  stillAuthorized.status === DELIVERY_EXECUTION_STATUS.AUTHORIZED &&
    authorized.status === DELIVERY_EXECUTION_STATUS.AUTHORIZED,
)
assert(
  '34. 16.1 does not write an outcome',
  executeSource.includes('makeDeliveryExecutionRequest') &&
    !schemaSource.includes('recordDeliveryOutcome') &&
    !schemaSource.includes("from './outcomes.js'"),
)
assert(
  '35. outcome is tenant scoped',
  executed.outcome.companyId === DEFAULT_COMPANY_ID &&
    listDeliveryOutcomesForCompany(WORKFLOW_ISOLATION_COMPANY_ID).every(
      (row) => row.companyId === WORKFLOW_ISOLATION_COMPANY_ID,
    ),
)
assert(
  '36. outcome idempotencyKey exactly matches intent',
  executed.outcome.idempotencyKey === recorded.idempotencyKey,
)

const cloneFails = [
  threw(() => cloneDeliveryExecutionOutcome({ ...executed.outcome, intentId: '' })),
  threw(() => cloneDeliveryExecutionOutcome({ ...executed.outcome, idempotencyKey: '' })),
  threw(() => cloneDeliveryExecutionOutcome({ ...executed.outcome, status: 'succeeded' })),
  threw(() => cloneDeliveryExecutionOutcome({ ...executed.outcome, adapterId: 'http' })),
  threw(() => cloneDeliveryExecutionOutcome({ ...executed.outcome, network: true })),
  threw(() => cloneDeliveryExecutionOutcome({ ...executed.outcome, oauth: true })),
]
assert(
  '37. malformed outcome clone fails closed',
  cloneFails.every((error) => error instanceof ValidationError),
)
assert(
  '38. outcome remains frozen',
  Object.isFrozen(executed.outcome) &&
    Object.isFrozen(presented) &&
    Object.isFrozen(replay.outcome),
)

resetDeliveryOutcomeStore({ outcomes: [] })
assert(
  '39. ledger reset works',
  findDeliveryOutcomeByIntentId(recorded.id) == null &&
    listDeliveryOutcomesForCompany(DEFAULT_COMPANY_ID).length === 0,
)

const studioAgain = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-h1616-2-list-studio' },
})
const otherAgain = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  extra: { eventId: 'evt-h1616-2-list-other' },
})
executeDeliveryForIntent({ companyId: DEFAULT_COMPANY_ID, intentId: studioAgain.id })
executeDeliveryForIntent({
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  intentId: otherAgain.id,
})
const studioList = listDeliveryOutcomesForCompany(DEFAULT_COMPANY_ID)
const otherList = listDeliveryOutcomesForCompany(WORKFLOW_ISOLATION_COMPANY_ID)
assert(
  '40. listDeliveryOutcomesForCompany cannot expose another tenant',
  studioList.every((row) => row.companyId === DEFAULT_COMPANY_ID) &&
    otherList.every((row) => row.companyId === WORKFLOW_ISOLATION_COMPANY_ID) &&
    !studioList.some((row) => row.intentId === otherAgain.id) &&
    !otherList.some((row) => row.intentId === studioAgain.id),
)

const foreignOutcome = threw(() =>
  executeDeliveryForIntent({
    companyId: DEFAULT_COMPANY_ID,
    intentId: otherAgain.id,
  }),
)
assert(
  '40b. existing other-tenant outcome is not leaked',
  foreignOutcome instanceof ForbiddenError,
)

resetAutomationActionIntentStore({ intents: [] })
resetDeliveryOutcomeStore({ outcomes: [] })
setDeliveryExecutionCapabilityOverrideForTests(null)

console.log('')
console.log(`H16.16 delivery-execute checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
