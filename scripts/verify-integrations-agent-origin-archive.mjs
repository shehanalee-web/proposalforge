/**
 * H16.15 Slice 15.8 — Agent-origin archive facade.
 * Focused archive checks. Does not nest other verifiers.
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
  archiveAgentOriginActivity,
  authorizeAgentOriginExecution,
  createAgentOriginActivity,
  createMemoryActivityRepository,
  createStudioActivity,
  getActivityRepository,
  getAgentOriginActivity,
  listAcceptedAutomationEventsForCompany,
  listAgentOriginActivities,
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeStudioPrincipal,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const archiveSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginArchive.js'),
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
const updateSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginUpdate.js'),
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

function wrapMemoryRepository(overrides) {
  resetActivityRepository()
  resetAutomationIntakeStore()
  const memory = createMemoryActivityRepository()
  registerActivityRepository({
    id: memory.id,
    describe: () => memory.describe(),
    health: () => memory.health(),
    create: (...args) => memory.create(...args),
    get: (...args) => memory.get(...args),
    list: (...args) => memory.list(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
    ...overrides,
  })
  return memory
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
    id: 'aoa-archive-1',
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
const acceptedBefore = listAcceptedAutomationEventsForCompany(DEFAULT_COMPANY_ID)
const archived = await archiveAgentOriginActivity(persisted.id, DEFAULT_COMPANY_ID)
const fetched = await getAgentOriginActivity(persisted.id, DEFAULT_COMPANY_ID)
const listed = await listAgentOriginActivities({ companyId: DEFAULT_COMPANY_ID })
const acceptedAfter = listAcceptedAutomationEventsForCompany(DEFAULT_COMPANY_ID)

assert(
  '1. AGENT activity can be archived',
  archived.id === persisted.id && typeof archived.archivedAt === 'string' && archived.archivedAt.length > 0,
)

assert(
  '2. archivedAt is set',
  Boolean(archived.archivedAt) &&
    archived.archivedAt === fetched.archivedAt &&
    !persisted.archivedAt,
)

assert(
  '3. id remains unchanged',
  archived.id === persisted.id && fetched.id === persisted.id,
)

assert(
  '4. origin remains AGENT',
  archived.origin === ACTIVITY_ORIGIN.AGENT &&
    fetched.origin === ACTIVITY_ORIGIN.AGENT &&
    archived.origin === persisted.origin,
)

assert(
  '5. actor remains AGENT',
  archived.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    archived.actor.id === persisted.actor.id &&
    archived.actor.displayName === persisted.actor.displayName &&
    archived.actor.displayName === 'Forge',
)

assert(
  '6. companyId remains unchanged',
  archived.companyId === DEFAULT_COMPANY_ID &&
    archived.companyId === persisted.companyId &&
    fetched.companyId === persisted.companyId,
)

assert(
  '7. getAgentOriginActivity still recognizes the archived record',
  fetched.id === archived.id &&
    fetched.origin === ACTIVITY_ORIGIN.AGENT &&
    fetched.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    Boolean(fetched.archivedAt),
)

assert(
  '8. listAgentOriginActivities excludes it by default',
  !listed.entries.some((row) => row.id === persisted.id),
)

installMemoryRepository()
const userRow = await createStudioActivity(userFields)
const userArchive = await threw(() =>
  archiveAgentOriginActivity(userRow.id, DEFAULT_COMPANY_ID),
)
const userStored = await getActivityRepository().get(userRow.id, DEFAULT_COMPANY_ID)
assert(
  '9. USER-origin activity fails with ValidationError and is not archived',
  userRow.origin === ACTIVITY_ORIGIN.USER &&
    userArchive instanceof ValidationError &&
    userArchive.errors?.[0]?.field === 'origin' &&
    !userStored.archivedAt,
)

{
  const memory = wrapMemoryRepository({
    async get(id, companyId) {
      const record = await memory.get(id, companyId)
      return {
        ...record,
        actor: {
          ...record.actor,
          kind: ACTIVITY_ACTOR_KIND.USER,
        },
      }
    },
  })
  const planted = await createAgentOriginActivity(authorized, activityFields)
  const nonAgent = await threw(() =>
    archiveAgentOriginActivity(planted.id, DEFAULT_COMPANY_ID),
  )
  const stored = await memory.get(planted.id, DEFAULT_COMPANY_ID)
  assert(
    '10. non-AGENT actor fails closed',
    nonAgent instanceof ValidationError &&
      nonAgent.errors?.[0]?.field === 'kind' &&
      stored.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
      !stored.archivedAt,
  )
}

installMemoryRepository()
const tenantRow = await createAgentOriginActivity(authorized, activityFields)
const crossTenant = await threw(() =>
  archiveAgentOriginActivity(tenantRow.id, WORKFLOW_ISOLATION_COMPANY_ID),
)
const stillThere = await getAgentOriginActivity(tenantRow.id, DEFAULT_COMPANY_ID)
assert(
  '11. cross-tenant archive preserves ForbiddenError and does not mutate',
  crossTenant instanceof ForbiddenError &&
    !stillThere.archivedAt &&
    stillThere.companyId === DEFAULT_COMPANY_ID,
)

{
  const memory = wrapMemoryRepository({
    async get(id, companyId) {
      const record = await memory.get(id, companyId)
      return { ...record, companyId: WORKFLOW_ISOLATION_COMPANY_ID }
    },
  })
  const planted = await createAgentOriginActivity(authorized, activityFields)
  const mismatched = await threw(() =>
    archiveAgentOriginActivity(planted.id, DEFAULT_COMPANY_ID),
  )
  const stored = await memory.get(planted.id, DEFAULT_COMPANY_ID)
  assert(
    '12. stored companyId mismatch after get fails closed and does not archive',
    mismatched instanceof ValidationError &&
      mismatched.errors?.[0]?.field === 'companyId' &&
      stored.companyId === DEFAULT_COMPANY_ID &&
      !stored.archivedAt,
  )
}

{
  const memory = wrapMemoryRepository({
    async archive(id, companyId) {
      const record = await memory.archive(id, companyId)
      return { ...record, companyId: WORKFLOW_ISOLATION_COMPANY_ID }
    },
  })
  const planted = await createAgentOriginActivity(authorized, activityFields)
  const mismatched = await threw(() =>
    archiveAgentOriginActivity(planted.id, DEFAULT_COMPANY_ID),
  )
  assert(
    '13. stored companyId mismatch after archive fails closed and does not return the record',
    mismatched instanceof ValidationError && mismatched.errors?.[0]?.field === 'companyId',
  )
}

assert(
  '14. no H16.11 emission occurs',
  !archiveSource.includes('emitNativeActivityCreated') &&
    acceptedAfter.length === acceptedBefore.length,
)

assert(
  '15. no createStudioActivity/archiveStudioActivity call is introduced',
  !archiveSource.includes('createStudioActivity') &&
    !archiveSource.includes('archiveStudioActivity') &&
    archiveSource.includes('getActivityRepository().get') &&
    archiveSource.includes('getActivityRepository().archive'),
)

const asPrincipal = await threw(() =>
  Promise.resolve(
    makeStudioPrincipal({
      id: archived.actor.id,
      kind: archived.actor.kind,
      displayName: archived.actor.displayName,
      companyId: archived.companyId,
    }),
  ),
)
assert(
  '16. agent actor cannot become a Studio Principal',
  asPrincipal instanceof ValidationError && asPrincipal.errors?.[0]?.field === 'kind',
)

assert(
  '17. no HTTP/auth/SQL/worker/TimelineSource/new store/unrelated approval reuse',
  !existsSync(join(root, 'server/integrationsAgentOriginArchivePlugin.js')) &&
    !archiveSource.includes('executeAutomationAction') &&
    !archiveSource.includes('workflow/approvals') &&
    !archiveSource.includes('knowledge/approvals') &&
    !archiveSource.includes('models/approval') &&
    !archiveSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !archiveSource.includes('registerTimelineSource') &&
    !archiveSource.includes('listStudioTimeline') &&
    !archiveSource.includes('authorizeAgentOriginExecution') &&
    !archiveSource.includes('makeAgentOriginAttributedActivity') &&
    !/\/api\//.test(archiveSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(archiveSource) &&
    writeSource.includes('createAgentOriginActivity') &&
    !archiveSource.includes('createAgentOriginActivity(') &&
    updateSource.includes('updateAgentOriginActivity') &&
    !archiveSource.includes('updateAgentOriginActivity') &&
    authoringSource.includes('archiveStudioActivity') &&
    !authoringSource.includes('archiveAgentOriginActivity'),
)

resetActivityRepository()
resetAutomationIntakeStore()

console.log('')
console.log(`H16.15 archive-facade contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
