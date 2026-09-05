import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeProposal } from '../src/models/proposal.js'
import { PROPOSAL_STATUS } from '../src/models/proposal.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { getWorkflowActor } from '../src/workflow/actors.js'
import {
  makeWorkflowRecord,
  makeWorkflowTask,
  resetWorkflowStore,
  WORKFLOW_CAPABILITIES,
  WORKFLOW_STATUS,
} from '../src/workflow/index.js'
import { TASK_STATUS } from '../src/workflow/types.js'
import {
  INTERACTION_STATUS,
  INTERACTION_TYPE,
  makeInteractionRecord,
  resetInteractionStore,
} from '../src/interactions/index.js'
import { resetPortalStore } from '../src/portal/index.js'
import {
  allFollowupRecords,
  assignFollowupOwner,
  clientFollowupApiDenied,
  completeFollowup,
  configureFollowupResolvers,
  containsSecret,
  createManualFollowup,
  DEFAULT_COMPANY_ID,
  dismissFollowup,
  evaluateFollowupSignals,
  findFollowupRecord,
  FOLLOWUP_CAPABILITIES,
  FOLLOWUP_ISOLATION_COMPANY_ID,
  FOLLOWUP_POLICY,
  FOLLOWUP_REASON,
  FOLLOWUP_STATUS,
  getProposalFollowupView,
  listFollowupSignals,
  listStudioFollowups,
  resetFollowupResolvers,
  resetFollowupStore,
  scheduleFollowup,
  startFollowup,
  syncFollowupsForProposal,
} from '../src/followup/index.js'

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

function throws(fn, Type) {
  try {
    fn()
    return false
  } catch (error) {
    return Type ? error instanceof Type : true
  }
}

function caught(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  }
}

const studio = DEFAULT_COMPANY_ID
const other = FOLLOWUP_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor('user-studio-sarah')
const sam = getWorkflowActor('user-studio-sam')
const lee = getWorkflowActor('user-harborline-lee')
const now = Date.parse('2026-09-05T12:00:00.000Z')

const proposals = new Map()

function seedProposal(id, input = {}, companyId = studio) {
  const proposal = makeProposal({
    id,
    title: input.title ?? `Proposal ${id}`,
    clientName: input.clientName ?? 'Jordan Lee',
    company: input.company ?? 'Harborline',
    status: input.status ?? PROPOSAL_STATUS.SENT,
    amount: input.amount ?? 24000,
    currency: 'USD',
    validUntil: input.validUntil ?? null,
    lastViewedAt: input.lastViewedAt ?? null,
    acceptedAt: input.acceptedAt ?? null,
    lastEmail: input.lastEmail ?? {
      sentAt: new Date(now - FOLLOWUP_POLICY.neverOpenedAfterMs - 60_000).toISOString(),
    },
    createdAt: input.createdAt ?? new Date(now - FOLLOWUP_POLICY.neverOpenedAfterMs - 60_000).toISOString(),
    updatedAt: input.updatedAt ?? new Date(now - FOLLOWUP_POLICY.neverOpenedAfterMs - 60_000).toISOString(),
    ...input,
  })
  proposal.companyId = companyId
  proposals.set(id, proposal)
  return proposal
}

configureFollowupResolvers({
  getProposal(proposalId, companyId) {
    const found = proposals.get(proposalId)
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
  listProposals(companyId) {
    return [...proposals.values()].filter((item) => {
      const ownedBy = String(item.companyId ?? studio).trim() || studio
      return ownedBy === companyId
    })
  },
})

resetFollowupStore()
resetWorkflowStore()
resetPortalStore()
resetInteractionStore()

seedProposal('prop-fu-never')
const neverSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-never'),
  now,
})
const neverAgain = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-never'),
  now,
})
assert(
  'Test 2 — Deterministic signal resolution',
  JSON.stringify(neverSignals) === JSON.stringify(neverAgain) && neverSignals.length > 0,
)
assert(
  'Test 3 — NEVER_OPENED',
  neverSignals.some((item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED),
)

seedProposal('prop-fu-await', {
  lastViewedAt: new Date(now - FOLLOWUP_POLICY.awaitingResponseAfterMs - 60_000).toISOString(),
})
const awaitSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-await'),
  now,
})
assert(
  'Test 4 — AWAITING_RESPONSE',
  awaitSignals.some((item) => item.reason === FOLLOWUP_REASON.AWAITING_RESPONSE) &&
    !awaitSignals.some((item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED),
)

seedProposal('prop-fu-ix')
resetInteractionStore([
  makeInteractionRecord({
    companyId: studio,
    portalId: 'portal-fu-1',
    proposalId: 'prop-fu-ix',
    type: INTERACTION_TYPE.QUESTION,
    status: INTERACTION_STATUS.OPEN,
    message: 'Can we start in October?',
    createdAt: new Date(now - 3_600_000).toISOString(),
  }),
])
const ixSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-ix'),
  interactions: [
    makeInteractionRecord({
      companyId: studio,
      portalId: 'portal-fu-1',
      proposalId: 'prop-fu-ix',
      type: INTERACTION_TYPE.QUESTION,
      status: INTERACTION_STATUS.OPEN,
      message: 'Can we start in October?',
    }),
  ],
  now,
})
assert(
  'Test 5 — CLIENT_INTERACTION',
  ixSignals.some((item) => item.reason === FOLLOWUP_REASON.CLIENT_INTERACTION),
)

seedProposal('prop-fu-changes')
const changeSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-changes'),
  workflow: makeWorkflowRecord({
    companyId: studio,
    proposalId: 'prop-fu-changes',
    status: WORKFLOW_STATUS.CHANGES_REQUESTED,
    ownerId: sarah.id,
  }),
  now,
})
assert(
  'Test 6 — CHANGES_REQUESTED',
  changeSignals.some((item) => item.reason === FOLLOWUP_REASON.CHANGES_REQUESTED),
)

seedProposal('prop-fu-expiring', {
  validUntil: '2026-09-08',
})
const expiringSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-expiring'),
  now,
})
assert(
  'Test 7 — EXPIRING',
  expiringSignals.some((item) => item.reason === FOLLOWUP_REASON.EXPIRING),
)

seedProposal('prop-fu-accepted', {
  status: PROPOSAL_STATUS.ACCEPTED,
  acceptedAt: new Date(now - 3_600_000).toISOString(),
})
const acceptedSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-accepted'),
  now,
})
assert(
  'Test 8 — ACCEPTED_NEXT_STEP',
  acceptedSignals.some((item) => item.reason === FOLLOWUP_REASON.ACCEPTED_NEXT_STEP) &&
    !acceptedSignals.some((item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED),
)

seedProposal('prop-fu-task')
const overdueSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-task'),
  workflow: makeWorkflowRecord({
    companyId: studio,
    proposalId: 'prop-fu-task',
    status: WORKFLOW_STATUS.SENT,
    ownerId: sarah.id,
    tasks: [
      makeWorkflowTask({
        proposalId: 'prop-fu-task',
        title: 'Send kickoff pack',
        status: TASK_STATUS.OPEN,
        dueAt: new Date(now - 86_400_000).toISOString(),
      }),
    ],
  }),
  now,
})
assert(
  'Test 9 — OVERDUE_TASK',
  overdueSignals.some((item) => item.reason === FOLLOWUP_REASON.OVERDUE_TASK),
)

resetFollowupStore()
syncFollowupsForProposal({
  companyId: studio,
  proposalId: 'prop-fu-never',
  actor: sarah,
  now,
})
syncFollowupsForProposal({
  companyId: studio,
  proposalId: 'prop-fu-never',
  actor: sarah,
  now,
})
const openNever = listStudioFollowups({
  companyId: studio,
  proposalId: 'prop-fu-never',
  actor: sarah,
  now,
  sync: false,
}).filter(
  (item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED && item.status === FOLLOWUP_STATUS.OPEN,
)
assert('Test 10 — Duplicate open follow-up prevention', openNever.length === 1)

const completed = completeFollowup({
  companyId: studio,
  followupId: openNever[0].id,
  actor: sarah,
  now,
})
syncFollowupsForProposal({
  companyId: studio,
  proposalId: 'prop-fu-never',
  actor: sarah,
  now,
})
const afterComplete = listStudioFollowups({
  companyId: studio,
  proposalId: 'prop-fu-never',
  actor: sarah,
  now,
  sync: false,
})
assert(
  'Test 11 — Completed follow-up remains historical',
  completed.status === FOLLOWUP_STATUS.COMPLETED &&
    afterComplete.some((item) => item.id === completed.id && item.status === FOLLOWUP_STATUS.COMPLETED) &&
    afterComplete.filter(
      (item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED && item.status === FOLLOWUP_STATUS.OPEN,
    ).length === 0,
)

seedProposal('prop-fu-dismiss')
const dismissSync = syncFollowupsForProposal({
  companyId: studio,
  proposalId: 'prop-fu-dismiss',
  actor: sarah,
  now,
})
const dismissTarget = dismissSync.find((item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED)
const dismissed = dismissFollowup({
  companyId: studio,
  followupId: dismissTarget.id,
  actor: sarah,
  now,
})
syncFollowupsForProposal({
  companyId: studio,
  proposalId: 'prop-fu-dismiss',
  actor: sarah,
  now,
})
const afterDismiss = findFollowupRecord(dismissed.id)
assert(
  'Test 12 — Dismissed follow-up remains historical',
  afterDismiss?.status === FOLLOWUP_STATUS.DISMISSED && Boolean(afterDismiss.dismissedAt),
)

const manual = createManualFollowup({
  companyId: studio,
  proposalId: 'prop-fu-await',
  actor: sarah,
  title: 'Call Jordan on Monday',
  dueAt: '2026-09-07T17:00:00.000Z',
  now,
})
assert(
  'Test 13 — Manual follow-up creation',
  manual.reason === FOLLOWUP_REASON.MANUAL &&
    manual.proposalId === 'prop-fu-await' &&
    manual.companyId === studio &&
    manual.title === 'Call Jordan on Monday',
)

const started = startFollowup({
  companyId: studio,
  followupId: manual.id,
  actor: sarah,
  now,
})
assert(
  'Test 14 — Owner permission',
  started.status === FOLLOWUP_STATUS.IN_PROGRESS && started.ownerActorId === sarah.id,
)

const viewerCreate = caught(() =>
  createManualFollowup({
    companyId: studio,
    proposalId: 'prop-fu-await',
    actor: sam,
    title: 'Viewer should not create',
    now,
  }),
)
const viewerStart = caught(() =>
  startFollowup({
    companyId: studio,
    followupId: manual.id,
    actor: sam,
    now,
  }),
)
assert(
  'Test 15 — Viewer mutation rejection',
  viewerCreate instanceof ForbiddenError && viewerStart instanceof ForbiddenError,
)

seedProposal('prop-fu-other', {}, other)
const crossList = caught(() =>
  listStudioFollowups({
    companyId: other,
    actor: sarah,
    now,
    sync: false,
  }),
)
const crossCreate = caught(() =>
  createManualFollowup({
    companyId: other,
    proposalId: 'prop-fu-other',
    actor: sarah,
    title: 'Injected company',
    now,
  }),
)
const isolationCreate = createManualFollowup({
  companyId: other,
  proposalId: 'prop-fu-other',
  actor: lee,
  title: 'Harborline follow-up',
  now,
})
const studioSeesOther = listStudioFollowups({
  companyId: studio,
  actor: sarah,
  now,
  sync: false,
}).some((item) => item.id === isolationCreate.id)
assert(
  'Test 1 — Company isolation',
  isolationCreate.companyId === other && !studioSeesOther,
)
assert(
  'Test 16 — Cross-company rejection',
  crossList instanceof ForbiddenError && crossCreate instanceof ForbiddenError,
)

const specific = getProposalFollowupView({
  companyId: studio,
  proposalId: 'prop-fu-await',
  actor: sarah,
  now,
})
assert(
  'Test 17 — Proposal-specific retrieval',
  specific.followups.every((item) => item.proposalId === 'prop-fu-await') &&
    specific.nextAction?.proposalId === 'prop-fu-await',
)

const scheduled = scheduleFollowup({
  companyId: studio,
  followupId: manual.id,
  actor: sarah,
  dueAt: '2026-09-10T15:00:00.000Z',
  now,
})
assert(
  'Test 18 — Due date handling',
  scheduled.dueAt === '2026-09-10T15:00:00.000Z',
)

const pluginSource = sourceOf('server', 'followupPlugin.js')
const repoSource = sourceOf('src', 'followup', 'repository.js')
const domainSource = sourceOf('src', 'followup', 'index.js')
const resolverSource = sourceOf('src', 'followup', 'resolver.js')
assert(
  'Test 19 — No proposal writes',
  pluginSource.includes('Never writes `data/proposals.json`') &&
    pluginSource.includes("join(dataDir, 'followups.json')") &&
    !repoSource.includes('writeFileSync') &&
    !repoSource.includes('proposalStore') &&
    !pluginSource.includes('writeJson(proposalsFile'),
)

const portalPage = sourceOf('src', 'pages', 'ProposalPortal', 'ProposalPortal.jsx')
const portalInteractions = sourceOf('src', 'pages', 'ProposalPortal', 'PortalInteractions.jsx')
assert(
  'Test 20 — No portal leakage',
  !portalPage.toLowerCase().includes('followup') &&
    !portalInteractions.toLowerCase().includes('followup') &&
    pluginSource.includes('clientFollowupApiDenied'),
)
assert(
  'Test 20b — Public follow-up API denied',
  throws(() => clientFollowupApiDenied(), ForbiddenError) &&
    pluginSource.includes("url.startsWith('/api/followups/public')"),
)

assert(
  'Test 21 — No email send',
  FOLLOWUP_CAPABILITIES.emailDelivery === false &&
    WORKFLOW_CAPABILITIES.emailDelivery === false &&
    !pluginSource.includes('nodemailer') &&
    !repoSource.includes('sendMail') &&
    !domainSource.includes('sendProposalEmail'),
)

assert(
  'Test 22 — No WhatsApp',
  FOLLOWUP_CAPABILITIES.whatsapp === false &&
    WORKFLOW_CAPABILITIES.whatsapp === false &&
    !pluginSource.toLowerCase().includes('whatsapp'),
)

assert(
  'Test 23 — No CRM',
  FOLLOWUP_CAPABILITIES.crm === false &&
    WORKFLOW_CAPABILITIES.crm === false &&
    !pluginSource.toLowerCase().includes('hubspot') &&
    !resolverSource.toLowerCase().includes('salesforce'),
)

assert(
  'Test 24 — No LLM',
  FOLLOWUP_CAPABILITIES.llm === false &&
    !resolverSource.includes('openai') &&
    !repoSource.includes('generateText') &&
    !domainSource.includes('../generate'),
)

assert(
  'Test 25 — Capability flags',
  FOLLOWUP_CAPABILITIES.automatedReminders === true &&
    WORKFLOW_CAPABILITIES.automatedReminders === true &&
    FOLLOWUP_CAPABILITIES.backgroundWorkers === false &&
    FOLLOWUP_CAPABILITIES.thirdPartyIntegrations === false,
)

const snapshot = allFollowupRecords()
resetFollowupStore(snapshot)
assert(
  'Test 26 — Persistence across store reset',
  Boolean(findFollowupRecord(manual.id)) &&
    findFollowupRecord(manual.id).title === 'Call Jordan on Monday',
)

const badId = caught(() =>
  createManualFollowup({
    companyId: studio,
    proposalId: '***',
    actor: sarah,
    now,
  }),
)
const badSchedule = caught(() =>
  scheduleFollowup({
    companyId: studio,
    followupId: manual.id,
    actor: sarah,
    dueAt: 'not-a-date',
    now,
  }),
)
const missing = caught(() =>
  listFollowupSignals({
    companyId: studio,
    proposalId: 'prop-does-not-exist',
    actor: sarah,
    now,
  }),
)
assert(
  'Test 27 — Malformed input rejection',
  badId instanceof ValidationError &&
    badSchedule instanceof ValidationError &&
    missing instanceof NotFoundError,
)

seedProposal('prop-fu-expired', {
  status: PROPOSAL_STATUS.EXPIRED,
  validUntil: '2026-08-01',
  lastEmail: { sentAt: '2026-07-01T12:00:00.000Z' },
})
const expiredSignals = evaluateFollowupSignals({
  proposal: proposals.get('prop-fu-expired'),
  now,
})
assert(
  'Test 28 — Expired proposal behavior',
  !expiredSignals.some((item) => item.reason === FOLLOWUP_REASON.EXPIRING) &&
    !expiredSignals.some((item) => item.reason === FOLLOWUP_REASON.NEVER_OPENED) &&
    !expiredSignals.some((item) => item.reason === FOLLOWUP_REASON.AWAITING_RESPONSE),
)

assert(
  'Test 29 — Accepted proposal behavior',
  acceptedSignals.some((item) => item.reason === FOLLOWUP_REASON.ACCEPTED_NEXT_STEP) &&
    !acceptedSignals.some((item) => item.reason === FOLLOWUP_REASON.EXPIRING),
)

const assigned = assignFollowupOwner({
  companyId: studio,
  followupId: manual.id,
  actor: sarah,
  ownerActorId: 'user-studio-alex',
  now,
})
assert('Test 14b — Assign owner', assigned.ownerActorId === 'user-studio-alex')

const secretError = caught(() =>
  createManualFollowup({
    companyId: studio,
    proposalId: 'prop-fu-await',
    actor: sarah,
    title: 'Use sk-abcdefghijklmnopqrstuvwxyz123456',
    now,
  }),
)
assert(
  'Test 19b — No secrets in follow-up records',
  secretError instanceof ValidationError && !containsSecret(JSON.stringify(allFollowupRecords())),
)

const panelCss = sourceOf('src', 'components', 'Followup', 'FollowupPanel.module.css')
const pageCss = sourceOf('src', 'pages', 'Followups', 'Followups.module.css')
assert(
  'Test 20c — Mobile overflow guards',
  panelCss.includes('overflow-x: hidden') &&
    panelCss.includes('100vw') &&
    panelCss.includes('390px') &&
    pageCss.includes('overflow-x: hidden') &&
    pageCss.includes('390px'),
)

resetFollowupResolvers()

const workflowSuite = runSuite('verify-workflow.mjs')
assert(
  'Test 30a — Existing Workflow verification still passes',
  workflowSuite.ok,
  workflowSuite.ok ? '' : workflowSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const portalSuite = runSuite('verify-portal.mjs')
assert(
  'Test 30b — Existing Portal verification still passes',
  portalSuite.ok,
  portalSuite.ok ? '' : portalSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const knowledgeSuite = runSuite('verify-knowledge.mjs')
assert(
  'Test 30c — Existing Knowledge verification still passes',
  knowledgeSuite.ok,
  knowledgeSuite.ok ? '' : knowledgeSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const generatorSuite = runSuite('verify-generator.mjs')
assert(
  'Test 30d — Existing Generator verification still passes',
  generatorSuite.ok,
  generatorSuite.ok ? '' : generatorSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

const interactionSuite = runSuite('verify-interactions.mjs')
assert(
  'Test 30e — Existing Interaction verification still passes',
  interactionSuite.ok,
  interactionSuite.ok ? '' : interactionSuite.output.split('\n').filter((line) => line.startsWith('FAIL')).join(' | '),
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
