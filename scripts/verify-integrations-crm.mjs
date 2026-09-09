/**
 * H16.6 CRM Integration Boundary verification.
 *
 * Vendor-neutral, capability-gated, synchronous CRM consumer.
 * mock_crm runs in-process with no network, no OAuth, and no vendor SDK.
 * Application-level idempotency is not external exactly-once.
 * Never writes data/proposals.json.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import { COMMERCIAL_CLOSE_CAPABILITIES } from '../src/commercialClose/types.js'
import {
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  AUTOMATION_RULE_ACTION_TYPE,
  AUTOMATION_ACTION_INTENT_STATUS,
  CRM_FAILURE_CODE,
  CRM_OPERATION,
  CRM_OPERATIONS,
  CRM_OUTCOME_STATUS,
  CRM_PROVIDER_ID,
  CRM_RECORD_TYPE,
  CRM_INTENT_ACTION_TYPE,
  buildCrmMutation,
  extractCrmRecord,
  makeCrmConnection,
  getCrmAdapter,
  listCrmAdapters,
  getMockCrmRecord,
  resetMockCrmRecords,
  setMockCrmFailureForTests,
  clearMockCrmFailureForTests,
  configureCrmConnectionStore,
  configureCrmOutcomeStore,
  resetCrmConnectionStore,
  resetCrmOutcomeStore,
  serializeCrmConnections,
  serializeCrmOutcomes,
  upsertCrmConnectionForCompany,
  listStudioCrmConnections,
  getStudioCrmConnection,
  upsertStudioCrmConnection,
  patchStudioCrmConnection,
  listStudioCrmOutcomes,
  executeCrmIntent,
  executeStudioCrmIntent,
  setCrmCapabilityOverrideForTests,
  configureAutomationActionIntentStore,
  resetAutomationActionIntentStore,
  serializeAutomationActionIntents,
  makeAutomationActionIntent,
  recordAutomationActionIntent,
  cancelStudioAutomationActionIntent,
  getStudioAutomationActionIntent,
  kindForDeferredEnqueueAction,
  recordDeferredAutomationActionIntent,
  resetOutboundWebhookOutcomeStore,
  allOutboundWebhookOutcomes,
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

let passed = 0
let failed = 0

function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function collectSources(relativeDir) {
  const base = join(root, relativeDir)
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) files.push(full)
    }
  }
  walk(base)
  return files.map((file) => readFileSync(file, 'utf8')).join('\n')
}

/** Strip comments so honesty scans test code, not prose about what is absent. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 40 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI || '1' },
  })
  return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}` }
}

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

const proposalsBefore = proposalsSnapshot()
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const tempDir = mkdtempSync(join(tmpdir(), 'pf-h166-'))
const intentsFile = join(tempDir, 'automation-action-intents.json')
const connectionsFile = join(tempDir, 'crm-connections.json')
const crmOutcomesFile = join(tempDir, 'crm-outcomes.json')

const CRM_SECRET_VALUE = 'unit-test-crm-api-key-value'
process.env.PF_TEST_CRM_API_KEY = CRM_SECRET_VALUE

function persistIntents(bag) {
  writeFileSync(
    intentsFile,
    `${JSON.stringify({ intents: bag?.intents ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistConnections(bag) {
  writeFileSync(
    connectionsFile,
    `${JSON.stringify({ connections: bag?.connections ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistCrmOutcomes(bag) {
  writeFileSync(
    crmOutcomesFile,
    `${JSON.stringify({ outcomes: bag?.outcomes ?? [] }, null, 2)}\n`,
    'utf8',
  )
}

function resetAll() {
  resetAutomationActionIntentStore({ intents: [] })
  resetCrmConnectionStore({ connections: [] })
  resetCrmOutcomeStore({ outcomes: [] })
  resetOutboundWebhookOutcomeStore({ outcomes: [] })
  resetMockCrmRecords()
  clearMockCrmFailureForTests()
  setCrmCapabilityOverrideForTests(null)
  configureAutomationActionIntentStore({ persist: persistIntents })
  configureCrmConnectionStore({ persist: persistConnections })
  configureCrmOutcomeStore({ persist: persistCrmOutcomes })
  persistIntents(serializeAutomationActionIntents())
  persistConnections(serializeCrmConnections())
  persistCrmOutcomes(serializeCrmOutcomes())
}

resetAll()

let intentSeq = 0
function seedCrmIntent({ companyId = studio, payload = {}, ...overrides } = {}) {
  intentSeq += 1
  return recordAutomationActionIntent(
    makeAutomationActionIntent({
      companyId,
      kind: INTEGRATION_KIND.CRM,
      actionType: CRM_INTENT_ACTION_TYPE,
      eventId: `aevt_h166_${intentSeq}`,
      ruleId: 'arule_h166',
      ruleVersion: 1,
      actionIndex: 0,
      correlation: { proposalId: 'prop-h166', actorId: DEFAULT_ACTOR_ID },
      payload,
      ...overrides,
    }),
  ).intent
}

console.log('— Capabilities —')
assert('1. crm === true', INTEGRATION_CAPABILITIES.crm === true)
assert(
  '2. existing H16 capabilities remain correct',
  INTEGRATION_CAPABILITIES.integrationFoundation === true &&
    INTEGRATION_CAPABILITIES.eventIntake === true &&
    INTEGRATION_CAPABILITIES.automationRules === true &&
    INTEGRATION_CAPABILITIES.actionIntents === true &&
    INTEGRATION_CAPABILITIES.outboundWebhooks === true &&
    INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

console.log('— Connection model —')
assert(
  '3. connection requires companyId',
  threw(() => makeCrmConnection({ providerId: CRM_PROVIDER_ID.MOCK })) instanceof
    ValidationError,
)

const conn = upsertStudioCrmConnection({
  companyId: studio,
  providerId: CRM_PROVIDER_ID.MOCK,
  name: 'Mock CRM',
  enabled: true,
  credentialRefs: { apiKeyRef: 'env:PF_TEST_CRM_API_KEY' },
  config: { pipelineLabel: 'Default pipeline', defaultStage: 'discovery' },
})
const otherConn = upsertStudioCrmConnection({
  companyId: otherCompany,
  providerId: CRM_PROVIDER_ID.MOCK,
  name: 'Other company CRM',
  enabled: true,
})
const disabledConn = upsertStudioCrmConnection({
  companyId: studio,
  providerId: CRM_PROVIDER_ID.MOCK,
  name: 'Disabled CRM',
  enabled: false,
})
const nullConn = upsertStudioCrmConnection({
  companyId: studio,
  providerId: CRM_PROVIDER_ID.NULL,
  name: 'Null CRM',
  enabled: true,
})

assert(
  '4. cross-company connection access rejected',
  threw(() => getStudioCrmConnection(studio, otherConn.id)) instanceof ForbiddenError &&
    !listStudioCrmConnections(studio).some((item) => item.id === otherConn.id) &&
    listStudioCrmConnections(otherCompany).length === 1,
)

assert(
  '5. raw secrets rejected',
  threw(() =>
    upsertStudioCrmConnection({
      companyId: studio,
      providerId: CRM_PROVIDER_ID.MOCK,
      apiKey: 'raw-api-key',
    }),
  ) instanceof ValidationError &&
    threw(() =>
      upsertStudioCrmConnection({
        companyId: studio,
        providerId: CRM_PROVIDER_ID.MOCK,
        credentialRefs: { apiKeyRef: 'raw-api-key' },
      }),
    ) instanceof ValidationError &&
    threw(() =>
      upsertStudioCrmConnection({
        companyId: studio,
        providerId: CRM_PROVIDER_ID.MOCK,
        credentialRefs: { accessToken: 'ya29.raw' },
      }),
    ) instanceof ValidationError,
)

assert(
  '6. secret refs accepted',
  conn.credentialRefs.apiKeyRef === 'env:PF_TEST_CRM_API_KEY' &&
    conn.hasCredentialRefs === true &&
    upsertStudioCrmConnection({
      companyId: studio,
      providerId: CRM_PROVIDER_ID.MOCK,
      name: 'Vault CRM',
      credentialRefs: { apiKeyRef: 'vault:crm/api-key' },
    }).credentialRefs.apiKeyRef === 'vault:crm/api-key',
)

assert(
  '38. no generic arbitrary REST endpoint configuration',
  threw(() =>
    upsertStudioCrmConnection({
      companyId: studio,
      providerId: CRM_PROVIDER_ID.MOCK,
      config: { baseUrl: 'https://api.vendor.test' },
    }),
  ) instanceof ValidationError &&
    threw(() =>
      upsertStudioCrmConnection({
        companyId: studio,
        providerId: CRM_PROVIDER_ID.MOCK,
        config: { endpoint: '/v3/objects' },
      }),
    ) instanceof ValidationError &&
    threw(() =>
      upsertStudioCrmConnection({
        companyId: studio,
        providerId: CRM_PROVIDER_ID.MOCK,
        config: { pipelineLabel: 'https://api.vendor.test' },
      }),
    ) instanceof ValidationError &&
    threw(() =>
      upsertStudioCrmConnection({
        companyId: studio,
        providerId: CRM_PROVIDER_ID.MOCK,
        config: { arbitraryVendorField: 'x' },
      }),
    ) instanceof ValidationError,
)

console.log('— Adapters —')
const mockAdapter = getCrmAdapter(CRM_PROVIDER_ID.MOCK)
const nullAdapter = getCrmAdapter(CRM_PROVIDER_ID.NULL)
assert(
  '8. mock adapter registered',
  Boolean(mockAdapter) &&
    mockAdapter.isEnabled(conn) === true &&
    mockAdapter.describe().network === false &&
    mockAdapter.describe().oauth === false &&
    mockAdapter.describe().vendorSdk === false &&
    listCrmAdapters().length === 2,
)
assert(
  '9. null adapter remains disabled',
  Boolean(nullAdapter) &&
    nullAdapter.isEnabled(nullConn) === false &&
    nullAdapter.isEnabled({ enabled: true, providerId: CRM_PROVIDER_ID.NULL }) === false,
)
assert(
  '10. supported operations exactly match approved v1 set',
  CRM_OPERATIONS.length === 4 &&
    JSON.stringify([...CRM_OPERATIONS].sort()) ===
      JSON.stringify(
        ['upsert_contact', 'upsert_company', 'upsert_deal', 'create_note'].sort(),
      ) &&
    JSON.stringify([...mockAdapter.describe().operations].sort()) ===
      JSON.stringify([...CRM_OPERATIONS].sort()),
)

console.log('— Mapping —')
const mapA = buildCrmMutation({
  operation: CRM_OPERATION.UPSERT_CONTACT,
  payload: {
    'record.fullName': 'Buyer One',
    'record.email': 'Buyer@Example.com',
    'record.proposalId': 'prop-h166',
  },
  companyId: studio,
  connectionId: conn.id,
  providerId: CRM_PROVIDER_ID.MOCK,
  idempotencyKey: 'aint_fixed',
})
const mapB = buildCrmMutation({
  operation: CRM_OPERATION.UPSERT_CONTACT,
  payload: {
    'record.proposalId': 'prop-h166',
    'record.email': 'buyer@example.com',
    'record.fullName': 'Buyer One',
  },
  companyId: studio,
  connectionId: conn.id,
  providerId: CRM_PROVIDER_ID.MOCK,
  idempotencyKey: 'aint_fixed',
})
assert(
  '12. deterministic mapping',
  mapA.ok &&
    mapB.ok &&
    JSON.stringify(mapA.mutation) === JSON.stringify(mapB.mutation) &&
    mapA.mutation.recordType === CRM_RECORD_TYPE.CONTACT &&
    mapA.mutation.externalKey === 'contact:buyer@example.com' &&
    JSON.stringify(Object.keys(mapA.mutation.fields)) ===
      JSON.stringify(['email', 'fullName', 'proposalId']),
)

assert(
  '11. unsupported operation rejected (mapping)',
  extractCrmRecord('delete_contact', {}).failureCode ===
    CRM_FAILURE_CODE.UNSUPPORTED_OPERATION &&
    extractCrmRecord('associate_records', {}).failureCode ===
      CRM_FAILURE_CODE.UNSUPPORTED_OPERATION,
)

const moneyMap = buildCrmMutation({
  operation: CRM_OPERATION.UPSERT_DEAL,
  payload: {
    'record.name': 'H16.6 deal',
    'record.amount': '50000',
  },
  companyId: studio,
  connectionId: conn.id,
  providerId: CRM_PROVIDER_ID.MOCK,
  idempotencyKey: 'aint_money',
})
const moneyIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: CRM_OPERATION.UPSERT_DEAL,
    'record.name': 'H16.6 deal',
    'record.currency': 'USD',
    amount: 50000,
    selectedTotal: 50000,
  },
})
assert(
  '13. monetary fields are not accepted/smuggled',
  moneyMap.ok === false &&
    moneyMap.failureCode === CRM_FAILURE_CODE.VALIDATION_FAILURE &&
    !Object.prototype.hasOwnProperty.call(moneyIntent.payload, 'amount') &&
    !Object.prototype.hasOwnProperty.call(moneyIntent.payload, 'selectedTotal') &&
    !JSON.stringify(
      buildCrmMutation({
        operation: CRM_OPERATION.UPSERT_DEAL,
        payload: { 'record.name': 'ok' },
        companyId: studio,
        connectionId: conn.id,
        providerId: CRM_PROVIDER_ID.MOCK,
        idempotencyKey: 'x',
      }).mutation.fields,
    ).includes('amount'),
)

console.log('— Execution —')
const okIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'Buyer@Example.com',
    'record.fullName': 'Buyer One',
    'record.proposalId': 'prop-h166',
  },
})
const okResult = await executeCrmIntent({ companyId: studio, intentId: okIntent.id })
assert(
  '17. mock execution succeeds',
  okResult.ok === true &&
    okResult.outcome.status === CRM_OUTCOME_STATUS.SUCCEEDED &&
    okResult.outcome.providerId === CRM_PROVIDER_ID.MOCK &&
    okResult.outcome.operation === CRM_OPERATION.UPSERT_CONTACT &&
    okResult.outcome.connectionId === conn.id &&
    okResult.outcome.failureCode === null &&
    okResult.outcome.sanitizedResult.recordType === CRM_RECORD_TYPE.CONTACT,
)

const mockRecord = getMockCrmRecord(mapA.mutation)
assert(
  '18. stable externalId returned',
  typeof okResult.outcome.externalId === 'string' &&
    okResult.outcome.externalId.startsWith('mock_contact_') &&
    mockRecord != null &&
    mockRecord.externalId === okResult.outcome.externalId &&
    okResult.outcome.externalKey === 'contact:buyer@example.com',
)

const duplicate = await executeCrmIntent({ companyId: studio, intentId: okIntent.id })
const sameContactIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'buyer@example.com',
    'record.fullName': 'Buyer One',
    'record.proposalId': 'prop-h166',
  },
})
const sameContactResult = await executeCrmIntent({
  companyId: studio,
  intentId: sameContactIntent.id,
})
assert(
  '19. duplicate execution does not mutate twice',
  duplicate.duplicate === true &&
    duplicate.outcome.id === okResult.outcome.id &&
    getMockCrmRecord(mapA.mutation).revision === 1 &&
    sameContactResult.ok === true &&
    sameContactResult.outcome.externalId === okResult.outcome.externalId &&
    getMockCrmRecord(mapA.mutation).revision === 1 &&
    listStudioCrmOutcomes(studio).filter((item) => item.intentId === okIntent.id)
      .length === 1,
)

const persistedCrmOutcomes = JSON.parse(readFileSync(crmOutcomesFile, 'utf8'))
assert(
  '20. outcome persisted separately',
  Array.isArray(persistedCrmOutcomes.outcomes) &&
    persistedCrmOutcomes.outcomes.some((item) => item.intentId === okIntent.id) &&
    allOutboundWebhookOutcomes().length === 0,
)

const afterIntent = getStudioAutomationActionIntent(studio, okIntent.id)
assert(
  '21. intent status remains unchanged',
  afterIntent.status === AUTOMATION_ACTION_INTENT_STATUS.RECORDED &&
    afterIntent.cancelledAt === null,
)
assert(
  '22. intent idempotency key remains unchanged',
  afterIntent.idempotencyKey === okIntent.idempotencyKey &&
    okResult.outcome.idempotencyKey === okIntent.id &&
    afterIntent.updatedAt === okIntent.updatedAt,
)
assert(
  '23. lineage preserved',
  okResult.lineage != null &&
    okResult.lineage.eventId === okIntent.eventId &&
    okResult.lineage.ruleId === okIntent.ruleId &&
    okResult.lineage.ruleVersion === okIntent.ruleVersion &&
    okResult.lineage.actionIndex === okIntent.actionIndex &&
    okResult.lineage.actorId === DEFAULT_ACTOR_ID &&
    okResult.lineage.runAsActorId === DEFAULT_ACTOR_ID &&
    okResult.lineage.proposalId === 'prop-h166' &&
    afterIntent.correlation.actorId === DEFAULT_ACTOR_ID,
)

assert(
  '7. resolved secrets never exposed',
  !JSON.stringify(listStudioCrmConnections(studio)).includes(CRM_SECRET_VALUE) &&
    !JSON.stringify(listStudioCrmOutcomes(studio)).includes(CRM_SECRET_VALUE) &&
    !readFileSync(connectionsFile, 'utf8').includes(CRM_SECRET_VALUE) &&
    !readFileSync(crmOutcomesFile, 'utf8').includes(CRM_SECRET_VALUE) &&
    !collectSources('src/integrations/crm').includes('process.env'),
)

console.log('— Rejections —')
const cancelledIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'cancelled@example.com',
  },
})
cancelStudioAutomationActionIntent({ companyId: studio, intentId: cancelledIntent.id })
const cancelledResult = await executeCrmIntent({
  companyId: studio,
  intentId: cancelledIntent.id,
})
assert(
  '14. cancelled intent rejected',
  cancelledResult.ok === false &&
    cancelledResult.outcome.status === CRM_OUTCOME_STATUS.REJECTED &&
    cancelledResult.outcome.failureCode === CRM_FAILURE_CODE.INTENT_CANCELLED &&
    getMockCrmRecord({
      companyId: studio,
      connectionId: conn.id,
      recordType: CRM_RECORD_TYPE.CONTACT,
      externalKey: 'contact:cancelled@example.com',
    }) === null,
)

const disabledIntent = seedCrmIntent({
  payload: {
    connectionId: disabledConn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'disabled@example.com',
  },
})
const disabledResult = await executeCrmIntent({
  companyId: studio,
  intentId: disabledIntent.id,
})
assert(
  '15. disabled connection rejected',
  disabledResult.ok === false &&
    disabledResult.outcome.failureCode === CRM_FAILURE_CODE.CONNECTION_DISABLED,
)

const nullProviderIntent = seedCrmIntent({
  payload: {
    connectionId: nullConn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'nulled@example.com',
  },
})
const nullProviderResult = await executeCrmIntent({
  companyId: studio,
  intentId: nullProviderIntent.id,
})
assert(
  '9b. null provider connection rejects with provider_disabled',
  nullProviderResult.ok === false &&
    nullProviderResult.outcome.failureCode === CRM_FAILURE_CODE.PROVIDER_DISABLED,
)

const capabilityIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'capability@example.com',
  },
})
setCrmCapabilityOverrideForTests(false)
const capabilityResult = await executeCrmIntent({
  companyId: studio,
  intentId: capabilityIntent.id,
})
const studioBlocked = await executeStudioCrmIntent({
  companyId: studio,
  intentId: capabilityIntent.id,
}).catch((error) => error)
setCrmCapabilityOverrideForTests(null)
assert(
  '16. capability-off rejection',
  capabilityResult.ok === false &&
    capabilityResult.outcome.status === CRM_OUTCOME_STATUS.REJECTED &&
    capabilityResult.outcome.failureCode === CRM_FAILURE_CODE.CAPABILITY_DISABLED &&
    studioBlocked instanceof ForbiddenError,
)

const fabricatedIntent = seedCrmIntent({
  payload: {
    connectionId: 'crmc_fabricated_does_not_exist',
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'fabricated@example.com',
  },
})
const fabricatedResult = await executeCrmIntent({
  companyId: studio,
  intentId: fabricatedIntent.id,
})
assert(
  '25. fabricated connection rejected',
  fabricatedResult.ok === false &&
    fabricatedResult.outcome.failureCode === CRM_FAILURE_CODE.NOT_FOUND,
)

console.log('— Company isolation —')
const crossCompanyIntent = seedCrmIntent({
  payload: {
    connectionId: otherConn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'cross@example.com',
  },
})
const crossCompanyResult = await executeCrmIntent({
  companyId: studio,
  intentId: crossCompanyIntent.id,
})
const overrideIntent = seedCrmIntent({
  payload: {
    connectionId: otherConn.id,
    companyId: otherCompany,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'override@example.com',
  },
})
// Fresh intent with no outcome yet, so the company check is the scope check.
const scopeProbeIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: CRM_OPERATION.UPSERT_CONTACT,
    'record.email': 'scope-probe@example.com',
  },
})
const overrideResult = await executeCrmIntent({
  companyId: studio,
  intentId: overrideIntent.id,
})
assert(
  '24. company isolation across config/execute/outcomes',
  crossCompanyResult.ok === false &&
    crossCompanyResult.outcome.failureCode === CRM_FAILURE_CODE.NOT_FOUND &&
    listStudioCrmOutcomes(otherCompany).length === 0 &&
    listStudioCrmOutcomes(studio).every((item) => item.companyId === studio) &&
    threw(() => upsertCrmConnectionForCompany(studio, { ...otherConn })) instanceof
      ForbiddenError,
)
assert(
  '26. no client company override',
  overrideResult.ok === false &&
    overrideResult.outcome.failureCode === CRM_FAILURE_CODE.NOT_FOUND &&
    (await executeStudioCrmIntent({
      companyId: otherCompany,
      intentId: scopeProbeIntent.id,
    }).catch((error) => error)) instanceof ForbiddenError &&
    listStudioCrmOutcomes(otherCompany).length === 0 &&
    threw(() =>
      patchStudioCrmConnection({
        companyId: studio,
        id: otherConn.id,
        name: 'hijacked',
      }),
    ) instanceof ForbiddenError,
)

console.log('— Failure taxonomy —')
async function forcedFailure(failureCode, retryable, email) {
  const intent = seedCrmIntent({
    payload: {
      connectionId: conn.id,
      operation: CRM_OPERATION.UPSERT_CONTACT,
      'record.email': email,
    },
  })
  setMockCrmFailureForTests({ failureCode, retryable, message: `forced ${failureCode}` })
  return executeCrmIntent({ companyId: studio, intentId: intent.id })
}

const providerFail = await forcedFailure(CRM_FAILURE_CODE.PROVIDER_ERROR, true, 'p@e.test')
assert(
  '27. provider failure classification',
  providerFail.ok === false &&
    providerFail.outcome.status === CRM_OUTCOME_STATUS.FAILED &&
    providerFail.outcome.failureCode === CRM_FAILURE_CODE.PROVIDER_ERROR,
)

const validationIntent = seedCrmIntent({
  payload: { connectionId: conn.id, operation: CRM_OPERATION.UPSERT_CONTACT },
})
const validationFail = await executeCrmIntent({
  companyId: studio,
  intentId: validationIntent.id,
})
assert(
  '28. validation failure classification',
  validationFail.ok === false &&
    validationFail.outcome.status === CRM_OUTCOME_STATUS.REJECTED &&
    validationFail.outcome.failureCode === CRM_FAILURE_CODE.VALIDATION_FAILURE,
)

const authFail = await forcedFailure(CRM_FAILURE_CODE.AUTH_FAILURE, false, 'a@e.test')
assert(
  '29. auth failure classification',
  authFail.ok === false && authFail.outcome.failureCode === CRM_FAILURE_CODE.AUTH_FAILURE,
)

const rateFail = await forcedFailure(CRM_FAILURE_CODE.RATE_LIMITED, true, 'r@e.test')
assert(
  '30. rate-limited classification',
  rateFail.ok === false &&
    rateFail.outcome.failureCode === CRM_FAILURE_CODE.RATE_LIMITED &&
    rateFail.outcome.retryable === true,
)

const unsupportedIntent = seedCrmIntent({
  payload: {
    connectionId: conn.id,
    operation: 'associate_records',
    'record.email': 'u@e.test',
  },
})
const unsupportedResult = await executeCrmIntent({
  companyId: studio,
  intentId: unsupportedIntent.id,
})
assert(
  '31. unsupported operation classification',
  unsupportedResult.ok === false &&
    unsupportedResult.outcome.status === CRM_OUTCOME_STATUS.REJECTED &&
    unsupportedResult.outcome.failureCode === CRM_FAILURE_CODE.UNSUPPORTED_OPERATION &&
    unsupportedResult.outcome.operation === null,
)

clearMockCrmFailureForTests()
const rateRetry = await executeCrmIntent({
  companyId: studio,
  intentId: rateFail.outcome.intentId,
})
assert(
  '32. retryable metadata is informational only',
  rateRetry.duplicate === true &&
    rateRetry.outcome.id === rateFail.outcome.id &&
    rateRetry.outcome.status === CRM_OUTCOME_STATUS.FAILED &&
    rateRetry.outcome.attemptNumber === 1,
)

console.log('— Source honesty —')
const crmSrc = collectSources('src/integrations/crm')
const crmCode = stripComments(crmSrc)
const pluginSrc = sourceOf('server', 'integrationsCrmPlugin.js')
const pluginCode = stripComments(pluginSrc)

assert(
  '33. no retry scheduler',
  !/retrySchedule|scheduleRetry|nextAttemptAt|backoffMs|setTimeout|setInterval/i.test(
    crmCode,
  ) && !/DeadLetter|\bDLQ\b/i.test(crmCode),
)
assert(
  '34. no worker',
  !/worker_threads|new\s+Worker|startWorker|\bcron\b|BullMQ/i.test(crmCode) &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false,
)
assert(
  '35. no outbox',
  !/processOutbox|createOutbox|drainOutbox|leaseUntil|claimNext|enqueueDelivery/i.test(
    crmCode,
  ),
)
assert(
  '36. no OAuth',
  !/\boauth(2)?(Client|Token|Flow|Authorize|Provider)\b|exchangeCodeForToken|refreshAccessToken/i.test(
    crmCode,
  ) &&
    !/oauth/i.test(pluginCode) &&
    INTEGRATION_CAPABILITIES.oauth === false,
)
assert(
  '37. no vendor SDK',
  !/from\s+['"](?:@?stripe|@?hubspot|jsforce|@salesforce|pipedrive|@slack|twilio|googleapis|docusign)/i.test(
    crmSrc,
  ) &&
    !/from\s+['"](?:@?stripe|@?hubspot|jsforce|@salesforce|pipedrive)/i.test(pluginSrc) &&
    INTEGRATION_CAPABILITIES.vendorSdks === false,
)
assert(
  '39. no network for mock_crm',
  !/\bfetch\s*\(|\baxios\b|https?\.request\b|XMLHttpRequest|node:https|node:http\b|undici/i.test(
    crmCode,
  ) && mockAdapter.describe().network === false,
)
assert(
  '40. no H15 imports',
  !crmCode.includes('commercialClose') &&
    !pluginCode.includes('commercialClose') &&
    COMMERCIAL_CLOSE_CAPABILITIES.crm === false,
)

console.log('— Boundaries —')
assert(
  '41. no CommercialClose mutation',
  threw(() => refuseCommercialCloseMutation()) instanceof ForbiddenError,
)
assert(
  '42. no decision mutation',
  threw(() => refuseDecisionSnapshotMutation()) instanceof ForbiddenError,
)
assert(
  '43. no proposal mutation',
  threw(() => refuseProposalContentMutation()) instanceof ForbiddenError &&
    !crmCode.includes('proposals.json') &&
    !pluginCode.includes('proposals.json'),
)
assert(
  '44. no Forge execution',
  FORGE_CAPABILITIES.crm === false &&
    FORGE_CAPABILITIES.thirdPartyIntegrations === false &&
    !sourceOf('src', 'forge', 'repository.js').includes('integrations/crm') &&
    !sourceOf('src', 'forge', 'index.js').includes('integrations/crm'),
)

console.log('— H16.3 / H16.4 compatibility —')
assert(
  'H16.3 enqueue_crm_intent maps to the crm kind',
  AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_CRM_INTENT === CRM_INTENT_ACTION_TYPE &&
    kindForDeferredEnqueueAction(CRM_INTENT_ACTION_TYPE) === INTEGRATION_KIND.CRM,
)
assert(
  'H16.4 deferred recording stays record-only',
  recordDeferredAutomationActionIntent({
    companyId: studio,
    actionType: CRM_INTENT_ACTION_TYPE,
    eventId: 'aevt_h166_record_only',
    ruleId: 'arule_h166_record_only',
    ruleVersion: 1,
    actionIndex: 0,
    payload: { connectionId: conn.id, operation: CRM_OPERATION.CREATE_NOTE },
  }).ok === true &&
    getStudioAutomationActionIntent(studio, okIntent.id).status ===
      AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
)

const wrongKindIntent = recordAutomationActionIntent(
  makeAutomationActionIntent({
    companyId: studio,
    kind: INTEGRATION_KIND.OUTBOUND_WEBHOOK,
    actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
    eventId: 'aevt_h166_wrong_kind',
    ruleId: 'arule_h166_wrong',
    ruleVersion: 1,
    actionIndex: 0,
    payload: { destinationId: 'owhd_x' },
  }),
).intent
const wrongKindResult = await executeCrmIntent({
  companyId: studio,
  intentId: wrongKindIntent.id,
})
assert(
  'CRM execution refuses non-crm intents',
  wrongKindResult.ok === false &&
    wrongKindResult.outcome.failureCode === CRM_FAILURE_CODE.INVALID_CONFIGURATION,
)
assert(
  'unknown intent still raises NotFoundError',
  (await executeCrmIntent({ companyId: studio, intentId: 'aint_missing' }).catch(
    (error) => error,
  )) instanceof NotFoundError,
)

assert('proposals unchanged during H16.6 checks', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log('— Nested regressions —')
const h165 = runSuite('verify-integrations-outbound-webhooks.mjs')
assert('45. H16.5 webhook suite remains green', h165.ok, h165.ok ? '' : h165.output.slice(-3000))
// H16.5 nests H16.4 → H16.3 → H16.2 → H16.1 → H15.1–H15.7.
assert('46. H16.4 action-intent suite remains green (nested)', h165.ok)
assert('47. H16.3 rules remain green (nested)', h165.ok)
assert('48. H16.2 event intake remains green (nested)', h165.ok)
assert('49. H16.1 foundation remains green (nested)', h165.ok)
assert('50. H15 completion remains green (nested)', h165.ok)

assert('51. data/proposals.json byte-identical', proposalsSnapshot() === proposalsBefore)

const diffCheck = spawnSync('git', ['diff', '--check'], {
  encoding: 'utf8',
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})
assert(
  '52. git diff --check clean',
  diffCheck.status === 0 && !(diffCheck.stdout || '').trim(),
  (diffCheck.stdout || '').slice(0, 500),
)

try {
  rmSync(tempDir, { recursive: true, force: true })
} catch {
  /* ignore */
}
delete process.env.PF_TEST_CRM_API_KEY

console.log('')
console.log(`H16.6 CRM checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
