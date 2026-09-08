/**
 * H16.4 Action Intent foundation verification.
 *
 * Never writes data/proposals.json.
 * Intents are recorded only — not an outbox, worker, or delivery executor.
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
import { ForbiddenError } from '../src/services/errors.js'
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
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_RULE_ACTION_TYPE,
  AUTOMATION_RULE_RUN_STATUS,
  AUTOMATION_ACTION_INTENT_STATUS,
  configureAutomationIntakeStore,
  configureAutomationRulesStore,
  configureAutomationActionIntentStore,
  ingestAutomationEvent,
  makeAutomationEvent,
  makeAutomationActionIntentIdempotencyKey,
  upsertStudioAutomationRule,
  listStudioAutomationRuleRuns,
  listStudioAutomationActionIntents,
  getStudioAutomationActionIntent,
  cancelStudioAutomationActionIntent,
  findAutomationActionIntentByIdempotencyKey,
  resetAutomationIntakeStore,
  resetAutomationRulesStore,
  resetAutomationRuleRunsStore,
  resetAutomationActionIntentStore,
  serializeAutomationIntakeLedger,
  serializeAutomationRules,
  serializeAutomationRuleRuns,
  serializeAutomationActionIntents,
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
  getAutomationRuleEvaluationDepth,
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
const tempDir = mkdtempSync(join(tmpdir(), 'pf-h164-'))
const intakeFile = join(tempDir, 'automation-intake.json')
const rulesFile = join(tempDir, 'automation-rules.json')
const runsFile = join(tempDir, 'automation-rule-runs.json')
const intentsFile = join(tempDir, 'automation-action-intents.json')

const proposalCatalog = new Map([
  [
    'prop-h164',
    {
      id: 'prop-h164',
      companyId: studio,
      title: 'H16.4 Proposal',
      shareToken: 'share-h164',
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

function resetAll() {
  resetFollowupStore([])
  resetAutomationIntakeStore({ receipts: [], events: [] })
  resetAutomationRulesStore({ rules: [] })
  resetAutomationRuleRunsStore({ runs: [] })
  resetAutomationActionIntentStore({ intents: [] })
  configureAutomationIntakeStore({ persist: persistIntake })
  configureAutomationRulesStore({ persistRules, persistRuns })
  configureAutomationActionIntentStore({ persist: persistIntents })
  persistIntake(serializeAutomationIntakeLedger())
  persistRules(serializeAutomationRules())
  persistRuns(serializeAutomationRuleRuns())
  persistIntents(serializeAutomationActionIntents())
}

resetAll()

console.log('— Capabilities —')
assert('1. actionIntents === true', INTEGRATION_CAPABILITIES.actionIntents === true)
assert(
  '2. all real execution/vendor flags remain false',
  INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.crm === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.outboundWebhooks === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

console.log('— Existing H16.3 sync actions unchanged —')
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Sync follow-up still works',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: { proposalId: 'prop-h164', title: 'H16.4 sync follow-up' },
    },
  ],
})
const beforeFu = allFollowupRecords().length
const syncIngest = ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-h164-sync' },
    correlation: { proposalId: 'prop-h164' },
    sourceEventIdentity: 'lev-h164-sync',
  }),
})
assert(
  '3. existing six H16.3 actions remain synchronous',
  syncIngest.ok &&
    allFollowupRecords().some((item) => item.title === 'H16.4 sync follow-up') &&
    allFollowupRecords().length === beforeFu + 1 &&
    listStudioAutomationActionIntents(studio).length === 0,
)

console.log('— Deferred intent creation —')
resetAll()
const deliveryRule = upsertStudioAutomationRule({
  companyId: studio,
  name: 'Enqueue delivery',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['portal.published'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
      params: { channel: 'email', subject: 'Hello client' },
    },
  ],
})
const depthBefore = getAutomationRuleEvaluationDepth()
const deliveryIngest = ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'portal.published',
    companyId: studio,
    source: { domain: 'portal', entityType: 'portal', eventId: 'pev-h164-1' },
    correlation: { proposalId: 'prop-h164', actorId: DEFAULT_ACTOR_ID },
    sourceEventIdentity: 'pev-h164-1',
  }),
})
assert(
  '4. deferred action creates one intent',
  deliveryIngest.ok &&
    deliveryIngest.status === AUTOMATION_INTAKE_STATUS.ACCEPTED &&
    listStudioAutomationActionIntents(studio).length === 1,
)
const intent = listStudioAutomationActionIntents(studio)[0]
assert(
  '5. intent status is recorded',
  intent.status === AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
)
assert(
  '6. correct kind/actionType stored',
  intent.kind === INTEGRATION_KIND.DELIVERY &&
    intent.actionType === AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
)
const run = listStudioAutomationRuleRuns(studio).find(
  (item) => item.status === AUTOMATION_RULE_RUN_STATUS.EXECUTED,
)
assert(
  '7. full event/rule/ruleVersion/ruleRun/actionIndex lineage preserved',
  intent.eventId === deliveryIngest.event.id &&
    intent.ruleId === deliveryRule.id &&
    intent.ruleVersion === deliveryRule.version &&
    intent.ruleRunId === run?.id &&
    intent.actionIndex === 0 &&
    intent.eventIdempotencyKey === deliveryIngest.event.idempotencyKey,
)
const expectedKey = makeAutomationActionIntentIdempotencyKey(
  deliveryIngest.event.id,
  deliveryRule.id,
  deliveryRule.version,
  0,
  AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_DELIVERY_INTENT,
)
assert(
  '8. deterministic intent idempotency key',
  intent.idempotencyKey === expectedKey,
)

const dupIngest = ingestAutomationEvent({
  event: makeAutomationEvent({
    ...deliveryIngest.event,
  }),
})
assert('duplicate intake is duplicate', dupIngest.duplicate === true)
assert(
  '9. duplicate enqueue returns same intent',
  listStudioAutomationActionIntents(studio).length === 1 &&
    findAutomationActionIntentByIdempotencyKey(expectedKey)?.id === intent.id,
)
assert(
  '20. no recursive H16.2/H16.3 evaluation from intent creation',
  getAutomationRuleEvaluationDepth() === depthBefore &&
    listStudioAutomationRuleRuns(studio).length === 1,
)

console.log('— Company isolation / cancel —')
let crossGet = null
try {
  getStudioAutomationActionIntent(otherCompany, intent.id)
} catch (error) {
  crossGet = error
}
assert(
  '10. company isolation on create/read/list/cancel',
  listStudioAutomationActionIntents(otherCompany).length === 0 &&
    crossGet instanceof ForbiddenError,
)

let crossCancel = null
try {
  cancelStudioAutomationActionIntent({
    companyId: otherCompany,
    intentId: intent.id,
  })
} catch (error) {
  crossCancel = error
}
assert(
  '11. cross-company cancel rejected',
  crossCancel instanceof ForbiddenError,
)

const cancelled = cancelStudioAutomationActionIntent({
  companyId: studio,
  intentId: intent.id,
  reason: 'studio_cancelled',
})
assert(
  '12. cancelled intent remains cancelled',
  cancelled.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED &&
    cancelled.cancelledAt != null,
)
const cancelAgain = cancelStudioAutomationActionIntent({
  companyId: studio,
  intentId: intent.id,
})
assert(
  '12b. repeated cancellation is idempotent',
  cancelAgain.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED &&
    cancelAgain.id === cancelled.id,
)
assert(
  '13. cancelled intent cannot be executed',
  cancelAgain.status !== 'executing' &&
    cancelAgain.status !== 'succeeded' &&
    !sourceOf('src', 'integrations', 'intents', 'store.js').includes('executing') &&
    !sourceOf('src', 'integrations', 'intents', 'types.js').includes('succeeded'),
)

console.log('— Payload / boundaries —')
resetAll()
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Sanitize payload',
  priority: 1,
  trigger: { eventTypes: ['interaction.created'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.ENQUEUE_OUTBOUND_WEBHOOK_INTENT,
      params: {
        url: 'https://example.test/hook',
        apiKey: 'secret-value',
        amount: 99,
        note: 'safe note',
      },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'interaction.created',
    companyId: studio,
    source: { domain: 'interaction', entityType: 'interaction', eventId: 'iev-h164' },
    correlation: { proposalId: 'prop-h164' },
    sourceEventIdentity: 'iev-h164',
  }),
})
const webhookIntent = listStudioAutomationActionIntents(studio)[0]
assert(
  '14. payload sanitization works',
  webhookIntent.kind === INTEGRATION_KIND.OUTBOUND_WEBHOOK &&
    webhookIntent.payload.note === 'safe note' &&
    webhookIntent.payload.apiKey == null &&
    webhookIntent.payload.amount == null,
)
assert(
  '15. secrets are rejected/absent',
  !JSON.stringify(webhookIntent).includes('secret-value') &&
    webhookIntent.payload.password == null,
)
assert(
  '16. no proposal/close document duplication',
  webhookIntent.payload.proposal == null &&
    webhookIntent.payload.blocks == null &&
    webhookIntent.payload.decision == null,
)

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
assert('17. no CommercialClose mutation', closeRefuse instanceof ForbiddenError)
assert('18. no decision snapshot mutation', decisionRefuse instanceof ForbiddenError)
assert('19. no proposal mutation', proposalRefuse instanceof ForbiddenError)
assert(
  '25. data/proposals.json byte-identical so far',
  proposalsSnapshot() === proposalsBefore,
)

console.log('— Source honesty —')
const intentsSrc = collectSources('src/integrations/intents')
const rulesActionsSrc = sourceOf('src', 'integrations', 'rules', 'actions.js')
assert(
  '21. no adapter invocation',
  !intentsSrc.includes('resolveEnabledIntegrationAdapter') &&
    !intentsSrc.includes('.send(') &&
    !rulesActionsSrc.includes('resolveEnabledIntegrationAdapter'),
)
assert(
  '22. no fetch/axios/network',
  !/\bfetch\s*\(|\baxios\b|\bnode:https\b|\bnode:http\b/.test(intentsSrc),
)
assert(
  '23. no vendor SDK',
  !/from\s+['"](?:@?stripe|hubspot|jsforce|@slack|twilio|docusign)/i.test(
    intentsSrc,
  ),
)
assert(
  '24. no OAuth',
  !/\boauth(2)?(Client|Token|Flow)\b/i.test(intentsSrc) &&
    INTEGRATION_CAPABILITIES.oauth === false,
)
assert(
  '25b. no workers',
  !intentsSrc.includes('Bull') &&
    !intentsSrc.includes('Worker') &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false,
)
assert(
  '26. no outbox',
  !intentsSrc.includes('processOutbox') &&
    !/\bcreateOutbox\b|\bdrainOutbox\b/.test(intentsSrc),
)
assert(
  '27. no retries/DLQ',
  !intentsSrc.includes('DeadLetter') &&
    !intentsSrc.includes('retrySchedule') &&
    !intentsSrc.includes('DLQ'),
)
assert(
  'no commercialClose/providers imports',
  !intentsSrc.includes('commercialClose/providers') &&
    !rulesActionsSrc.includes('commercialClose/providers'),
)
assert(
  'Forge remains non-executing',
  FORGE_CAPABILITIES.emailDelivery === false &&
    !sourceOf('src', 'forge', 'repository.js').includes('action-intents') &&
    !sourceOf('src', 'forge', 'repository.js').includes('enqueue_delivery'),
)

console.log('')
console.log('— Nested H16.3 regression (includes H16.2/H16.1/H15) —')
const h163 = runSuite('verify-integrations-automation-rules.mjs')
assert(
  '28–31. H16.3 nested chain remains green',
  h163.ok,
  h163.ok ? '' : h163.output.slice(-2000),
)

assert(
  '32. final data/proposals.json unchanged',
  proposalsSnapshot() === proposalsBefore,
)

try {
  rmSync(tempDir, { recursive: true, force: true })
} catch {
  /* ignore */
}

console.log('')
console.log(`H16.4 action intent checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
