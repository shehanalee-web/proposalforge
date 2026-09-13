/**
 * H16.15 Slice 15.7 — Agent-origin update facade.
 * Focused update checks. Does not nest other verifiers.
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
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeStudioPrincipal,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
  updateAgentOriginActivity,
  updateStudioActivity,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const updateSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginUpdate.js'),
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
const readSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginRead.js'),
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
    id: 'aoa-update-1',
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
const updated = await updateAgentOriginActivity(persisted.id, DEFAULT_COMPANY_ID, {
  subjectLine: 'Agent attributed note (edited)',
  body: 'Updated body',
})
const fetched = await getAgentOriginActivity(persisted.id, DEFAULT_COMPANY_ID)

assert(
  '1. updateAgentOriginActivity applies mutable fields and keeps attribution',
  updated.id === persisted.id &&
    updated.subjectLine === 'Agent attributed note (edited)' &&
    updated.body === 'Updated body' &&
    fetched.subjectLine === updated.subjectLine &&
    fetched.body === updated.body &&
    updated.origin === ACTIVITY_ORIGIN.AGENT &&
    updated.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    updated.actor.id === persisted.actor.id &&
    updated.actor.displayName === persisted.actor.displayName &&
    updated.actor.displayName === 'Forge' &&
    updated.companyId === DEFAULT_COMPANY_ID &&
    updated.companyId === persisted.companyId,
)

installMemoryRepository()
const originRow = await createAgentOriginActivity(authorized, activityFields)
const originPatch = await threw(() =>
  updateAgentOriginActivity(originRow.id, DEFAULT_COMPANY_ID, {
    origin: ACTIVITY_ORIGIN.USER,
  }),
)
const afterOrigin = await getAgentOriginActivity(originRow.id, DEFAULT_COMPANY_ID)
assert(
  '2. patching origin fails closed and does not rewrite attribution',
  originPatch instanceof ValidationError &&
    originPatch.errors?.[0]?.field === 'origin' &&
    afterOrigin.origin === ACTIVITY_ORIGIN.AGENT &&
    afterOrigin.actor.id === originRow.actor.id &&
    afterOrigin.subjectLine === originRow.subjectLine,
)

installMemoryRepository()
const actorRow = await createAgentOriginActivity(authorized, activityFields)
const actorPatch = await threw(() =>
  updateAgentOriginActivity(actorRow.id, DEFAULT_COMPANY_ID, {
    actor: {
      id: 'user-studio-sarah',
      kind: ACTIVITY_ACTOR_KIND.USER,
      displayName: 'Sarah',
    },
  }),
)
const companyPatch = await threw(() =>
  updateAgentOriginActivity(actorRow.id, DEFAULT_COMPANY_ID, {
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  }),
)
const afterActor = await getAgentOriginActivity(actorRow.id, DEFAULT_COMPANY_ID)
assert(
  '3. patching actor or companyId fails closed and is not rewritten',
  actorPatch instanceof ValidationError &&
    actorPatch.errors?.[0]?.field === 'actor' &&
    companyPatch instanceof ValidationError &&
    companyPatch.errors?.[0]?.field === 'companyId' &&
    afterActor.actor.id === actorRow.actor.id &&
    afterActor.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    afterActor.companyId === DEFAULT_COMPANY_ID,
)

installMemoryRepository()
const userRow = await createStudioActivity(userFields)
const userUpdate = await threw(() =>
  updateAgentOriginActivity(userRow.id, DEFAULT_COMPANY_ID, {
    subjectLine: 'Hijacked user note',
  }),
)
const userAfter = await getAgentOriginActivity(userRow.id, DEFAULT_COMPANY_ID).catch((error) => error)
assert(
  '4. USER-origin createStudioActivity rows cannot be updated here',
  userRow.origin === ACTIVITY_ORIGIN.USER &&
    userUpdate instanceof ValidationError &&
    userUpdate.errors?.[0]?.field === 'origin' &&
    userAfter instanceof ValidationError,
)

installMemoryRepository()
const tenantRow = await createAgentOriginActivity(authorized, activityFields)
const crossTenant = await threw(() =>
  updateAgentOriginActivity(tenantRow.id, WORKFLOW_ISOLATION_COMPANY_ID, {
    subjectLine: 'Cross-tenant edit',
  }),
)
const stillThere = await getAgentOriginActivity(tenantRow.id, DEFAULT_COMPANY_ID)
assert(
  '5. cross-tenant update fails with ForbiddenError and does not mutate',
  crossTenant instanceof ForbiddenError &&
    stillThere.subjectLine === tenantRow.subjectLine &&
    stillThere.companyId === DEFAULT_COMPANY_ID,
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
    updateAgentOriginActivity(planted.id, DEFAULT_COMPANY_ID, {
      subjectLine: 'Hijacked after mismatched get',
    }),
  )
  const stored = await memory.get(planted.id, DEFAULT_COMPANY_ID)
  assert(
    '6. mismatched stored companyId from get cannot be updated',
    mismatched instanceof ValidationError &&
      mismatched.errors?.[0]?.field === 'companyId' &&
      stored.subjectLine === planted.subjectLine &&
      stored.companyId === DEFAULT_COMPANY_ID,
  )
}

{
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
    async update(id, patch, companyId) {
      const record = await memory.update(id, patch, companyId)
      return { ...record, companyId: WORKFLOW_ISOLATION_COMPANY_ID }
    },
    archive: (...args) => memory.archive(...args),
  })
  const planted = await createAgentOriginActivity(authorized, activityFields)
  const mismatched = await threw(() =>
    updateAgentOriginActivity(planted.id, DEFAULT_COMPANY_ID, {
      subjectLine: 'Edited then mismatched return',
    }),
  )
  assert(
    '7. mismatched stored companyId from update cannot be returned',
    mismatched instanceof ValidationError && mismatched.errors?.[0]?.field === 'companyId',
  )
}

assert(
  '8. stored actor id/kind/displayName and origin are not rewritten',
  updated.actor.id === persisted.actor.id &&
    updated.actor.kind === persisted.actor.kind &&
    updated.actor.displayName === persisted.actor.displayName &&
    updated.origin === persisted.origin &&
    updated.origin === ACTIVITY_ORIGIN.AGENT,
)

assert(
  '9. update does not emit or call USER authoring facades',
  !updateSource.includes('emitNativeActivityCreated') &&
    !updateSource.includes('createStudioActivity') &&
    !updateSource.includes('updateStudioActivity') &&
    updateSource.includes('getActivityRepository().update') &&
    updateSource.includes('getActivityRepository().get'),
)

assert(
  '10. createStudioActivity remains USER-origin',
  userRow.origin === ACTIVITY_ORIGIN.USER &&
    authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
    !authoringSource.includes('updateAgentOriginActivity') &&
    !authoringSource.includes('getAgentOriginActivity'),
)

const asPrincipal = await threw(() =>
  Promise.resolve(
    makeStudioPrincipal({
      id: updated.actor.id,
      kind: updated.actor.kind,
      displayName: updated.actor.displayName,
      companyId: updated.companyId,
    }),
  ),
)
assert(
  '11. AGENT actor still cannot become a Studio Principal',
  asPrincipal instanceof ValidationError && asPrincipal.errors?.[0]?.field === 'kind',
)

installMemoryRepository()
const toPatch = await createAgentOriginActivity(authorized, activityFields)
const studioOriginPatch = await threw(() =>
  updateStudioActivity(toPatch.id, { origin: ACTIVITY_ORIGIN.USER }, DEFAULT_COMPANY_ID),
)
const afterStudioPatch = await getAgentOriginActivity(toPatch.id, DEFAULT_COMPANY_ID)
assert(
  '12. PATCH/update still cannot change activity origin',
  studioOriginPatch instanceof ValidationError &&
    studioOriginPatch.errors?.[0]?.field === 'origin' &&
    afterStudioPatch.origin === ACTIVITY_ORIGIN.AGENT,
)

assert(
  '13. no HTTP/auth/SQL/worker/runtime/TimelineSource or unrelated approval reuse',
  !existsSync(join(root, 'server/integrationsAgentOriginUpdatePlugin.js')) &&
    !updateSource.includes('executeAutomationAction') &&
    !updateSource.includes('workflow/approvals') &&
    !updateSource.includes('knowledge/approvals') &&
    !updateSource.includes('models/approval') &&
    !updateSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !updateSource.includes('registerTimelineSource') &&
    !updateSource.includes('listStudioTimeline') &&
    !updateSource.includes('authorizeAgentOriginExecution') &&
    !updateSource.includes('makeAgentOriginAttributedActivity') &&
    !/\/api\//.test(updateSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(updateSource) &&
    writeSource.includes('createAgentOriginActivity') &&
    !updateSource.includes('createAgentOriginActivity(') &&
    readSource.includes('getAgentOriginActivity') &&
    !readSource.includes('updateAgentOriginActivity'),
)

resetActivityRepository()
resetAutomationIntakeStore()

console.log('')
console.log(`H16.15 update-facade contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
