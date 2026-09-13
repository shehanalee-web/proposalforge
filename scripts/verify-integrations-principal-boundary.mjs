/**
 * H16.14 Slice 14.4 — Boundary lock.
 * Independent. Does not nest 14.1–14.3, authoring, or H16.11 suites.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID, getWorkflowActor } from '../src/workflow/actors.js'
import { integrationsActivityAuthoringPlugin } from '../server/integrationsActivityAuthoringPlugin.js'
import {
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_INTAKE_STATUS,
  STUDIO_PRINCIPAL_FORBIDDEN_FIELDS,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  configureTimelineProposalLookup,
  createMemoryActivityRepository,
  createStudioActivity,
  listAcceptedAutomationEventsForCompany,
  makeStudioPrincipal,
  refreshActivityRepositoryHealth,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
  resetTimelineProposalLookup,
  setActivityAuthoringCapabilityOverrideForTests,
  clearActivityAuthoringCapabilityOverrideForTests,
  setRequestStudioPrincipal,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const studio = DEFAULT_COMPANY_ID
const sarah = getWorkflowActor(DEFAULT_ACTOR_ID)
const proposalId = 'prop-h16144-a'
const sarahPrincipal = { id: sarah.id, name: sarah.name, companyId: sarah.companyId }
const lockedTimelineSourceIds =
  'native_activity,automation_ledger,studio_audit,living_events,workflow_activity,portal_activity,interaction_activity,proposal_activity,commercial_close_history'

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
  } else {
    failed += 1
    console.error(`FAIL  ${name}`)
  }
}

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function sourceOf(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
}

function noteInput(overrides = {}) {
  return {
    companyId: studio,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: proposalId },
    subjectLine: 'Boundary lock',
    occurredAt: '2026-09-13T08:00:00.000Z',
    ...overrides,
  }
}

function invoke(plugin, { url, body, principal }) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body))
    const req = {
      method: 'POST',
      url,
      headers: {},
      on(event, cb) {
        if (event === 'data') queueMicrotask(() => cb(payload))
        if (event === 'end') queueMicrotask(cb)
        return req
      },
      destroy() {},
    }
    if (principal) setRequestStudioPrincipal(req, principal)
    const res = {
      statusCode: 0,
      setHeader() {},
      end(raw) {
        resolve({ status: this.statusCode, body: raw ? JSON.parse(raw) : null })
      },
    }
    Promise.resolve(plugin.handle(req, res, () => resolve({ status: 0, body: null }))).catch(reject)
  })
}

const dataStatusBefore = git(['status', '--porcelain', '--', 'data'])

console.log('— H16.14.4 boundary lock —')

resetActivityRepository()
resetAutomationIntakeStore()
const memory = createMemoryActivityRepository()
registerActivityRepository({
  id: ACTIVITY_REPOSITORY_ID.POSTGRES,
  describe: () => ({
    id: ACTIVITY_REPOSITORY_ID.POSTGRES,
    durable: true,
    mode: ACTIVITY_REPOSITORY_MODE.POSTGRES,
  }),
  health: async () => ({ ok: true, durable: true, migrated: true, message: 'ok' }),
  create: (...args) => memory.create(...args),
  get: (...args) => memory.get(...args),
  list: (...args) => memory.list(...args),
  update: (...args) => memory.update(...args),
  archive: (...args) => memory.archive(...args),
})
await refreshActivityRepositoryHealth()
setActivityAuthoringCapabilityOverrideForTests(true)
configureTimelineProposalLookup((id) =>
  String(id ?? '') === proposalId ? { id: proposalId, companyId: studio } : null,
)

const plugin = integrationsActivityAuthoringPlugin()
const querySpoof = await invoke(plugin, {
  url: '/api/activities?actorId=user-studio-david',
  principal: sarahPrincipal,
  body: noteInput(),
})
const bodySpoof = await invoke(plugin, {
  url: '/api/activities',
  principal: sarahPrincipal,
  body: noteInput({ actorId: 'user-studio-david' }),
})
assert(
  '1. HTTP actorId claim spoofing is rejected with 403',
  querySpoof.status === 403 && bodySpoof.status === 403,
)

const principal = makeStudioPrincipal(sarahPrincipal)
const stamped = await createStudioActivity(
  noteInput({
    principal,
    actor: { id: 'intruder', kind: 'agent', displayName: 'Intruder' },
    actorId: 'user-studio-david',
  }),
)
assert(
  '2. payload actor cannot override the bound Studio Principal',
  stamped.actor.id === sarah.id && stamped.actor.displayName === 'Sarah',
)

const origins = await Promise.all(
  [ACTIVITY_ORIGIN.AGENT, ACTIVITY_ORIGIN.SYSTEM, ACTIVITY_ORIGIN.INTEGRATION].map((origin) =>
    createStudioActivity(noteInput({ principal, origin, subjectLine: origin })),
  ),
)
assert(
  '3. origin remains USER against agent, system, and integration payloads',
  origins.every((activity) => activity.origin === ACTIVITY_ORIGIN.USER),
)

const cross = await (async () => {
  try {
    await createStudioActivity(noteInput({ principal, companyId: WORKFLOW_ISOLATION_COMPANY_ID }))
    return null
  } catch (error) {
    return error
  }
})()
const crm = threw(() =>
  makeStudioPrincipal({
    ...sarahPrincipal,
    companyRefId: 'company-1',
    subjectType: ACTIVITY_SUBJECT_TYPE.COMPANY,
  }),
)
assert(
  '4. principal.companyId is tenant identity, not a CRM Company subject',
  stamped.companyId === studio &&
    stamped.companyId !== ACTIVITY_SUBJECT_TYPE.COMPANY &&
    ACTIVITY_SUBJECT_TYPE.COMPANY === 'company' &&
    cross instanceof ForbiddenError &&
    crm instanceof ValidationError &&
    STUDIO_PRINCIPAL_FORBIDDEN_FIELDS.includes('companyRefId') &&
    STUDIO_PRINCIPAL_FORBIDDEN_FIELDS.includes('subjectType'),
)

assert(
  '5. TIMELINE_SOURCE_IDS remains exactly nine sources with native_activity canonical',
  TIMELINE_SOURCE_IDS.length === 9 &&
    TIMELINE_SOURCE_IDS.join(',') === lockedTimelineSourceIds &&
    TIMELINE_SOURCE_ID.NATIVE_ACTIVITY === 'native_activity' &&
    !TIMELINE_SOURCE_IDS.includes('email_mailbox'),
)

const publicLocks = [
  ['server/livingPlugin.js', ["matchRoute(url, '/api/living/:token')"], ['studioRequestIdentity', 'bindStudioRequest']],
  ['server/portalPlugin.js', ["matchRoute(url, '/api/proposal-portal/public/:portalId')", 'getClientPortalView({ portalId: publicView.portalId })'], []],
  ['server/interactionsPlugin.js', ["matchRoute(url, '/api/interactions/living/:token')", "matchRoute(url, '/api/interactions/public/:portalId')", 'listLivingClientInteractions({ shareToken: livingPublic.token })'], []],
  ['server/commercialClosePlugin.js', ["matchRoute(url, '/api/commercial-close/public/:token')", 'getClientCommercialCloseSummary({ shareToken: publicByToken.token })'], []],
  ['server/forgePlugin.js', ["url.startsWith('/api/forge/public')", 'clientForgeApiDenied()'], []],
  ['server/followupPlugin.js', ["url.startsWith('/api/followups/public')", 'clientFollowupApiDenied()'], []],
  ['server/integrationsActivityAuthoringPlugin.js', ['bindStudioRequest'], ['/api/activities/public']],
]
assert(
  '6. public share-token routes stay outside Studio Principal authentication',
  publicLocks.every(([file, required, forbidden]) => {
    const src = sourceOf(file)
    return required.every((text) => src.includes(text)) && forbidden.every((text) => !src.includes(text))
  }),
)

const productionDiff = git(['diff', '--', 'package.json', 'src/integrations', 'server', 'src/persistence', 'src/workflow'])
assert(
  '7. this slice introduces no production-file changes',
  productionDiff.status === 0 && !(productionDiff.stdout || '').trim(),
)

const emitted = listAcceptedAutomationEventsForCompany(studio).find(
  (event) => event.sourceEventIdentity === stamped.id,
)
assert(
  '8. createStudioActivity still emits through the H16.11 seam',
  emitted?.intake?.status === AUTOMATION_INTAKE_STATUS.ACCEPTED &&
    emitted.type === 'activity.note.created',
)

const own = sourceOf('scripts/verify-integrations-principal-boundary.mjs')
const dataStatusAfter = git(['status', '--porcelain', '--', 'data'])
assert(
  '9. this suite is independent and does not write data files',
  !/spawnSync\(\s*process\.execPath/.test(own) &&
    !/node\s+scripts\/verify-integrations-/.test(own) &&
    existsSync(join(root, 'data')) &&
    dataStatusBefore.status === 0 &&
    !(dataStatusBefore.stdout || '').trim() &&
    dataStatusAfter.status === 0 &&
    !(dataStatusAfter.stdout || '').trim(),
)

resetActivityRepository()
resetAutomationIntakeStore()
resetTimelineProposalLookup()
clearActivityAuthoringCapabilityOverrideForTests()

console.log('')
console.log(`H16.14 principal boundary checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
