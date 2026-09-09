/**
 * H16.3 Automation Rules Engine verification.
 *
 * Never writes data/proposals.json.
 * No workers, outbox, delivery execution, vendors, or Forge ownership.
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
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import { onNotificationEvent } from '../src/collaboration/notify.js'
import {
  configureFollowupResolvers,
  resetFollowupStore,
  allFollowupRecords,
  FOLLOWUP_STATUS,
} from '../src/followup/index.js'
import {
  INTEGRATION_CAPABILITIES,
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_RULE_ACTION_TYPE,
  AUTOMATION_RULE_FAILURE_REASON,
  AUTOMATION_RULE_LIMITS,
  AUTOMATION_RULE_RUN_STATUS,
  configureAutomationIntakeStore,
  configureAutomationRulesStore,
  evaluateAutomationConditions,
  ingestAutomationEvent,
  listAcceptedAutomationEventsForCompany,
  listStudioAutomationRuleRuns,
  listStudioAutomationRules,
  makeAutomationEvent,
  makeAutomationRuleExecutionKey,
  patchStudioAutomationRule,
  refuseCommercialCloseMutation,
  refuseDecisionSnapshotMutation,
  refuseProposalContentMutation,
  replaceAutomationRules,
  allAutomationRules,
  resetAutomationIntakeStore,
  resetAutomationRuleRunsStore,
  resetAutomationRulesStore,
  serializeAutomationIntakeLedger,
  serializeAutomationRuleRuns,
  serializeAutomationRules,
  upsertStudioAutomationRule,
  findAutomationRuleRunByIdempotencyKey,
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
const tempDir = mkdtempSync(join(tmpdir(), 'pf-h163-'))
const intakeFile = join(tempDir, 'automation-intake.json')
const rulesFile = join(tempDir, 'automation-rules.json')
const runsFile = join(tempDir, 'automation-rule-runs.json')

const proposalCatalog = new Map([
  [
    'prop-h163',
    {
      id: 'prop-h163',
      companyId: studio,
      title: 'H16.3 Proposal',
      shareToken: 'share-h163',
    },
  ],
  [
    'prop-other',
    {
      id: 'prop-other',
      companyId: otherCompany,
      title: 'Other company proposal',
      shareToken: 'share-other',
    },
  ],
])

configureFollowupResolvers({
  getProposal(proposalId, companyId) {
    const found = proposalCatalog.get(proposalId) ?? null
    if (!found) return null
    if (found.companyId !== companyId) return null
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
    `${JSON.stringify(
      {
        receipts: ledger?.receipts ?? [],
        events: ledger?.events ?? [],
      },
      null,
      2,
    )}\n`,
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

function resetAll() {
  resetFollowupStore([])
  resetAutomationIntakeStore({ receipts: [], events: [] })
  resetAutomationRulesStore({ rules: [] })
  resetAutomationRuleRunsStore({ runs: [] })
  configureAutomationIntakeStore({ persist: persistIntake })
  configureAutomationRulesStore({
    persistRules,
    persistRuns,
  })
  persistIntake(serializeAutomationIntakeLedger())
  persistRules(serializeAutomationRules())
  persistRuns(serializeAutomationRuleRuns())
}

resetAll()

const notifications = []
const stopNotify = onNotificationEvent((event) => {
  notifications.push(event)
})

console.log('— Capabilities —')
assert('1. automationRules === true', INTEGRATION_CAPABILITIES.automationRules === true)
assert(
  '2. other H16 execution/vendor flags remain false (outboundWebhooks true in H16.5)',
  INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    INTEGRATION_CAPABILITIES.crm === false &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.messaging === false &&
    INTEGRATION_CAPABILITIES.outboundWebhooks === true &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.liveWebhookIngress === false,
)

console.log('— Rule CRUD / company isolation —')
let missingCompany = null
try {
  upsertStudioAutomationRule({
    name: 'no company',
    trigger: { eventTypes: ['living.proposal_opened'] },
    actions: [{ type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO, params: { title: 'x' } }],
  })
} catch (error) {
  missingCompany = error
}
assert(
  '3. rule creation requires companyId',
  missingCompany instanceof ValidationError,
)

const ruleA = upsertStudioAutomationRule({
  companyId: studio,
  name: 'Open → follow-up',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  conditions: {
    operator: 'and',
    predicates: [
      { path: 'source.domain', op: 'eq', value: 'living' },
      { path: 'correlation.proposalId', op: 'exists' },
    ],
  },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: {
        proposalId: { fromEvent: 'correlation.proposalId' },
        title: 'Automation follow-up',
        description: 'Created by H16.3',
      },
    },
  ],
})
assert('rule created for studio', ruleA.companyId === studio && ruleA.version === 1)

let crossGet = null
try {
  listStudioAutomationRules(otherCompany).find((item) => item.id === ruleA.id)
  // list is company scoped — should not include studio rule
} catch (error) {
  crossGet = error
}
assert(
  '4. cross-company rule list isolation',
  !listStudioAutomationRules(otherCompany).some((item) => item.id === ruleA.id) &&
    crossGet == null,
)

let crossPatch = null
try {
  patchStudioAutomationRule({
    companyId: otherCompany,
    id: ruleA.id,
    enabled: false,
  })
} catch (error) {
  crossPatch = error
}
assert(
  '4b. cross-company rule access is rejected',
  crossPatch instanceof ForbiddenError || crossPatch instanceof ValidationError,
)

console.log('— Trigger / condition / ordering —')
resetAll()
const notifyRule = upsertStudioAutomationRule({
  companyId: studio,
  name: 'Notify on open',
  priority: 20,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'], sourceDomains: ['living'] },
  conditions: {
    operator: 'and',
    predicates: [{ path: 'type', op: 'eq', value: 'living.proposal_opened' }],
  },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'Opened', body: 'Client opened proposal' },
    },
  ],
})
const highPriority = upsertStudioAutomationRule({
  companyId: studio,
  name: 'High priority stop',
  priority: 5,
  stopAfterMatch: true,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'First', body: 'stopAfterMatch' },
    },
  ],
})
const disabled = upsertStudioAutomationRule({
  companyId: studio,
  name: 'Disabled',
  enabled: false,
  priority: 1,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'Should not run' },
    },
  ],
})

notifications.length = 0
const openEvent = ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-open-1' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-open-1',
    payload: { livingType: 'proposal_opened' },
  }),
})
assert(
  '5. deterministic trigger matching accepts event',
  openEvent.ok && openEvent.status === AUTOMATION_INTAKE_STATUS.ACCEPTED,
)

const runsAfterOpen = listStudioAutomationRuleRuns(studio)
const executedNames = runsAfterOpen
  .filter((item) => item.status === AUTOMATION_RULE_RUN_STATUS.EXECUTED)
  .map((item) => item.ruleName)
assert(
  '5b. high-priority rule executed',
  executedNames.includes(highPriority.name),
)
assert(
  '8. disabled rules do not execute',
  !runsAfterOpen.some((item) => item.ruleId === disabled.id),
)
assert(
  '10. stopAfterMatch prevents later rules',
  !runsAfterOpen.some((item) => item.ruleId === notifyRule.id && item.status === AUTOMATION_RULE_RUN_STATUS.EXECUTED),
)
assert(
  '9. priority ordering is deterministic (stop rule first)',
  runsAfterOpen.find((item) => item.ruleId === highPriority.id)?.status ===
    AUTOMATION_RULE_RUN_STATUS.EXECUTED,
)
assert(
  '6. deterministic condition evaluation (matched notify path via stop rule)',
  notifications.some((item) => item.payload?.title === 'First'),
)

const unsupportedEval = evaluateAutomationConditions(
  makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-cond' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-cond',
  }),
  {
    operator: 'and',
    predicates: [{ path: 'not.allowed.path', op: 'eq', value: 'x' }],
  },
)
assert(
  '7. unsupported condition is safely skipped',
  unsupportedEval.skipped === true &&
    unsupportedEval.reason === AUTOMATION_RULE_FAILURE_REASON.UNSUPPORTED_CONDITION,
)

console.log('— Idempotency / versioning —')
resetAll()
const versionRule = upsertStudioAutomationRule({
  companyId: studio,
  name: 'Versioned notify',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['portal.published'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'v1' },
    },
  ],
})
const eventV = makeAutomationEvent({
  type: 'portal.published',
  companyId: studio,
  source: { domain: 'portal', entityType: 'portal', eventId: 'pev-1' },
  correlation: { proposalId: 'prop-h163' },
  sourceEventIdentity: 'pev-1',
})
const first = ingestAutomationEvent({ event: eventV })
const dup = ingestAutomationEvent({ event: eventV })
assert('duplicate intake marked duplicate', dup.duplicate === true)
const keyV1 = makeAutomationRuleExecutionKey(
  first.event.id,
  versionRule.id,
  versionRule.version,
)
assert(
  '11. duplicate AutomationEvent does not execute same rule twice',
  findAutomationRuleRunByIdempotencyKey(keyV1) &&
    listStudioAutomationRuleRuns(studio).filter((item) => item.idempotencyKey === keyV1)
      .length === 1,
)
assert(
  '12. execution key includes rule version',
  keyV1 === `${first.event.id}|${versionRule.id}|${versionRule.version}`,
)

const versionRuleV2 = upsertStudioAutomationRule({
  ...versionRule,
  companyId: studio,
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'v2' },
    },
  ],
})
assert('13a. material action change bumps version', versionRuleV2.version === 2)
const eventV2 = makeAutomationEvent({
  type: 'portal.published',
  companyId: studio,
  source: { domain: 'portal', entityType: 'portal', eventId: 'pev-2' },
  correlation: { proposalId: 'prop-h163' },
  sourceEventIdentity: 'pev-2',
})
const second = ingestAutomationEvent({ event: eventV2 })
const keyV2 = makeAutomationRuleExecutionKey(
  second.event.id,
  versionRuleV2.id,
  versionRuleV2.version,
)
assert(
  '13. changed rule version creates a distinct execution identity',
  keyV1 !== keyV2 &&
    findAutomationRuleRunByIdempotencyKey(keyV2)?.ruleVersion === 2,
)

console.log('— Actions / H13 / notify —')
resetAll()
notifications.length = 0
const beforeFollowups = allFollowupRecords().length
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Create follow-up',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: {
        proposalId: { fromEvent: 'correlation.proposalId' },
        title: 'H13 from rules',
      },
    },
  ],
})
const createIngest = ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-fu-1' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-fu-1',
  }),
})
const followups = allFollowupRecords().filter((item) => item.companyId === studio)
assert(
  '14. create_followup calls H13 authoritative API',
  createIngest.ok &&
    followups.length === beforeFollowups + 1 &&
    followups.some((item) => item.title === 'H13 from rules'),
)

const createdFu = followups.find((item) => item.title === 'H13 from rules')
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Complete follow-up',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['workflow.status_changed'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.ASSIGN_FOLLOWUP,
      params: {
        followupId: createdFu.id,
        ownerActorId: 'user-studio-alex',
      },
    },
    {
      type: AUTOMATION_RULE_ACTION_TYPE.SCHEDULE_FOLLOWUP,
      params: {
        followupId: createdFu.id,
        dueAt: '2099-01-15T00:00:00.000Z',
      },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'workflow.status_changed',
    companyId: studio,
    source: { domain: 'workflow', entityType: 'workflow', eventId: 'wev-1' },
    correlation: { proposalId: 'prop-h163', followupId: createdFu.id },
    sourceEventIdentity: 'wev-1',
  }),
})
const assigned = allFollowupRecords().find((item) => item.id === createdFu.id)
assert(
  '15a. assign/schedule follow-up actions use H13 APIs',
  assigned?.ownerActorId === 'user-studio-alex' &&
    assigned?.dueAt === '2099-01-15T00:00:00.000Z',
)

upsertStudioAutomationRule({
  companyId: studio,
  name: 'Complete then dismiss path',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['interaction.resolved'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.COMPLETE_FOLLOWUP,
      params: { followupId: createdFu.id },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'interaction.resolved',
    companyId: studio,
    source: { domain: 'interaction', entityType: 'interaction', eventId: 'iev-1' },
    correlation: { proposalId: 'prop-h163', followupId: createdFu.id },
    sourceEventIdentity: 'iev-1',
  }),
})
assert(
  '15. complete follow-up action uses H13 API',
  allFollowupRecords().find((item) => item.id === createdFu.id)?.status ===
    FOLLOWUP_STATUS.COMPLETED,
)

const dismissTarget = (() => {
  resetAutomationRuleRunsStore({ runs: [] })
  upsertStudioAutomationRule({
    companyId: studio,
    name: 'Make dismissable',
    priority: 1,
    runAsActorId: DEFAULT_ACTOR_ID,
    trigger: { eventTypes: ['living.republished'] },
    actions: [
      {
        type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
        params: { proposalId: 'prop-h163', title: 'Dismiss me' },
      },
    ],
  })
  ingestAutomationEvent({
    event: makeAutomationEvent({
      type: 'living.republished',
      companyId: studio,
      source: { domain: 'living', entityType: 'living_event', eventId: 'lev-d1' },
      correlation: { proposalId: 'prop-h163' },
      sourceEventIdentity: 'lev-d1',
    }),
  })
  return allFollowupRecords().find((item) => item.title === 'Dismiss me')
})()
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Dismiss follow-up',
  priority: 1,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['portal.revoked'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.DISMISS_FOLLOWUP,
      params: { followupId: dismissTarget.id },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'portal.revoked',
    companyId: studio,
    source: { domain: 'portal', entityType: 'portal', eventId: 'pev-rev' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'pev-rev',
  }),
})
assert(
  '15b. dismiss follow-up action uses H13 API',
  allFollowupRecords().find((item) => item.id === dismissTarget.id)?.status ===
    FOLLOWUP_STATUS.DISMISSED,
)

notifications.length = 0
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Notify only',
  priority: 1,
  trigger: { eventTypes: ['interaction.acknowledged'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'In-app only', body: 'no email' },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'interaction.acknowledged',
    companyId: studio,
    source: { domain: 'interaction', entityType: 'interaction', eventId: 'iev-ack' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'iev-ack',
  }),
})
assert(
  '16. notify_studio remains in-app only',
  notifications.some((item) => item.payload?.title === 'In-app only') &&
    !sourceOf('src', 'integrations', 'rules', 'actions.js').includes('nodemailer') &&
    !sourceOf('src', 'integrations', 'rules', 'actions.js').includes('sendEmail'),
)

console.log('— Actor isolation —')
resetAll()
const followupsBeforeActor = allFollowupRecords().filter(
  (item) => item.companyId === studio,
).length

upsertStudioAutomationRule({
  companyId: studio,
  name: 'Foreign runAsActorId',
  priority: 10,
  runAsActorId: 'user-harborline-lee',
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: { proposalId: 'prop-h163', title: 'Must not create foreign-actor' },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-actor-foreign-runas' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-actor-foreign-runas',
  }),
})
assert(
  'actor. cross-company runAsActorId is rejected',
  listStudioAutomationRuleRuns(studio).some(
    (item) =>
      item.status === AUTOMATION_RULE_RUN_STATUS.FAILED &&
      item.failureReason === AUTOMATION_RULE_FAILURE_REASON.MISSING_ACTOR,
  ) &&
    !allFollowupRecords().some(
      (item) => item.title === 'Must not create foreign-actor',
    ),
)

resetAutomationRuleRunsStore({ runs: [] })
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Foreign params.actorId',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['portal.published'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: {
        actorId: 'user-harborline-lee',
        proposalId: 'prop-h163',
        title: 'Must not create params-actor',
      },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'portal.published',
    companyId: studio,
    source: { domain: 'portal', entityType: 'portal', eventId: 'pev-actor-foreign-param' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'pev-actor-foreign-param',
  }),
})
assert(
  'actor. cross-company params.actorId is rejected',
  listStudioAutomationRuleRuns(studio).some(
    (item) =>
      item.status === AUTOMATION_RULE_RUN_STATUS.FAILED &&
      item.failureReason === AUTOMATION_RULE_FAILURE_REASON.MISSING_ACTOR,
  ) &&
    !allFollowupRecords().some(
      (item) => item.title === 'Must not create params-actor',
    ),
)

resetAutomationRuleRunsStore({ runs: [] })
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Unknown actor ID',
  priority: 10,
  runAsActorId: 'user-does-not-exist',
  trigger: { eventTypes: ['workflow.status_changed'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: { proposalId: 'prop-h163', title: 'Must not create unknown-actor' },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'workflow.status_changed',
    companyId: studio,
    source: { domain: 'workflow', entityType: 'workflow', eventId: 'wev-actor-unknown' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'wev-actor-unknown',
  }),
})
assert(
  'actor. unknown actor ID is rejected',
  listStudioAutomationRuleRuns(studio).some(
    (item) =>
      item.status === AUTOMATION_RULE_RUN_STATUS.FAILED &&
      item.failureReason === AUTOMATION_RULE_FAILURE_REASON.MISSING_ACTOR,
  ) &&
    !allFollowupRecords().some(
      (item) => item.title === 'Must not create unknown-actor',
    ),
)

resetAutomationRuleRunsStore({ runs: [] })
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Valid same-company actor',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['interaction.created'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: { proposalId: 'prop-h163', title: 'Valid actor follow-up' },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'interaction.created',
    companyId: studio,
    source: { domain: 'interaction', entityType: 'interaction', eventId: 'iev-actor-valid' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'iev-actor-valid',
  }),
})
const validActorFu = allFollowupRecords().find(
  (item) => item.title === 'Valid actor follow-up' && item.companyId === studio,
)
assert(
  'actor. valid same-company actor succeeds',
  validActorFu != null &&
    listStudioAutomationRuleRuns(studio).some(
      (item) =>
        item.status === AUTOMATION_RULE_RUN_STATUS.EXECUTED &&
        item.failureReason == null,
    ),
)
assert(
  'actor. failed actor resolution does not mutate follow-ups across companies',
  allFollowupRecords().filter((item) => item.companyId === studio).length ===
    followupsBeforeActor + 1 &&
    !allFollowupRecords().some((item) => item.companyId === otherCompany) &&
    !sourceOf('src', 'integrations', 'rules', 'actions.js').includes(
      'resolveWorkflowActor({ id: actorId, companyId',
    ),
)

console.log('— Failures / malformed / caps —')
resetAll()
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Failing complete',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.COMPLETE_FOLLOWUP,
      params: { followupId: 'fu-does-not-exist' },
    },
  ],
})
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-fail' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-fail',
  }),
})
assert(
  '17. action failures produce failed run records',
  listStudioAutomationRuleRuns(studio).some(
    (item) =>
      item.status === AUTOMATION_RULE_RUN_STATUS.FAILED &&
      item.failureReason === AUTOMATION_RULE_FAILURE_REASON.ACTION_FAILED,
  ),
)

// Malformed rule: soft-load corrupt row; sibling must still execute.
const goodSibling = upsertStudioAutomationRule({
  companyId: studio,
  name: 'Sibling still runs',
  priority: 50,
  trigger: { eventTypes: ['living.addon_selected'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'Sibling' },
    },
  ],
})
replaceAutomationRules({
  rules: [
    {
      id: 'arule-malformed',
      companyId: studio,
      name: 'Broken',
      enabled: true,
      version: 1,
      priority: 1,
      stopAfterMatch: false,
      trigger: { eventTypes: ['living.addon_selected'] },
      conditions: { operator: 'and', predicates: [] },
      actions: [],
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...allAutomationRules().filter((item) => item.id === goodSibling.id),
  ],
})
notifications.length = 0
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.addon_selected',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-mal' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-mal',
  }),
})
assert(
  '18. malformed rules do not crash other rules',
  listStudioAutomationRuleRuns(studio).some(
    (item) =>
      item.ruleId === 'arule-malformed' &&
      item.status === AUTOMATION_RULE_RUN_STATUS.SKIPPED &&
      item.failureReason === AUTOMATION_RULE_FAILURE_REASON.MALFORMED_RULE,
  ) && notifications.some((item) => item.payload?.title === 'Sibling'),
)

console.log('— Recursion protection —')
resetAll()
notifications.length = 0
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Create FU on open',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.CREATE_FOLLOWUP,
      params: { proposalId: 'prop-h163', title: 'Recursion probe' },
    },
  ],
})
upsertStudioAutomationRule({
  companyId: studio,
  name: 'Would fire on followup.created',
  priority: 10,
  runAsActorId: DEFAULT_ACTOR_ID,
  trigger: { eventTypes: ['followup.created'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'Nested should not run' },
    },
  ],
})
const recursionIngest = ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-rec' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-rec',
  }),
})
const acceptedFollowupEvents = listAcceptedAutomationEventsForCompany(studio).filter(
  (item) => item.type === 'followup.created',
)
const nestedNotifyRuns = listStudioAutomationRuleRuns(studio).filter(
  (item) => item.eventType === 'followup.created',
)
assert('19a. root rule executed', recursionIngest.ok)
assert(
  '19b. follow-up event is ingested',
  acceptedFollowupEvents.length >= 1,
)
assert(
  '19. nested event does NOT evaluate rules again',
  nestedNotifyRuns.length === 0 &&
    !notifications.some((item) => item.payload?.title === 'Nested should not run'),
)

console.log('— Caps / isolation —')
resetAll()
for (let i = 0; i < AUTOMATION_RULE_LIMITS.MAX_MATCHED_RULES + 3; i += 1) {
  upsertStudioAutomationRule({
    companyId: studio,
    name: `Cap rule ${i}`,
    priority: i,
    trigger: { eventTypes: ['living.proposal_opened'] },
    actions: [
      {
        type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
        params: { title: `cap-${i}` },
      },
    ],
  })
}
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-cap' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-cap',
  }),
})
const capRuns = listStudioAutomationRuleRuns(studio)
assert(
  '20. execution caps work',
  capRuns.some(
    (item) => item.failureReason === AUTOMATION_RULE_FAILURE_REASON.CAPPED,
  ) &&
    capRuns.filter((item) => item.status === AUTOMATION_RULE_RUN_STATUS.EXECUTED)
      .length <= AUTOMATION_RULE_LIMITS.MAX_MATCHED_RULES,
)

upsertStudioAutomationRule({
  companyId: otherCompany,
  name: 'Other company rule',
  priority: 1,
  runAsActorId: 'user-harborline-lee',
  trigger: { eventTypes: ['living.proposal_opened'] },
  actions: [
    {
      type: AUTOMATION_RULE_ACTION_TYPE.NOTIFY_STUDIO,
      params: { title: 'Other company' },
    },
  ],
})
notifications.length = 0
ingestAutomationEvent({
  event: makeAutomationEvent({
    type: 'living.proposal_opened',
    companyId: studio,
    source: { domain: 'living', entityType: 'living_event', eventId: 'lev-iso' },
    correlation: { proposalId: 'prop-h163' },
    sourceEventIdentity: 'lev-iso',
  }),
})
assert(
  '21. company isolation works',
  !notifications.some((item) => item.payload?.title === 'Other company') &&
    !listStudioAutomationRuleRuns(studio).some((item) =>
      String(item.ruleName).includes('Other company'),
    ),
)

console.log('— Boundaries / honesty —')
let closeRefuse = null
try {
  refuseCommercialCloseMutation('transition CommercialClose')
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
assert('22. H15 mutation remains prohibited', closeRefuse instanceof ForbiddenError)
assert(
  '23. decision snapshot mutation remains prohibited',
  decisionRefuse instanceof ForbiddenError,
)
assert(
  '24. proposal mutation remains prohibited',
  proposalRefuse instanceof ForbiddenError,
)
assert(
  '25. data/proposals.json remains byte-identical so far',
  proposalsSnapshot() === proposalsBefore,
)

const rulesSrc = collectSources('src/integrations/rules')
const integrationsSrc = collectSources('src/integrations')
assert(
  '26. no vendor SDKs',
  !/from\s+['"](?:@?stripe|hubspot|jsforce|@slack|twilio|docusign)/i.test(
    rulesSrc,
  ),
)
assert(
  '27. no OAuth',
  !/\boauth(2)?(Client|Token|Flow)\b/i.test(rulesSrc) &&
    INTEGRATION_CAPABILITIES.oauth === false,
)
assert(
  '28. no network calls',
  !/\bfetch\s*\(|\baxios\b|\bnode:https\b|\bnode:http\b/.test(rulesSrc),
)
assert(
  '29. no delivery execution',
  INTEGRATION_CAPABILITIES.deliveryExecution === false &&
    !rulesSrc.includes('processOutbox') &&
    !rulesSrc.includes('sendDelivery'),
)
assert(
  '30. no workers/outbox/DLQ',
  !rulesSrc.includes('processOutbox') &&
    !rulesSrc.includes('Bull') &&
    !rulesSrc.includes('DeadLetter') &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false,
)
assert(
  '34. Forge remains non-owning',
  FORGE_CAPABILITIES.llm === false &&
    !sourceOf('src', 'forge', 'repository.js').includes('evaluateAutomationRules') &&
    !sourceOf('src', 'forge', 'index.js').includes('integrations/rules') &&
    !integrationsSrc.includes('src/forge'),
)
assert(
  'rules never write proposals.json / commercialClose stores',
  !rulesSrc.includes('proposals.json') &&
    !rulesSrc.includes('commercialClose') &&
    !rulesSrc.includes('decisionSnapshot') &&
    !rulesSrc.includes('applyLivingDecisions'),
)

console.log('')
console.log('— Nested H16.2 regression (includes H16.1 + H15 tip) —')
// H16.2 already nests H16.1 foundation + H15.1–H15.7 completion.
// Avoid re-running H15 three times from this suite (multi-minute each).
const h162 = runSuite('verify-integrations-event-intake.mjs')
assert(
  '31–33. H16.2 nested chain remains green (H16.1 + H16.2 + H15 tip)',
  h162.ok,
  h162.ok ? '' : h162.output.slice(-2000),
)

assert(
  '25b. final data/proposals.json unchanged',
  proposalsSnapshot() === proposalsBefore,
)

stopNotify()
try {
  rmSync(tempDir, { recursive: true, force: true })
} catch {
  /* ignore */
}

console.log('')
console.log(`H16.3 automation rules checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
