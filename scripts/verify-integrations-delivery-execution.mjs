/**
 * H16.16 Slice 16.1 — Delivery execution contract.
 * Independent authorization checks. Does not nest other verifiers.
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
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  allAutomationActionIntents,
  cancelAutomationActionIntent,
  cloneDeliveryExecutionRequest,
  createNullDeliveryAdapter,
  makeAutomationActionIntent,
  makeDeliveryExecutionRequest,
  presentStudioDeliveryExecutionRequest,
  recordAutomationActionIntent,
  resetAutomationActionIntentStore,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schemaSource = readFileSync(
  join(root, 'src/integrations/delivery/schema.js'),
  'utf8',
)
const typesSource = readFileSync(join(root, 'src/integrations/delivery/types.js'), 'utf8')
const indexSource = readFileSync(join(root, 'src/integrations/delivery/index.js'), 'utf8')
const deliverySource = `${typesSource}\n${schemaSource}\n${indexSource}`

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
      eventId: extra.eventId || `evt-${kind}-${actionType}`,
      ruleId: extra.ruleId || 'rule-h1616-1',
      ruleVersion: 1,
      actionIndex: extra.actionIndex ?? 0,
      payload: extra.payload ?? { note: 'safe-note' },
      correlation: extra.correlation ?? { proposalId: 'prop-studio-1' },
    }),
  ).intent
}

resetAutomationActionIntentStore({ intents: [] })

const recorded = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
})
const authorized = makeDeliveryExecutionRequest(recorded, DEFAULT_COMPANY_ID)
const presented = presentStudioDeliveryExecutionRequest(authorized)
const cloned = cloneDeliveryExecutionRequest(authorized)

assert(
  '1. recorded enqueue_delivery_intent authorizes successfully',
  authorized.status === DELIVERY_EXECUTION_STATUS.AUTHORIZED &&
    Object.isFrozen(authorized) &&
    presented.status === authorized.status &&
    cloned.intentId === authorized.intentId,
)

function cloneFail(patch, field, name) {
  const error = threw(() => cloneDeliveryExecutionRequest({ ...authorized, ...patch }))
  assert(
    name,
    error instanceof ValidationError && error.errors?.[0]?.field === field,
  )
}

cloneFail({ intentId: '' }, 'intentId', '1b. clone missing intentId fails')
cloneFail({ idempotencyKey: '' }, 'idempotencyKey', '1c. clone missing idempotencyKey fails')
cloneFail(
  { actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT },
  'actionType',
  '1d. clone wrong actionType fails',
)
cloneFail({ adapterId: 'http_outbound_webhook' }, 'adapterId', '1e. clone wrong adapterId fails')
cloneFail({ network: true }, 'network', '1f. clone network=true fails')
cloneFail({ oauth: true }, 'oauth', '1g. clone oauth=true fails')

assert(
  '2. kind, actionType, adapterId, and status are the delivery contract',
  authorized.kind === INTEGRATION_KIND.DELIVERY &&
    authorized.actionType === AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT &&
    authorized.adapterId === 'null_delivery' &&
    authorized.status === 'authorized' &&
    authorized.channel === null &&
    authorized.network === false &&
    authorized.oauth === false,
)

assert(
  '3. companyId matches the scoped company',
  authorized.companyId === DEFAULT_COMPANY_ID && authorized.companyId === recorded.companyId,
)

assert(
  '4. intentId matches intent.id',
  authorized.intentId === recorded.id,
)

assert(
  '5. idempotencyKey is copied exactly',
  authorized.idempotencyKey === recorded.idempotencyKey,
)

assert(
  '6. payload and correlation are copied without rewriting',
  authorized.payload.note === recorded.payload.note &&
    authorized.payload.note === 'safe-note' &&
    authorized.correlation.proposalId === recorded.correlation.proposalId &&
    authorized.correlation.proposalId === 'prop-studio-1' &&
    Object.isFrozen(authorized.payload) &&
    Object.isFrozen(authorized.correlation),
)

resetAutomationActionIntentStore({ intents: [] })
const toCancel = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
})
const cancelled = cancelAutomationActionIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: toCancel.id,
}).intent
const cancelledError = threw(() => makeDeliveryExecutionRequest(cancelled, DEFAULT_COMPANY_ID))
const stillCancelled = allAutomationActionIntents().find((row) => row.id === toCancel.id)
assert(
  '7. cancelled intent fails closed and remains cancelled',
  cancelledError instanceof ValidationError &&
    cancelledError.errors?.[0]?.field === 'status' &&
    stillCancelled.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED,
)

function kindFail(kind, actionType, label) {
  resetAutomationActionIntentStore({ intents: [] })
  const row = plant({ kind, actionType, extra: { eventId: `evt-${label}` } })
  const error = threw(() => makeDeliveryExecutionRequest(row, DEFAULT_COMPANY_ID))
  assert(
    label,
    error instanceof ValidationError && error.errors?.[0]?.field === 'kind',
  )
}

kindFail(INTEGRATION_KIND.CRM, AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT, '8. CRM intent fails')
kindFail(
  INTEGRATION_KIND.OUTBOUND_WEBHOOK,
  AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
  '9. outboundWebhook intent fails',
)
kindFail(
  INTEGRATION_KIND.CALENDAR,
  AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CALENDAR_INTENT,
  '10. calendar intent fails',
)
kindFail(
  INTEGRATION_KIND.MESSAGING,
  AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_MESSAGING_INTENT,
  '11. messaging intent fails',
)

resetAutomationActionIntentStore({ intents: [] })
const wrongType = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT,
  extra: { eventId: 'evt-wrong-action' },
})
const wrongTypeError = threw(() =>
  makeDeliveryExecutionRequest(wrongType, DEFAULT_COMPANY_ID),
)
assert(
  '12. delivery intent with wrong actionType fails',
  wrongTypeError instanceof ValidationError && wrongTypeError.errors?.[0]?.field === 'actionType',
)

assert(
  '13. missing/blank companyId produces ValidationError',
  threw(() => makeDeliveryExecutionRequest(recorded, '')) instanceof ValidationError &&
    threw(() => makeDeliveryExecutionRequest(recorded, null)).errors?.[0]?.field === 'companyId',
)

resetAutomationActionIntentStore({ intents: [] })
const tenantRow = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-tenant' },
})
const crossTenant = threw(() =>
  makeDeliveryExecutionRequest(tenantRow, WORKFLOW_ISOLATION_COMPANY_ID),
)
assert(
  '14. cross-tenant access produces ForbiddenError',
  crossTenant instanceof ForbiddenError,
)

resetAutomationActionIntentStore({ intents: [] })
const matched = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-mismatch' },
})
const mismatched = threw(() =>
  makeDeliveryExecutionRequest(
    { ...matched, companyId: WORKFLOW_ISOLATION_COMPANY_ID },
    DEFAULT_COMPANY_ID,
  ),
)
assert(
  '15. mocked stored intent with mismatched companyId fails closed',
  mismatched instanceof ValidationError && mismatched.errors?.[0]?.field === 'companyId',
)

resetAutomationActionIntentStore({ intents: [] })
const secretHost = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-secret' },
})
const secretError = threw(() =>
  makeDeliveryExecutionRequest({ ...secretHost, oauth: 'tok_live' }, DEFAULT_COMPANY_ID),
)
const vendorError = threw(() =>
  makeDeliveryExecutionRequest(
    { ...secretHost, payload: { ...secretHost.payload, accessToken: 'secret' } },
    DEFAULT_COMPANY_ID,
  ),
)
assert(
  '16. secret/OAuth/vendor fields are rejected',
  secretError instanceof ValidationError &&
    secretError.errors?.[0]?.field === 'oauth' &&
    vendorError instanceof ValidationError &&
    vendorError.errors?.[0]?.field === 'accessToken',
)

resetAutomationActionIntentStore({ intents: [] })
const ledgerRow = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-ledger' },
})
const ledgerBefore = allAutomationActionIntents()
makeDeliveryExecutionRequest(ledgerRow, DEFAULT_COMPANY_ID)
const ledgerAfter = allAutomationActionIntents()
assert(
  '17. intent ledger remains unchanged after authorization',
  ledgerAfter.length === ledgerBefore.length &&
    ledgerAfter.length === 1 &&
    ledgerAfter[0].id === ledgerRow.id &&
    ledgerAfter[0].status === AUTOMATION_ACTION_INTENT_STATUS.RECORDED &&
    ledgerAfter[0].status === ledgerBefore[0].status &&
    ledgerAfter[0].updatedAt === ledgerBefore[0].updatedAt,
)

assert(
  '18. no fetch/http/nodemailer/vendor SDK/worker/execute function/applyMutation usage',
  !/\bfetch\b/.test(deliverySource) &&
    !/nodemailer/.test(deliverySource) &&
    !/applyMutation/.test(deliverySource) &&
    !/executeOutboundWebhookForIntent/.test(deliverySource) &&
    !/executeAutomationAction/.test(deliverySource) &&
    !/createWorker|Bull|Agenda/.test(deliverySource) &&
    !schemaSource.includes('resolveEnabledIntegrationAdapter') &&
    !schemaSource.includes('.isEnabled('),
)

assert(
  '19. no outcome ledger',
    !existsSync(join(root, 'src/integrations/delivery/outcomes.js')) &&
    !deliverySource.includes('recordDeliveryOutcome') &&
    !existsSync(join(root, 'src/integrations/delivery/outcomes')),
)

assert(
  '20. no src/integrations/outbox',
  !existsSync(join(root, 'src/integrations/outbox')),
)

assert(
  '21. no delivery transport.js',
  !existsSync(join(root, 'src/integrations/delivery/transport.js')),
)

assert(
  '22. no delivery oauth.js',
  !existsSync(join(root, 'src/integrations/delivery/oauth.js')),
)

assert(
  '23. no delivery store.js',
  !existsSync(join(root, 'src/integrations/delivery/store.js')),
)

const nullDelivery = createNullDeliveryAdapter()
assert(
  '24. createNullDeliveryAdapter().isEnabled() remains false',
  nullDelivery.isEnabled({}) === false && nullDelivery.isEnabled({ enabled: true }) === false,
)

assert(
  '25. null delivery descriptor remains network:false and oauth:false',
  nullDelivery.describe().network === false &&
    nullDelivery.describe().oauth === false &&
    nullDelivery.describe().id === 'null_delivery',
)

assert(
  '26. INTEGRATION_CAPABILITIES.deliveryExecution remains false',
  INTEGRATION_CAPABILITIES.deliveryExecution === false,
)

assert(
  '27. other disabled capabilities remain unchanged',
  INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

assert(
  '28. H15 commercialClose/providers is not imported',
  !deliverySource.includes('commercialClose') &&
    !deliverySource.includes('commercialClose/providers'),
)

assert(
  '29. H16.15 createStudioActivity / agent-origin write/archive are not imported or used',
  !deliverySource.includes('createStudioActivity') &&
    !deliverySource.includes('createAgentOriginActivity') &&
    !deliverySource.includes('archiveAgentOriginActivity') &&
    !deliverySource.includes('agentOriginWrite') &&
    !deliverySource.includes('agentOriginArchive'),
)

const deliveryFiles = existsSync(join(root, 'src/integrations/delivery'))
  ? readdirSync(join(root, 'src/integrations/delivery')).filter((name) => name.endsWith('.js')).sort()
  : []
assert(
  '30. foundation layout permits ONLY the new contract files and still rejects execution infrastructure',
  deliveryFiles.join(',') === 'index.js,schema.js,types.js' &&
    !existsSync(join(root, 'src/integrations/delivery/transport.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/oauth.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/store.js')) &&
    !existsSync(join(root, 'src/integrations/outbox')),
)

resetAutomationActionIntentStore({ intents: [] })

console.log('')
console.log(`H16.16 delivery-execution contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
