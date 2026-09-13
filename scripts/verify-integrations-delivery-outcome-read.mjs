/**
 * H16.16 Slice 16.4 — Company-scoped delivery outcome read facade.
 * Independent. Does not nest other verifiers.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  AUTOMATION_ACTION_INTENT_STATUS,
  AUTOMATION_RULE_ACTION_TYPE,
  DELIVERY_OUTCOME_STATUS,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  allDeliveryOutcomes,
  configureDeliveryOutcomeStore,
  createNullDeliveryAdapter,
  executeDeliveryForIntent,
  getAutomationActionIntentForCompany,
  getDeliveryOutcomeForCompany,
  makeAutomationActionIntent,
  recordAutomationActionIntent,
  resetAutomationActionIntentStore,
  resetDeliveryOutcomeStore,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outcomesSource = readFileSync(
  join(root, 'src/integrations/delivery/outcomes.js'),
  'utf8',
)
const executeSource = readFileSync(
  join(root, 'src/integrations/delivery/execute.js'),
  'utf8',
)
const schemaSource = readFileSync(
  join(root, 'src/integrations/delivery/schema.js'),
  'utf8',
)
const indexSource = readFileSync(
  join(root, 'src/integrations/delivery/index.js'),
  'utf8',
)
const typesSource = readFileSync(
  join(root, 'src/integrations/delivery/types.js'),
  'utf8',
)
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
      ruleId: extra.ruleId || 'rule-h1616-4',
      ruleVersion: 1,
      actionIndex: extra.actionIndex ?? 0,
      payload: extra.payload ?? { note: 'safe-note' },
      correlation: extra.correlation ?? { proposalId: 'prop-studio-1' },
    }),
  ).intent
}

resetAutomationActionIntentStore({ intents: [] })
resetDeliveryOutcomeStore({ outcomes: [] })

const persistSnapshots = []
configureDeliveryOutcomeStore({
  persist: (bag) => {
    persistSnapshots.push(bag)
  },
})

const recorded = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-h1616-4-recorded' },
})
const executed = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
assert(
  '1. execute produces a rejected outcome',
  executed.ok === false &&
    executed.duplicate === false &&
    executed.outcome.status === DELIVERY_OUTCOME_STATUS.REJECTED,
)

const persistAfterExecute = persistSnapshots.length
const ledgerAfterExecute = allDeliveryOutcomes().length
const intentBeforeRead = getAutomationActionIntentForCompany(
  DEFAULT_COMPANY_ID,
  recorded.id,
)

const read = getDeliveryOutcomeForCompany(DEFAULT_COMPANY_ID, recorded.id)
assert(
  '2. getDeliveryOutcomeForCompany returns that outcome',
  read.intentId === executed.outcome.intentId && Object.isFrozen(read),
)
assert(
  '3. companyId and intentId match',
  read.companyId === DEFAULT_COMPANY_ID && read.intentId === recorded.id,
)
assert('4. failureCode matches execution', read.failureCode === executed.outcome.failureCode)
assert(
  '5. idempotencyKey matches execution',
  read.idempotencyKey === executed.outcome.idempotencyKey &&
    read.idempotencyKey === recorded.idempotencyKey,
)
assert(
  '6. returned outcome remains rejected',
  read.status === DELIVERY_OUTCOME_STATUS.REJECTED &&
    read.kind === INTEGRATION_KIND.DELIVERY &&
    read.adapterId === 'null_delivery' &&
    read.retryable === false &&
    read.network === false &&
    read.oauth === false,
)

const reread = getDeliveryOutcomeForCompany(DEFAULT_COMPANY_ID, recorded.id)
assert(
  '7. repeated reads return the same logical outcome',
  reread.intentId === read.intentId &&
    reread.idempotencyKey === read.idempotencyKey &&
    reread.failureCode === read.failureCode &&
    reread.companyId === read.companyId &&
    reread.status === read.status,
)

assert(
  '8. blank companyId → ValidationError',
  threw(() => getDeliveryOutcomeForCompany('', recorded.id)) instanceof ValidationError &&
    threw(() => getDeliveryOutcomeForCompany(null, recorded.id)) instanceof ValidationError,
)
assert(
  '9. blank intentId → ValidationError',
  threw(() => getDeliveryOutcomeForCompany(DEFAULT_COMPANY_ID, '')) instanceof
    ValidationError &&
    threw(() => getDeliveryOutcomeForCompany(DEFAULT_COMPANY_ID, '   ')) instanceof
      ValidationError,
)
assert(
  '10. unknown intentId → NotFoundError',
  threw(() =>
    getDeliveryOutcomeForCompany(DEFAULT_COMPANY_ID, 'intent-missing-h1616-4'),
  ) instanceof NotFoundError,
)

const crossTenant = threw(() =>
  getDeliveryOutcomeForCompany(WORKFLOW_ISOLATION_COMPANY_ID, recorded.id),
)
assert(
  '11. another company attempting to read the outcome → ForbiddenError',
  crossTenant instanceof ForbiddenError,
)
assert(
  '12. cross-tenant read does not expose the outcome',
  crossTenant instanceof ForbiddenError &&
    crossTenant.outcome == null &&
    !Object.prototype.hasOwnProperty.call(crossTenant, 'outcome'),
)

assert(
  '13. get does not create an outcome',
  allDeliveryOutcomes().length === ledgerAfterExecute && ledgerAfterExecute === 1,
)
assert(
  '14. get does not call executeDeliveryForIntent',
  !outcomesSource.includes('executeDeliveryForIntent') &&
    !outcomesSource.includes("from './execute.js'"),
)
assert(
  '15. get does not invoke persistence',
  persistSnapshots.length === persistAfterExecute,
)
const intentAfterRead = getAutomationActionIntentForCompany(
  DEFAULT_COMPANY_ID,
  recorded.id,
)
assert(
  '16. get does not alter the intent',
  intentAfterRead.status === AUTOMATION_ACTION_INTENT_STATUS.RECORDED &&
    intentAfterRead.status === intentBeforeRead.status &&
    intentAfterRead.updatedAt === intentBeforeRead.updatedAt &&
    intentAfterRead.idempotencyKey === intentBeforeRead.idempotencyKey,
)

const replay = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
assert(
  '17. get followed by execute still returns duplicate: true',
  replay.ok === false &&
    replay.duplicate === true &&
    replay.outcome.intentId === recorded.id,
)
assert(
  '18. ledger still contains exactly one outcome',
  allDeliveryOutcomes().length === 1 &&
    allDeliveryOutcomes()[0].intentId === recorded.id,
)

const nullDelivery = createNullDeliveryAdapter()
assert(
  '19. deliveryExecution remains false and null_delivery remains disabled',
  INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false &&
    nullDelivery.isEnabled({}) === false &&
    nullDelivery.isEnabled({ enabled: true }) === false,
)

const listed = existsSync(join(root, 'src/integrations/delivery'))
  ? readdirSync(join(root, 'src/integrations/delivery'))
      .filter((name) => name.endsWith('.js'))
      .sort()
  : []

assert(
  '20. no transport/oauth/store/repository/mock/outbox/workers/SMTP/HTTP send',
  listed.join(',') === 'execute.js,index.js,outcomes.js,schema.js,types.js' &&
    !existsSync(join(root, 'src/integrations/delivery/transport.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/oauth.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/store.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/repository.js')) &&
    !existsSync(join(root, 'src/integrations/outbox')) &&
    !deliverySource.includes('mock_delivery') &&
    !/\bfetch\b/.test(deliverySource) &&
    !/nodemailer|\bsmtp\b/i.test(outcomesSource) &&
    !/createWorker|Bull|Agenda|worker_threads/.test(outcomesSource) &&
    !/processOutbox|createOutbox|leasing|DLQ/.test(outcomesSource) &&
    !outcomesSource.includes('/api/') &&
    !typesSource.includes('SUCCEEDED') &&
    !typesSource.includes('SENT') &&
    !typesSource.includes('DELIVERED') &&
    !typesSource.includes('EXECUTING'),
)

resetAutomationActionIntentStore({ intents: [] })
resetDeliveryOutcomeStore({ outcomes: [] })
configureDeliveryOutcomeStore({ persist: null })

console.log('')
console.log(`H16.16 delivery-outcome-read checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
