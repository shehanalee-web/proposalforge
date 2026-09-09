/**
 * H16.5 Outbound Webhook Consumer Boundary verification.
 *
 * Uses a fake/mock transport seam — never enables unrestricted production network.
 * Never writes data/proposals.json.
 * Application-level idempotency is not network exactly-once delivery.
 */
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import {
  configureFollowupResolvers,
  resetFollowupStore,
  allFollowupRecords,
} from '../src/followup/index.js'
import {
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  AUTOMATION_RULE_ACTION_TYPE,
  AUTOMATION_ACTION_INTENT_STATUS,
  OUTBOUND_WEBHOOK_FAILURE_CODE,
  OUTBOUND_WEBHOOK_OUTCOME_STATUS,
  OUTBOUND_WEBHOOK_LIMITS,
  OUTBOUND_WEBHOOK_NETWORK_ENV,
  configureAutomationIntakeStore,
  configureAutomationRulesStore,
  configureAutomationActionIntentStore,
  configureOutboundWebhookDestinationStore,
  configureOutboundWebhookOutcomeStore,
  ingestAutomationEvent,
  makeAutomationEvent,
  upsertStudioAutomationRule,
  listStudioAutomationActionIntents,
  getStudioAutomationActionIntent,
  cancelStudioAutomationActionIntent,
  resetAutomationIntakeStore,
  resetAutomationRulesStore,
  resetAutomationRuleRunsStore,
  resetAutomationActionIntentStore,
  resetOutboundWebhookDestinationStore,
  resetOutboundWebhookOutcomeStore,
  serializeAutomationIntakeLedger,
  serializeAutomationRules,
  serializeAutomationRuleRuns,
  serializeAutomationActionIntents,
  serializeOutboundWebhookDestinations,
  serializeOutboundWebhookOutcomes,
  upsertStudioOutboundWebhookDestination,
  getStudioOutboundWebhookDestination,
  makeOutboundWebhookDestination,
  presentStudioOutboundWebhookDestination,
  buildOutboundWebhookEnvelope,
  serializeOutboundWebhookEnvelope,
  stableStringify,
  signOutboundWebhookBody,
  buildOutboundWebhookSignatureHeaders,
  validateOutboundWebhookUrl,
  isBlockedOutboundWebhookIp,
  extractIpv4FromMappedIpv6,
  setOutboundWebhookDnsResolverForTests,
  setOutboundWebhookTransportForTests,
  clearOutboundWebhookTransportForTests,
  createFakeOutboundWebhookTransport,
  setOutboundWebhookTestSecrets,
  clearOutboundWebhookTestSecrets,
  setOutboundWebhooksCapabilityOverrideForTests,
  executeOutboundWebhookForIntent,
  findOutboundWebhookOutcomeByIntentId,
  listStudioOutboundWebhookOutcomes,
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
  getAutomationRuleEvaluationDepth,
  recordDeferredAutomationActionIntent,
  makeAutomationActionIntent,
  recordAutomationActionIntent,
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
      else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        files.push(full)
      }
    }
  }
  walk(base)
  return files.map((file) => readFileSync(file, 'utf8')).join('\n')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: process.env.CI || '1' },
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  }
}

const proposalsBefore = proposalsSnapshot()
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const tempDir = mkdtempSync(join(tmpdir(), 'pf-h165-'))
const intakeFile = join(tempDir, 'automation-intake.json')
const rulesFile = join(tempDir, 'automation-rules.json')
const runsFile = join(tempDir, 'automation-rule-runs.json')
const intentsFile = join(tempDir, 'automation-action-intents.json')
const destinationsFile = join(tempDir, 'outbound-webhook-destinations.json')
const outcomesFile = join(tempDir, 'outbound-webhook-outcomes.json')

const proposalCatalog = new Map([
  [
    'prop-h165',
    {
      id: 'prop-h165',
      companyId: studio,
      title: 'H16.5 Proposal',
      shareToken: 'share-h165',
    },
  ],
])

configureFollowupResolvers({
  getProposal(proposalId, companyId) {
    const found = proposalCatalog.get(proposalId) ?? null
    if (!found || found.companyId !== companyId) return null
    return found
  },
  listProposals(companyId) {
    return [...proposalCatalog.values()].filter(
      (item) => item.companyId === companyId,
    )
  },
})

function persistIntake(ledger) {
  writeFileSync(
    intakeFile,
    `${JSON.stringify({ receipts: ledger?.receipts ?? [], events: ledger?.events ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistRules(bag) {
  writeFileSync(
    rulesFile,
    `${JSON.stringify({ rules: bag?.rules ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistRuns(bag) {
  writeFileSync(
    runsFile,
    `${JSON.stringify({ runs: bag?.runs ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistIntents(bag) {
  writeFileSync(
    intentsFile,
    `${JSON.stringify({ intents: bag?.intents ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistDestinations(bag) {
  writeFileSync(
    destinationsFile,
    `${JSON.stringify({ destinations: bag?.destinations ?? [] }, null, 2)}\n`,
    'utf8',
  )
}
function persistOutcomes(bag) {
  writeFileSync(
    outcomesFile,
    `${JSON.stringify({ outcomes: bag?.outcomes ?? [] }, null, 2)}\n`,
    'utf8',
  )
}

function resetAll() {
  resetFollowupStore([])
  resetAutomationIntakeStore({ receipts: [], events: [] })
  resetAutomationRulesStore({ rules: [] })
  resetAutomationRuleRunsStore({ runs: [] })
  resetAutomationActionIntentStore({ intents: [] })
  resetOutboundWebhookDestinationStore({ destinations: [] })
  resetOutboundWebhookOutcomeStore({ outcomes: [] })
  configureAutomationIntakeStore({ persist: persistIntake })
  configureAutomationRulesStore({ persistRules, persistRuns })
  configureAutomationActionIntentStore({ persist: persistIntents })
  configureOutboundWebhookDestinationStore({ persist: persistDestinations })
  configureOutboundWebhookOutcomeStore({ persist: persistOutcomes })
  persistIntake(serializeAutomationIntakeLedger())
  persistRules(serializeAutomationRules())
  persistRuns(serializeAutomationRuleRuns())
  persistIntents(serializeAutomationActionIntents())
  persistDestinations(serializeOutboundWebhookDestinations())
  persistOutcomes(serializeOutboundWebhookOutcomes())
  clearOutboundWebhookTransportForTests()
  clearOutboundWebhookTestSecrets()
  setOutboundWebhookDnsResolverForTests(null)
  setOutboundWebhooksCapabilityOverrideForTests(null)
  delete process.env[OUTBOUND_WEBHOOK_NETWORK_ENV]
}

resetAll()

console.log('— Capabilities —')
assert('1. outboundWebhooks === true', INTEGRATION_CAPABILITIES.outboundWebhooks === true)
assert(
  '2. previous capabilities remain correct (crm true in H16.6)',
  INTEGRATION_CAPABILITIES.integrationFoundation === true &&
    INTEGRATION_CAPABILITIES.eventIntake === true &&
    INTEGRATION_CAPABILITIES.automationRules === true &&
    INTEGRATION_CAPABILITIES.actionIntents === true &&
    INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.crm === true &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

console.log('— Destination model / company isolation / secrets —')
let missingCompany = null
try {
  makeOutboundWebhookDestination({
    name: 'x',
    endpointUrl: 'https://hooks.example.test/h',
    signingSecretRef: 'env:WEBHOOK_SECRET',
  })
} catch (error) {
  missingCompany = error
}
assert(
  '3. destination requires companyId',
  missingCompany instanceof ValidationError,
)

const destination = upsertStudioOutboundWebhookDestination({
  companyId: studio,
  name: 'Studio hook',
  endpointUrl: 'https://hooks.example.test/hook',
  signingSecretRef: 'env:PF_TEST_WEBHOOK_SECRET',
  enabled: true,
  headers: { 'x-request-id': 'req-1' },
  timeoutMs: 3000,
})
assert(
  '6. secret references accepted',
  destination.signingSecretRef === 'env:PF_TEST_WEBHOOK_SECRET',
)

let crossCompany = null
try {
  getStudioOutboundWebhookDestination(otherCompany, destination.id)
} catch (error) {
  crossCompany = error
}
assert(
  '4. cross-company destination access rejected',
  crossCompany instanceof ForbiddenError,
)

let rawSecret = null
try {
  makeOutboundWebhookDestination({
    companyId: studio,
    name: 'bad',
    endpointUrl: 'https://hooks.example.test/x',
    signingSecret: 'super-secret-value',
    signingSecretRef: 'env:X',
  })
} catch (error) {
  rawSecret = error
}
assert('5. raw secrets rejected', rawSecret instanceof ValidationError)

const projected = presentStudioOutboundWebhookDestination(destination)
const projectedText = JSON.stringify(projected)
assert(
  '7. secrets never appear in destination projections',
  projected.signingSecretRef === 'env:PF_TEST_WEBHOOK_SECRET' &&
    !projectedText.includes('super-secret') &&
    projected.signingSecret == null &&
    !Object.prototype.hasOwnProperty.call(projected, 'signingSecret'),
)

console.log('— Envelope + signing —')
const sampleIntent = makeAutomationActionIntent({
  companyId: studio,
  kind: INTEGRATION_KIND.OUTBOUND_WEBHOOK,
  actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
  eventId: 'aevt_sample',
  ruleId: 'arule_sample',
  ruleVersion: 1,
  actionIndex: 0,
  payload: {
    destinationId: destination.id,
    note: 'safe note',
    apiKey: 'should-strip',
    amount: 99,
  },
  correlation: { proposalId: 'prop-h165', actorId: DEFAULT_ACTOR_ID },
})
const envelope = buildOutboundWebhookEnvelope(sampleIntent, {
  envelopeId: 'owhe-fixed',
  occurredAt: '2026-01-01T00:00:00.000Z',
})
const body1 = serializeOutboundWebhookEnvelope(envelope)
const body2 = serializeOutboundWebhookEnvelope(
  buildOutboundWebhookEnvelope(sampleIntent, {
    envelopeId: 'owhe-fixed',
    occurredAt: '2026-01-01T00:00:00.000Z',
  }),
)
assert(
  '8. deterministic envelope serialization',
  body1 === body2 &&
    envelope.type === 'automation.outbound_webhook' &&
    envelope.data.note === 'safe note' &&
    envelope.data.apiKey == null &&
    envelope.data.amount == null &&
    envelope.data.destinationId == null &&
    stableStringify({ b: 1, a: 2 }) === '{"a":2,"b":1}',
)

const sig1 = signOutboundWebhookBody('1700000000', body1, 'test-secret')
const sig2 = signOutboundWebhookBody('1700000000', body1, 'test-secret')
const expected = `v1=${createHmac('sha256', 'test-secret')
  .update('1700000000.' + body1, 'utf8')
  .digest('hex')}`
assert('9. deterministic HMAC signature', sig1 === sig2 && sig1 === expected)

const headers = buildOutboundWebhookSignatureHeaders({
  rawBody: body1,
  secret: 'test-secret',
  idempotencyKey: sampleIntent.id,
  timestamp: '1700000000',
})
assert(
  '10. correct signature headers',
  headers['X-Webhook-Timestamp'] === '1700000000' &&
    headers['X-Webhook-Signature'] === expected &&
    headers['X-Webhook-Idempotency-Key'] === sampleIntent.id,
)

console.log('— SSRF / URL policy —')
assert('17. localhost rejected (name)', (await validateOutboundWebhookUrl('https://localhost/hook')).failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED)
assert('18. 127.0.0.1 rejected', (await validateOutboundWebhookUrl('https://127.0.0.1/hook')).failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED)
assert('19. ::1 rejected', (await validateOutboundWebhookUrl('https://[::1]/hook')).failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED)
assert('20. RFC1918/private address rejected', (await validateOutboundWebhookUrl('https://10.0.0.8/hook')).failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED)
assert('21. link-local rejected', isBlockedOutboundWebhookIp('169.254.10.1') === true)
assert('22. metadata endpoint rejected', (await validateOutboundWebhookUrl('https://169.254.169.254/latest')).failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED)
assert(
  '16. unsafe schemes rejected',
  (await validateOutboundWebhookUrl('file:///etc/passwd')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    (await validateOutboundWebhookUrl('ftp://example.com/x')).failureCode ===
      OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    (await validateOutboundWebhookUrl('data:text/plain,hi')).failureCode ===
      OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    (await validateOutboundWebhookUrl('http://hooks.example.test/x')).failureCode ===
      OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
)

assert(
  'mapped. ::ffff:127.0.0.1 rejected',
  (await validateOutboundWebhookUrl('https://[::ffff:127.0.0.1]/x')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    extractIpv4FromMappedIpv6('::ffff:127.0.0.1') === '127.0.0.1',
)
assert(
  'mapped. ::ffff:7f00:1 (hex loopback) rejected',
  (await validateOutboundWebhookUrl('https://[::ffff:7f00:1]/x')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    extractIpv4FromMappedIpv6('::ffff:7f00:1') === '127.0.0.1',
)
assert(
  'mapped. RFC1918 ::ffff:0a00:0001 rejected',
  (await validateOutboundWebhookUrl('https://[::ffff:0a00:1]/x')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    extractIpv4FromMappedIpv6('::ffff:0a00:1') === '10.0.0.1',
)
assert(
  'mapped. link-local ::ffff:a9fe:0001 rejected',
  (await validateOutboundWebhookUrl('https://[::ffff:a9fe:1]/x')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    extractIpv4FromMappedIpv6('::ffff:a9fe:1') === '169.254.0.1',
)
assert(
  'mapped. metadata ::ffff:a9fe:a9fe rejected',
  (await validateOutboundWebhookUrl('https://[::ffff:a9fe:a9fe]/latest')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED &&
    extractIpv4FromMappedIpv6('::ffff:a9fe:a9fe') === '169.254.169.254',
)
assert(
  'mapped. safe public IPv6 still accepted',
  (await validateOutboundWebhookUrl('https://[2001:4860:4860::8888]/hook')).ok === true &&
    isBlockedOutboundWebhookIp('2001:4860:4860::8888') === false,
)

setOutboundWebhookDnsResolverForTests(async () => [{ address: '8.8.8.8', family: 4 }])
assert(
  '15. HTTPS-only live behavior (https allowed after safe DNS)',
  (await validateOutboundWebhookUrl('https://hooks.example.test/hook')).ok === true,
)

setOutboundWebhookDnsResolverForTests(async () => [{ address: '192.168.1.20', family: 4 }])
assert(
  '20b. hostname resolving to private IP rejected',
  (await validateOutboundWebhookUrl('https://hooks.example.test/hook')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
)
setOutboundWebhookDnsResolverForTests(async () => [
  { address: '::ffff:7f00:1', family: 6 },
])
assert(
  '20c. DNS AAAA IPv4-mapped loopback rejected',
  (await validateOutboundWebhookUrl('https://hooks.example.test/hook')).failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.SSRF_REJECTED,
)
setOutboundWebhookDnsResolverForTests(async () => [{ address: '8.8.8.8', family: 4 }])

console.log('— Execution pipeline with fake transport —')
resetAll()
setOutboundWebhookDnsResolverForTests(async () => [{ address: '8.8.8.8', family: 4 }])
setOutboundWebhookTestSecrets({
  'env:PF_TEST_WEBHOOK_SECRET': 'unit-test-signing-secret',
})

const dest = upsertStudioOutboundWebhookDestination({
  companyId: studio,
  name: 'Exec hook',
  endpointUrl: 'https://hooks.example.test/deliver',
  signingSecretRef: 'env:PF_TEST_WEBHOOK_SECRET',
  enabled: true,
  timeoutMs: 2000,
})

function seedWebhookIntent(overrides = {}) {
  return recordAutomationActionIntent(
    makeAutomationActionIntent({
      companyId: studio,
      kind: INTEGRATION_KIND.OUTBOUND_WEBHOOK,
      actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
      eventId: overrides.eventId || `aevt_${Math.random().toString(36).slice(2, 10)}`,
      ruleId: overrides.ruleId || 'arule_h165',
      ruleVersion: 1,
      actionIndex: overrides.actionIndex ?? 0,
      payload: {
        destinationId: overrides.destinationId || dest.id,
        note: 'payload-note',
      },
      correlation: { proposalId: 'prop-h165' },
      ...overrides.intent,
    }),
  ).intent
}

let postCount = 0
let lastRequest = null
setOutboundWebhookTransportForTests(
  createFakeOutboundWebhookTransport(async (request) => {
    postCount += 1
    lastRequest = request
    if (request._force === 'timeout') {
      return {
        ok: false,
        failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.TIMEOUT,
        message: 'Outbound webhook request timed out.',
      }
    }
    const status = request._status || 200
    const bodyText = request._bodyText || '{"ok":true}'
    const tooLarge =
      request._tooLarge === true ||
      Buffer.byteLength(bodyText, 'utf8') > OUTBOUND_WEBHOOK_LIMITS.MAX_RESPONSE_BODY_BYTES
    return {
      ok: true,
      status,
      bodyText: tooLarge
        ? bodyText.slice(0, 100)
        : bodyText,
      tooLarge,
      byteLength: Buffer.byteLength(bodyText, 'utf8'),
    }
  }),
)

// Fake transport is allowed without OUTBOUND_WEBHOOK_NETWORK=1
const intentOk = seedWebhookIntent({ eventId: 'aevt_ok' })
const resultOk = await executeOutboundWebhookForIntent({
  companyId: studio,
  intentId: intentOk.id,
})
assert(
  '28. 2xx produces succeeded',
  resultOk.ok &&
    resultOk.outcome.status === OUTBOUND_WEBHOOK_OUTCOME_STATUS.SUCCEEDED &&
    resultOk.outcome.httpStatus === 200 &&
    postCount === 1,
)
assert(
  '34. application-level idempotency is based on intent identity',
  resultOk.outcome.idempotencyKey === intentOk.id &&
    resultOk.outcome.intentId === intentOk.id,
)
assert(
  '35. outcome persisted separately from intent',
  findOutboundWebhookOutcomeByIntentId(intentOk.id)?.id === resultOk.outcome.id &&
    getStudioAutomationActionIntent(studio, intentOk.id).status ===
      AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
)
assert(
  '36. H16.4 intent remains recorded after delivery',
  getStudioAutomationActionIntent(studio, intentOk.id).status ===
    AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
)

const dup = await executeOutboundWebhookForIntent({
  companyId: studio,
  intentId: intentOk.id,
})
assert(
  '33. duplicate execute does not POST twice',
  dup.duplicate === true &&
    postCount === 1 &&
    dup.outcome.id === resultOk.outcome.id,
)

assert(
  'signature headers present on POST',
  lastRequest?.headers?.['X-Webhook-Signature']?.startsWith('v1=') &&
    lastRequest?.headers?.['X-Webhook-Timestamp'] &&
    lastRequest?.headers?.['X-Webhook-Idempotency-Key'] === intentOk.id &&
    !JSON.stringify(lastRequest).includes('unit-test-signing-secret'),
)

// Cancelled intent
const intentCancel = seedWebhookIntent({ eventId: 'aevt_cancel', actionIndex: 1 })
cancelStudioAutomationActionIntent({
  companyId: studio,
  intentId: intentCancel.id,
})
const beforeCancelPosts = postCount
const cancelResult = await executeOutboundWebhookForIntent({
  companyId: studio,
  intentId: intentCancel.id,
})
assert(
  '11. cancelled intent rejected',
  cancelResult.ok === false &&
    cancelResult.outcome.failureCode ===
      OUTBOUND_WEBHOOK_FAILURE_CODE.INTENT_CANCELLED &&
    postCount === beforeCancelPosts &&
    getStudioAutomationActionIntent(studio, intentCancel.id).status ===
      AUTOMATION_ACTION_INTENT_STATUS.CANCELLED,
)

// Disabled destination
const disabledDest = upsertStudioOutboundWebhookDestination({
  companyId: studio,
  name: 'Disabled',
  endpointUrl: 'https://hooks.example.test/disabled',
  signingSecretRef: 'env:PF_TEST_WEBHOOK_SECRET',
  enabled: false,
})
const intentDisabled = seedWebhookIntent({
  eventId: 'aevt_disabled',
  actionIndex: 2,
  destinationId: disabledDest.id,
})
const beforeDisabledPosts = postCount
const disabledResult = await executeOutboundWebhookForIntent({
  companyId: studio,
  intentId: intentDisabled.id,
})
assert(
  '12. disabled destination rejected',
  disabledResult.outcome.failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.DESTINATION_DISABLED &&
    postCount === beforeDisabledPosts,
)

// Capability off
setOutboundWebhooksCapabilityOverrideForTests(false)
const intentCap = seedWebhookIntent({ eventId: 'aevt_cap', actionIndex: 3 })
const beforeCapPosts = postCount
const capResult = await executeOutboundWebhookForIntent({
  companyId: studio,
  intentId: intentCap.id,
})
assert(
  '13. capability-off rejected',
  capResult.outcome.failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.CAPABILITY_DISABLED &&
    postCount === beforeCapPosts,
)
setOutboundWebhooksCapabilityOverrideForTests(null)

// Network guard off (no fake transport)
clearOutboundWebhookTransportForTests()
delete process.env[OUTBOUND_WEBHOOK_NETWORK_ENV]
const intentNet = seedWebhookIntent({ eventId: 'aevt_net', actionIndex: 4 })
const netResult = await executeOutboundWebhookForIntent({
  companyId: studio,
  intentId: intentNet.id,
})
assert(
  '14. network guard-off rejected',
  netResult.outcome.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_DISABLED,
)

// Restore fake transport for remaining HTTP classification tests
setOutboundWebhookTransportForTests(
  createFakeOutboundWebhookTransport(async (request) => {
    postCount += 1
    lastRequest = request
    if (request.url.includes('/timeout')) {
      return {
        ok: false,
        failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.TIMEOUT,
        message: 'Outbound webhook request timed out.',
      }
    }
    if (request.url.includes('/redirect')) {
      return { ok: true, status: 302, bodyText: '', tooLarge: false, byteLength: 0 }
    }
    if (request.url.includes('/4xx')) {
      return { ok: true, status: 404, bodyText: 'nope', tooLarge: false, byteLength: 4 }
    }
    if (request.url.includes('/5xx')) {
      return { ok: true, status: 503, bodyText: 'down', tooLarge: false, byteLength: 4 }
    }
    if (request.url.includes('/network')) {
      return {
        ok: false,
        failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_FAILURE,
        message: 'Outbound webhook network failure.',
      }
    }
    if (request.url.includes('/huge')) {
      return {
        ok: true,
        status: 200,
        bodyText: 'x',
        tooLarge: true,
        byteLength: OUTBOUND_WEBHOOK_LIMITS.MAX_RESPONSE_BODY_BYTES + 10,
      }
    }
    return { ok: true, status: 200, bodyText: '{"ok":true}', tooLarge: false, byteLength: 11 }
  }),
)

async function runAgainstPath(pathSuffix, eventId, actionIndex) {
  const d = upsertStudioOutboundWebhookDestination({
    companyId: studio,
    name: pathSuffix,
    endpointUrl: `https://hooks.example.test${pathSuffix}`,
    signingSecretRef: 'env:PF_TEST_WEBHOOK_SECRET',
    enabled: true,
  })
  const intent = seedWebhookIntent({
    eventId,
    actionIndex,
    destinationId: d.id,
  })
  return executeOutboundWebhookForIntent({ companyId: studio, intentId: intent.id })
}

const redirectResult = await runAgainstPath('/redirect', 'aevt_redir', 10)
assert(
  '23/29. unsafe redirect rejected / 3xx handled without redirect',
  redirectResult.outcome.failureCode ===
    OUTBOUND_WEBHOOK_FAILURE_CODE.REDIRECT_REJECTED &&
    redirectResult.outcome.httpStatus === 302,
)

const timeoutResult = await runAgainstPath('/timeout', 'aevt_timeout', 11)
assert(
  '24. timeout enforced',
  timeoutResult.outcome.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.TIMEOUT,
)

const fourResult = await runAgainstPath('/4xx', 'aevt_4xx', 12)
assert(
  '30. 4xx classified',
  fourResult.outcome.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.HTTP_4XX &&
    fourResult.outcome.status === OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
)

const fiveResult = await runAgainstPath('/5xx', 'aevt_5xx', 13)
assert(
  '31. 5xx classified',
  fiveResult.outcome.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.HTTP_5XX,
)

const networkFail = await runAgainstPath('/network', 'aevt_netfail', 14)
assert(
  '32. network failure classified',
  networkFail.outcome.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_FAILURE,
)

const huge = await runAgainstPath('/huge', 'aevt_huge', 15)
assert(
  '26. response body cap enforced',
  huge.outcome.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.RESPONSE_TOO_LARGE,
)

assert(
  '25. request body cap enforced (limit constant)',
  OUTBOUND_WEBHOOK_LIMITS.MAX_REQUEST_BODY_BYTES === 64 * 1024,
)

let badHeader = null
try {
  makeOutboundWebhookDestination({
    companyId: studio,
    name: 'hdr',
    endpointUrl: 'https://hooks.example.test/h',
    signingSecretRef: 'env:PF_TEST_WEBHOOK_SECRET',
    headers: { Authorization: 'Bearer abc' },
  })
} catch (error) {
  badHeader = error
}
assert('27. custom header allowlist enforced', badHeader instanceof ValidationError)

console.log('— H16.3 compatibility —')
resetAll()
setOutboundWebhookDnsResolverForTests(async () => [{ address: '8.8.8.8', family: 4 }])
setOutboundWebhookTestSecrets({ 'env:PF_TEST_WEBHOOK_SECRET': 'unit-test-signing-secret' })
const ruleDest = upsertStudioOutboundWebhookDestination({
  companyId: studio,
  name: 'Rule dest',
  endpointUrl: 'https://hooks.example.test/rule',
  signingSecretRef: 'env:PF_TEST_WEBHOOK_SECRET',
  enabled: true,
})
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Enqueue webhook',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
      params: {
        destinationId: ruleDest.id,
        note: 'from-rule',
      },
    },
  ],
})
const beforeFu = allFollowupRecords().length
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: {
      domain: 'living',
      entityType: 'living_event',
      eventId: 'lev-h165-wh',
    },
    correlation: { proposalId: 'prop-h165' },
    sourceEventIdentity: 'lev-h165-wh',
  }),
})
const deferredIntents = listStudioAutomationActionIntents(studio)
assert(
  '37. H16.3 deferred action still creates intent',
  deferredIntents.length === 1 &&
    deferredIntents[0].kind === INTEGRATION_KIND.OUTBOUND_WEBHOOK &&
    deferredIntents[0].payload.destinationId === ruleDest.id,
)

upsertStudioAutomationRule({
  companyId: studio,
  name: 'Sync still works',
  priority: 5,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_shared'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: { proposalId: 'prop-h165', title: 'H16.5 sync follow-up' },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_shared',
    companyId: studio,
    source: {
      domain: 'living',
      entityType: 'living_event',
      eventId: 'lev-h165-sync',
    },
    correlation: { proposalId: 'prop-h165' },
    sourceEventIdentity: 'lev-h165-sync',
  }),
})
assert(
  '38. H16.3 existing sync actions remain unchanged',
  allFollowupRecords().some((item) => item.title === 'H16.5 sync follow-up') &&
    allFollowupRecords().length === beforeFu + 1,
)
assert(
  '39. no recursive rule evaluation from webhook execution',
  getAutomationRuleEvaluationDepth() === 0,
)

console.log('— Boundaries / honesty —')
let closeRefuse = null
try {
  refuseCommercialCloseMutation()
} catch (error) {
  closeRefuse = error
}
let decisionRefuse = null
try {
  refuseDecisionSnapshotMutation()
} catch (error) {
  decisionRefuse = error
}
let proposalRefuse = null
try {
  refuseProposalContentMutation()
} catch (error) {
  proposalRefuse = error
}
assert('41. no CommercialClose mutation', closeRefuse instanceof ForbiddenError)
assert('42. no decision mutation', decisionRefuse instanceof ForbiddenError)
assert('43. no proposal mutation', proposalRefuse instanceof ForbiddenError)

const webhookSrc = collectSources('src/integrations/webhooks')
const pluginSrc = sourceOf('server', 'integrationsWebhooksPlugin.js')
assert(
  '40. no H15 provider imports',
  !webhookSrc.includes('commercialClose/providers') &&
    !pluginSrc.includes('commercialClose/providers'),
)
assert(
  '44. no secret leakage in outcomes',
  !JSON.stringify(listStudioOutboundWebhookOutcomes(studio)).includes(
    'unit-test-signing-secret',
  ),
)
assert(
  '45. no vendor SDK',
  !/from\s+['"](?:@?stripe|hubspot|jsforce|@slack|twilio|docusign)/i.test(webhookSrc),
)
assert(
  '46. no OAuth',
  !/\boauth(2)?(Client|Token|Flow)\b/i.test(webhookSrc) &&
    INTEGRATION_CAPABILITIES.oauth === false,
)
assert(
  '47. no inbound webhook ingress',
  INTEGRATION_CAPABILITIES.liveWebhookIngress === false &&
    !webhookSrc.includes('createServer(') &&
    !webhookSrc.includes('.listen('),
)
assert(
  '48. no workers',
  !webhookSrc.includes('Bull') &&
    !webhookSrc.includes('Worker') &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false,
)
assert(
  '49. no outbox',
  !webhookSrc.includes('processOutbox') &&
    !/\bcreateOutbox\b|\bdrainOutbox\b/.test(webhookSrc),
)
assert(
  '50. no retry scheduler',
  !webhookSrc.includes('retrySchedule') &&
    !webhookSrc.includes('DeadLetter') &&
    !webhookSrc.includes('DLQ'),
)
assert(
  'Forge remains non-executing',
  FORGE_CAPABILITIES.emailDelivery === false &&
    !sourceOf('src', 'forge', 'repository.js').includes('outbound-webhook'),
)
assert(
  'recordDeferred still record-only',
  recordDeferredAutomationActionIntent({
    companyId: studio,
    actionType: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
    eventId: 'aevt_record_only',
    ruleId: 'arule_record',
    ruleVersion: 1,
    actionIndex: 0,
    payload: { destinationId: ruleDest.id },
  }).ok === true,
)

assert(
  'proposals unchanged during H16.5 checks',
  proposalsSnapshot() === proposalsBefore,
)

console.log('')
console.log('— Nested regressions —')
const h164 = runSuite('verify-integrations-action-intents.mjs')
assert('51. H16.4 regression passes', h164.ok, h164.ok ? '' : h164.output.slice(-2500))
// H16.4 nests H16.3 → H16.2 → H16.1 → H15
assert(
  '52–55. H16.3/H16.2/H16.1/H15 nested via H16.4 chain',
  h164.ok,
  h164.ok ? '' : 'nested chain failed with H16.4',
)

assert(
  '56. data/proposals.json byte-identical',
  proposalsSnapshot() === proposalsBefore,
)

try {
  rmSync(tempDir, { recursive: true, force: true })
} catch {
  /* ignore */
}

console.log('')
console.log(`H16.5 outbound webhook checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
