/**
 * H16.16 Slice 16.3 — Durable rejected delivery outcome ledger.
 * Independent persist/restore checks. Does not nest other verifiers.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { readDeliveryOutcomesFile } from '../server/integrationsDeliveryPlugin.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  AUTOMATION_RULE_ACTION_TYPE,
  DELIVERY_FAILURE_CODE,
  DELIVERY_OUTCOME_STATUS,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  allDeliveryOutcomes,
  configureDeliveryOutcomeStore,
  createNullDeliveryAdapter,
  executeDeliveryForIntent,
  findDeliveryOutcomeByIntentId,
  listDeliveryOutcomesForCompany,
  makeAutomationActionIntent,
  parsePersistedDeliveryOutcomeSnapshot,
  recordAutomationActionIntent,
  replaceDeliveryOutcomes,
  resetAutomationActionIntentStore,
  resetDeliveryOutcomeStore,
  serializeDeliveryOutcomes,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outcomesSource = readFileSync(
  join(root, 'src/integrations/delivery/outcomes.js'),
  'utf8',
)
const pluginSource = readFileSync(
  join(root, 'server/integrationsDeliveryPlugin.js'),
  'utf8',
)
const productionApiSource = readFileSync(join(root, 'server/productionApi.js'), 'utf8')
const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
const executeSource = readFileSync(
  join(root, 'src/integrations/delivery/execute.js'),
  'utf8',
)

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
      ruleId: extra.ruleId || 'rule-h1616-3',
      ruleVersion: 1,
      actionIndex: extra.actionIndex ?? 0,
      payload: extra.payload ?? { note: 'safe-note' },
      correlation: extra.correlation ?? { proposalId: 'prop-studio-1' },
    }),
  ).intent
}

const tempDir = mkdtempSync(join(tmpdir(), 'pf-h1616-3-'))
const outcomesFile = join(tempDir, 'delivery-outcomes.json')
const snapshots = []

function persistOutcomes(bag) {
  snapshots.push(bag)
  writeFileSync(
    outcomesFile,
    `${JSON.stringify({ outcomes: bag?.outcomes ?? [] }, null, 2)}\n`,
    'utf8',
  )
}

resetAutomationActionIntentStore({ intents: [] })
resetDeliveryOutcomeStore({ outcomes: [] })
configureDeliveryOutcomeStore({ persist: persistOutcomes })

assert('A. fresh store is empty', allDeliveryOutcomes().length === 0)

const recorded = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  extra: { eventId: 'evt-h1616-3-recorded' },
})
const executed = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})

assert(
  'B. persist callback receives snapshot after a new rejected outcome',
  snapshots.length === 1 &&
    Array.isArray(snapshots[0].outcomes) &&
    snapshots[0].outcomes.length === 1 &&
    snapshots[0].outcomes[0].intentId === recorded.id &&
    snapshots[0].outcomes[0].status === DELIVERY_OUTCOME_STATUS.REJECTED &&
    existsSync(outcomesFile),
)

const duplicateBeforeRestore = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
assert(
  'B2. duplicate replay does not persist a second snapshot',
  duplicateBeforeRestore.duplicate === true &&
    snapshots.length === 1 &&
    allDeliveryOutcomes().length === 1,
)

const serialized = serializeDeliveryOutcomes()
assert(
  'C. serialize contains only rejected delivery outcomes',
  Object.isFrozen(serialized) &&
    serialized.outcomes.length === 1 &&
    serialized.outcomes.every(
      (row) =>
        row.status === DELIVERY_OUTCOME_STATUS.REJECTED &&
        row.kind === INTEGRATION_KIND.DELIVERY &&
        row.network === false &&
        row.oauth === false,
    ),
)

configureDeliveryOutcomeStore({ persist: null })
resetDeliveryOutcomeStore({ outcomes: [] })
assert('D1. reset clears the ledger', allDeliveryOutcomes().length === 0)
replaceDeliveryOutcomes(serialized)
const restored = findDeliveryOutcomeByIntentId(recorded.id)
assert(
  'D2. replace restores the rejected outcome',
  restored?.intentId === recorded.id &&
    restored.idempotencyKey === recorded.idempotencyKey &&
    restored.failureCode === executed.outcome.failureCode &&
    restored.companyId === DEFAULT_COMPANY_ID &&
    restored.status === DELIVERY_OUTCOME_STATUS.REJECTED &&
    Object.isFrozen(restored),
)

const replay = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
assert(
  'E. post-restore replay is duplicate with the same outcome',
  replay.ok === false &&
    replay.duplicate === true &&
    replay.outcome.intentId === executed.outcome.intentId &&
    replay.outcome.idempotencyKey === executed.outcome.idempotencyKey &&
    replay.outcome.failureCode === executed.outcome.failureCode &&
    replay.outcome.companyId === executed.outcome.companyId &&
    allDeliveryOutcomes().length === 1,
)
assert(
  'F. intent.id and idempotencyKey are unchanged',
  replay.outcome.intentId === recorded.id &&
    replay.outcome.idempotencyKey === recorded.idempotencyKey,
)

const foreign = plant({
  kind: INTEGRATION_KIND.DELIVERY,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  extra: { eventId: 'evt-h1616-3-foreign' },
})
configureDeliveryOutcomeStore({ persist: persistOutcomes })
executeDeliveryForIntent({
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  intentId: foreign.id,
})
configureDeliveryOutcomeStore({ persist: null })
assert(
  'G. tenant isolation: list/execute cannot leak another company',
  listDeliveryOutcomesForCompany(DEFAULT_COMPANY_ID).every(
    (row) => row.companyId === DEFAULT_COMPANY_ID,
  ) &&
    !listDeliveryOutcomesForCompany(DEFAULT_COMPANY_ID).some(
      (row) => row.intentId === foreign.id,
    ) &&
    threw(() =>
      executeDeliveryForIntent({
        companyId: DEFAULT_COMPANY_ID,
        intentId: foreign.id,
      }),
    ) instanceof ForbiddenError &&
    findDeliveryOutcomeByIntentId(foreign.id)?.companyId === WORKFLOW_ISOLATION_COMPANY_ID,
)

const crmIntent = plant({
  kind: INTEGRATION_KIND.CRM,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT,
  extra: { eventId: 'evt-h1616-3-crm' },
})
const beforeWrongKind = allDeliveryOutcomes().length
const crmError = threw(() =>
  executeDeliveryForIntent({
    companyId: DEFAULT_COMPANY_ID,
    intentId: crmIntent.id,
  }),
)
assert(
  'H. wrong-kind intent cannot create a delivery outcome',
  crmError instanceof ValidationError &&
    findDeliveryOutcomeByIntentId(crmIntent.id) == null &&
    allDeliveryOutcomes().length === beforeWrongKind,
)

const beforeCorrupt = allDeliveryOutcomes().length
const beforeCorruptIds = allDeliveryOutcomes().map((row) => row.intentId).join(',')
const corrupt = threw(() =>
  replaceDeliveryOutcomes({
    outcomes: [
      {
        companyId: DEFAULT_COMPANY_ID,
        intentId: 'intent-corrupt',
        idempotencyKey: 'key-corrupt',
        status: 'succeeded',
        kind: INTEGRATION_KIND.DELIVERY,
        adapterId: 'null_delivery',
        failureCode: DELIVERY_FAILURE_CODE.CAPABILITY_DISABLED,
        retryable: false,
        network: false,
        oauth: false,
      },
    ],
  }),
)
assert(
  'I. malformed outcome object fails closed and does not invent an outcome',
  corrupt instanceof ValidationError &&
    allDeliveryOutcomes().length === beforeCorrupt &&
    allDeliveryOutcomes().map((row) => row.intentId).join(',') === beforeCorruptIds &&
    findDeliveryOutcomeByIntentId('intent-corrupt') == null,
)

const malformedShape = threw(() => replaceDeliveryOutcomes({ outcomes: 'not-an-array' }))
assert(
  'I2. malformed snapshot shape does not silently reset to []',
  malformedShape instanceof ValidationError &&
    allDeliveryOutcomes().length === beforeCorrupt &&
    allDeliveryOutcomes().map((row) => row.intentId).join(',') === beforeCorruptIds,
)

const emptySnapshot = parsePersistedDeliveryOutcomeSnapshot('{"outcomes":[]}')
assert(
  'I3. valid JSON empty snapshot parses as an empty ledger',
  Array.isArray(emptySnapshot.outcomes) && emptySnapshot.outcomes.length === 0,
)

const validParsed = parsePersistedDeliveryOutcomeSnapshot(JSON.stringify(serialized))
assert(
  'I4. valid JSON rejected outcomes parse without rewriting status',
  validParsed.outcomes.length === 1 &&
    validParsed.outcomes[0].intentId === recorded.id &&
    validParsed.outcomes[0].status === DELIVERY_OUTCOME_STATUS.REJECTED,
)

const malformedJson = threw(() => parsePersistedDeliveryOutcomeSnapshot('{not json'))
const malformedRoot = threw(() => parsePersistedDeliveryOutcomeSnapshot('[]'))
const malformedNullOutcomes = threw(() =>
  parsePersistedDeliveryOutcomeSnapshot('{"outcomes":null}'),
)
assert(
  'I5. malformed JSON fails closed and is not coerced to []',
  malformedJson instanceof ValidationError &&
    malformedRoot instanceof ValidationError &&
    malformedNullOutcomes instanceof ValidationError &&
    allDeliveryOutcomes().length === beforeCorrupt,
)

const corruptFile = join(tempDir, 'corrupt-delivery-outcomes.json')
const corruptRaw = '{not json'
writeFileSync(corruptFile, corruptRaw, 'utf8')
const corruptFileError = threw(() => readDeliveryOutcomesFile(corruptFile))
const corruptFileAfter = readFileSync(corruptFile, 'utf8')
assert(
  'I6. malformed JSON file is not overwritten or reset to []',
  corruptFileError instanceof ValidationError &&
    corruptFileAfter === corruptRaw &&
    !existsSync(join(tempDir, 'delivery-outcomes-empty-overwrite.json')),
)

const missingFile = readDeliveryOutcomesFile(join(tempDir, 'missing-delivery-outcomes.json'))
assert('I7. missing file is the only empty-boot signal', missingFile == null)

const failedRestoreReplay = executeDeliveryForIntent({
  companyId: DEFAULT_COMPANY_ID,
  intentId: recorded.id,
})
assert(
  'I8. failed/corrupt restore does not create a second outcome',
  failedRestoreReplay.ok === false &&
    failedRestoreReplay.duplicate === true &&
    failedRestoreReplay.outcome.intentId === recorded.id &&
    allDeliveryOutcomes().filter((row) => row.intentId === recorded.id).length === 1 &&
    allDeliveryOutcomes().length === beforeCorrupt,
)

const nullDelivery = createNullDeliveryAdapter()
assert(
  'J. deliveryExecution remains false and null_delivery remains disabled',
  INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    nullDelivery.isEnabled({}) === false &&
    nullDelivery.isEnabled({ enabled: true }) === false,
)

assert(
  'K. no transport/oauth/store/repository/mock/outbox/workers/SMTP/HTTP send/vendor SDKs',
  !existsSync(join(root, 'src/integrations/delivery/transport.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/oauth.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/store.js')) &&
    !existsSync(join(root, 'src/integrations/delivery/repository.js')) &&
    !existsSync(join(root, 'src/integrations/outbox')) &&
    !outcomesSource.includes('mock_delivery') &&
    !pluginSource.includes('mock_delivery') &&
    !/\bfetch\b/.test(pluginSource) &&
    !/nodemailer|\bsmtp\b/i.test(pluginSource) &&
    !/createWorker|Bull|Agenda|worker_threads/.test(pluginSource) &&
    !/processOutbox|createOutbox/.test(pluginSource) &&
    !pluginSource.includes('/api/') &&
    !pluginSource.includes('matchRoute') &&
    !pluginSource.includes('return fallback') &&
    pluginSource.includes('parsePersistedDeliveryOutcomeSnapshot') &&
    pluginSource.includes("error.code === 'ENOENT'") &&
    pluginSource.includes('ensureStore()') &&
    !executeSource.includes('configureDeliveryOutcomeStore') &&
    productionApiSource.includes('integrationsDeliveryPlugin') &&
    productionApiSource.includes('function getHandlers()') &&
    viteSource.includes('integrationsDeliveryPlugin') &&
    viteSource.includes('integrationsDeliveryPlugin()') &&
    pluginSource.includes('delivery-outcomes.json') &&
    pluginSource.includes('configureServer') &&
    pluginSource.includes('configurePreviewServer'),
)

resetAutomationActionIntentStore({ intents: [] })
resetDeliveryOutcomeStore({ outcomes: [] })
configureDeliveryOutcomeStore({ persist: null })
rmSync(tempDir, { recursive: true, force: true })

console.log('')
console.log(`H16.16 delivery-outcomes persist checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
