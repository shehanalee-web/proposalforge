/**
 * H16.15 Slice 15.6 — Agent-origin read facade.
 * Focused get/list checks. Does not nest other verifiers.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
  approveAgentOriginApproval,
  authorizeAgentOriginExecution,
  createAgentOriginActivity,
  createMemoryActivityRepository,
  createStudioActivity,
  getAgentOriginActivity,
  listAgentOriginActivities,
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeStudioPrincipal,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
  updateStudioActivity,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginRead.js'),
  'utf8',
)
const authoringSource = readFileSync(
  join(root, 'src/integrations/activities/authoring.js'),
  'utf8',
)
const writeSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginWrite.js'),
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

async function threw(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

function installMemoryRepository() {
  resetActivityRepository()
  resetAutomationIntakeStore()
  registerActivityRepository(createMemoryActivityRepository())
}

const request = makeAgentOriginActivityRequest({
  actor: { id: 'agent-forge', kind: ACTIVITY_ACTOR_KIND.AGENT, displayName: 'Forge' },
  companyId: DEFAULT_COMPANY_ID,
})
const approver = makeStudioPrincipal({
  id: 'user-studio-sarah',
  kind: ACTIVITY_ACTOR_KIND.USER,
  displayName: 'Sarah',
  companyId: DEFAULT_COMPANY_ID,
})
const approved = approveAgentOriginApproval(
  makeAgentOriginApproval({
    id: 'aoa-read-1',
    request,
    approver,
  }),
  approver,
)
const authorized = authorizeAgentOriginExecution(request, approved)

const activityFields = {
  kind: ACTIVITY_KIND.NOTE,
  subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-studio-1' },
  subjectLine: 'Agent attributed note',
  occurredAt: '2026-09-13T12:00:00.000Z',
}

const userFields = {
  companyId: DEFAULT_COMPANY_ID,
  kind: ACTIVITY_KIND.NOTE,
  subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-studio-1' },
  subjectLine: 'Studio user note',
  occurredAt: '2026-09-13T12:05:00.000Z',
}

installMemoryRepository()
const persisted = await createAgentOriginActivity(authorized, activityFields)
const fetched = await getAgentOriginActivity(persisted.id, DEFAULT_COMPANY_ID)
const listed = await listAgentOriginActivities({ companyId: DEFAULT_COMPANY_ID })

assert(
  '1. getAgentOriginActivity returns the persisted AGENT activity unchanged',
  fetched.id === persisted.id &&
    fetched.origin === ACTIVITY_ORIGIN.AGENT &&
    fetched.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    fetched.actor.id === authorized.actor.id &&
    fetched.actor.displayName === authorized.actor.displayName &&
    fetched.actor.displayName === 'Forge' &&
    fetched.companyId === DEFAULT_COMPANY_ID &&
    fetched.companyId === authorized.companyId,
)

assert(
  '2. listAgentOriginActivities returns the AGENT activity for the tenant',
  listed.entries.some((row) => row.id === persisted.id) &&
    listed.entries.every((row) => row.origin === ACTIVITY_ORIGIN.AGENT),
)

installMemoryRepository()
const agentRow = await createAgentOriginActivity(authorized, activityFields)
const userRow = await createStudioActivity(userFields)
const mixedList = await listAgentOriginActivities({ companyId: DEFAULT_COMPANY_ID })
const userGet = await threw(() => getAgentOriginActivity(userRow.id, DEFAULT_COMPANY_ID))

assert(
  '3. USER-origin createStudioActivity rows are excluded from the agent-origin list',
  mixedList.entries.some((row) => row.id === agentRow.id) &&
    !mixedList.entries.some((row) => row.id === userRow.id) &&
    userRow.origin === ACTIVITY_ORIGIN.USER,
)

assert(
  '4. getAgentOriginActivity on a USER-origin activity fails with ValidationError',
  userGet instanceof ValidationError && userGet.errors?.[0]?.field === 'origin',
)

installMemoryRepository()
const tenantRow = await createAgentOriginActivity(authorized, activityFields)
const crossTenant = await threw(() =>
  getAgentOriginActivity(tenantRow.id, WORKFLOW_ISOLATION_COMPANY_ID),
)
const otherList = await listAgentOriginActivities({
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
})

assert(
  '5. cross-tenant get fails with ForbiddenError and does not leak the record',
  crossTenant instanceof ForbiddenError &&
    !otherList.entries.some((row) => row.id === tenantRow.id),
)

{
  resetActivityRepository()
  resetAutomationIntakeStore()
  const memory = createMemoryActivityRepository()
  registerActivityRepository({
    id: memory.id,
    describe: () => memory.describe(),
    health: () => memory.health(),
    create: (...args) => memory.create(...args),
    async get(id, companyId) {
      const record = await memory.get(id, companyId)
      return { ...record, companyId: WORKFLOW_ISOLATION_COMPANY_ID }
    },
    list: (...args) => memory.list(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
  })
  const planted = await createAgentOriginActivity(authorized, activityFields)
  const mismatched = await threw(() =>
    getAgentOriginActivity(planted.id, DEFAULT_COMPANY_ID),
  )
  assert(
    '6. mismatched stored companyId from get cannot be returned',
    mismatched instanceof ValidationError &&
      mismatched.errors?.[0]?.field === 'companyId' &&
      planted.companyId === DEFAULT_COMPANY_ID,
  )
}

installMemoryRepository()
const agentOnly = await createAgentOriginActivity(authorized, activityFields)
await createStudioActivity(userFields)
const spoofedOrigins = await listAgentOriginActivities({
  companyId: DEFAULT_COMPANY_ID,
  origins: [ACTIVITY_ORIGIN.USER, ACTIVITY_ORIGIN.AGENT, ACTIVITY_ORIGIN.SYSTEM],
})

assert(
  '7. caller-supplied list origins cannot surface USER-origin records',
  spoofedOrigins.entries.every((row) => row.origin === ACTIVITY_ORIGIN.AGENT) &&
    spoofedOrigins.entries.some((row) => row.id === agentOnly.id) &&
    !spoofedOrigins.entries.some((row) => row.origin === ACTIVITY_ORIGIN.USER),
)

assert(
  '8. stored actor id/kind/displayName and origin are not rewritten',
  fetched.actor.id === persisted.actor.id &&
    fetched.actor.kind === persisted.actor.kind &&
    fetched.actor.displayName === persisted.actor.displayName &&
    fetched.origin === persisted.origin &&
    fetched.origin === ACTIVITY_ORIGIN.AGENT,
)

assert(
  '9. get/list do not call emitNativeActivityCreated',
  !readSource.includes('emitNativeActivityCreated') &&
    !readSource.includes('createStudioActivity') &&
    readSource.includes('getActivityRepository()'),
)

assert(
  '10. createStudioActivity remains USER-origin',
  userRow.origin === ACTIVITY_ORIGIN.USER &&
    authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
    !authoringSource.includes('getAgentOriginActivity') &&
    !authoringSource.includes('listAgentOriginActivities'),
)

const asPrincipal = await threw(() =>
  Promise.resolve(
    makeStudioPrincipal({
      id: fetched.actor.id,
      kind: fetched.actor.kind,
      displayName: fetched.actor.displayName,
      companyId: fetched.companyId,
    }),
  ),
)
assert(
  '11. AGENT actor still cannot become a Studio Principal',
  asPrincipal instanceof ValidationError && asPrincipal.errors?.[0]?.field === 'kind',
)

installMemoryRepository()
const toPatch = await createAgentOriginActivity(authorized, activityFields)
const originPatch = await threw(() =>
  updateStudioActivity(toPatch.id, { origin: ACTIVITY_ORIGIN.USER }, DEFAULT_COMPANY_ID),
)
const afterPatch = await getAgentOriginActivity(toPatch.id, DEFAULT_COMPANY_ID)
assert(
  '12. PATCH/update still cannot change activity origin',
  originPatch instanceof ValidationError &&
    originPatch.errors?.[0]?.field === 'origin' &&
    afterPatch.origin === ACTIVITY_ORIGIN.AGENT,
)

assert(
  '13. no HTTP/auth/SQL/worker/runtime/TimelineSource or unrelated approval reuse',
  !existsSync(join(root, 'server/integrationsAgentOriginReadPlugin.js')) &&
    !readSource.includes('executeAutomationAction') &&
    !readSource.includes('workflow/approvals') &&
    !readSource.includes('knowledge/approvals') &&
    !readSource.includes('models/approval') &&
    !readSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !readSource.includes('registerTimelineSource') &&
    !readSource.includes('listStudioTimeline') &&
    !/\/api\//.test(readSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(readSource) &&
    writeSource.includes('createAgentOriginActivity') &&
    !readSource.includes('createAgentOriginActivity('),
)

resetActivityRepository()
resetAutomationIntakeStore()

console.log('')
console.log(`H16.15 read-facade contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
