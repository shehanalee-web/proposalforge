/**
 * H16.15 Slice 15.5 — Agent-origin write facade.
 * Focused persist checks. Does not nest other verifiers.
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
  AUTOMATION_INTAKE_STATUS,
  approveAgentOriginApproval,
  authorizeAgentOriginExecution,
  createAgentOriginActivity,
  createMemoryActivityRepository,
  createStudioActivity,
  getActivityRepository,
  listAcceptedAutomationEventsForCompany,
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeStudioPrincipal,
  registerActivityRepository,
  rejectAgentOriginApproval,
  resetActivityRepository,
  resetAutomationIntakeStore,
  updateStudioActivity,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const writeSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginWrite.js'),
  'utf8',
)
const authoringSource = readFileSync(
  join(root, 'src/integrations/activities/authoring.js'),
  'utf8',
)
const originSource = readFileSync(join(root, 'src/integrations/activities/agentOrigin.js'), 'utf8')
const approvalSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginApproval.js'),
  'utf8',
)
const executionSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginExecution.js'),
  'utf8',
)
const attributionSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginAttribution.js'),
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

async function listed(companyId) {
  const page = await getActivityRepository().list({ companyId })
  return Array.isArray(page?.entries) ? page.entries : []
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
const otherRequest = makeAgentOriginActivityRequest({
  actor: { id: 'agent-other', kind: ACTIVITY_ACTOR_KIND.AGENT, displayName: 'Other' },
  companyId: DEFAULT_COMPANY_ID,
})
const approver = makeStudioPrincipal({
  id: 'user-studio-sarah',
  kind: ACTIVITY_ACTOR_KIND.USER,
  displayName: 'Sarah',
  companyId: DEFAULT_COMPANY_ID,
})
const pending = makeAgentOriginApproval({
  id: 'aoa-write-1',
  request,
  approver,
})
const approved = approveAgentOriginApproval(pending, approver)
const rejected = rejectAgentOriginApproval(pending, approver)
const authorized = authorizeAgentOriginExecution(request, approved)

const activityFields = {
  kind: ACTIVITY_KIND.NOTE,
  subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-studio-1' },
  subjectLine: 'Agent attributed note',
  occurredAt: '2026-09-13T12:00:00.000Z',
}

const otherTenantRequest = makeAgentOriginActivityRequest({
  actor: { id: 'agent-forge', kind: ACTIVITY_ACTOR_KIND.AGENT, displayName: 'Forge' },
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
})
const otherTenantApproval = approveAgentOriginApproval(
  makeAgentOriginApproval({
    request: otherTenantRequest,
    approver: {
      id: 'user-harborline-lee',
      kind: ACTIVITY_ACTOR_KIND.USER,
      displayName: 'Lee',
      companyId: WORKFLOW_ISOLATION_COMPANY_ID,
    },
  }),
  {
    id: 'user-harborline-lee',
    kind: ACTIVITY_ACTOR_KIND.USER,
    displayName: 'Lee',
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  },
)
const otherApproval = approveAgentOriginApproval(
  makeAgentOriginApproval({
    request: otherRequest,
    approver,
  }),
  approver,
)

installMemoryRepository()
const persisted = await createAgentOriginActivity(authorized, activityFields)
const asPrincipal = await threw(() =>
  Promise.resolve(
    makeStudioPrincipal({
      id: persisted.actor.id,
      kind: persisted.actor.kind,
      displayName: persisted.actor.displayName,
      companyId: persisted.companyId,
    }),
  ),
)
const accepted = listAcceptedAutomationEventsForCompany(DEFAULT_COMPANY_ID)
const emitted = accepted.find((event) => event.sourceEventIdentity === persisted.id)

assert(
  '1. approved authorized execution persists an activity with an id',
  typeof persisted.id === 'string' &&
    persisted.id.length > 0 &&
    (await listed(DEFAULT_COMPANY_ID)).some((row) => row.id === persisted.id),
)

assert(
  '2. persisted origin is AGENT and actor is the authorized agent',
  persisted.origin === ACTIVITY_ORIGIN.AGENT &&
    persisted.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    persisted.actor.id === authorized.actor.id &&
    persisted.actor.displayName === authorized.actor.displayName &&
    persisted.actor.displayName === 'Forge' &&
    persisted.companyId === authorized.companyId &&
    persisted.companyId === DEFAULT_COMPANY_ID,
)

assert(
  '3. H16.11 emission occurs after persistence',
  writeSource.includes('emitNativeActivityCreated(activity)') &&
    writeSource.indexOf('getActivityRepository().create') <
      writeSource.indexOf('emitNativeActivityCreated(activity)') &&
    emitted?.intake?.status === AUTOMATION_INTAKE_STATUS.ACCEPTED &&
    emitted.type === 'activity.note.created',
)

installMemoryRepository()
const pendingError = await threw(() =>
  createAgentOriginActivity({ request, approval: pending }, activityFields),
)
assert(
  '4. pending approval fails and writes nothing',
  pendingError instanceof ValidationError &&
    pendingError.errors?.[0]?.field === 'status' &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const rejectedError = await threw(() =>
  createAgentOriginActivity({ request, approval: rejected }, activityFields),
)
assert(
  '5. rejected approval fails and writes nothing',
  rejectedError instanceof ValidationError &&
    rejectedError.errors?.[0]?.field === 'status' &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const crossTenantError = await threw(() =>
  createAgentOriginActivity({ request, approval: otherTenantApproval }, activityFields),
)
assert(
  '6. cross-tenant request/approval fails and writes nothing',
  crossTenantError instanceof ForbiddenError &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0 &&
    (await listed(WORKFLOW_ISOLATION_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const mismatchError = await threw(() =>
  createAgentOriginActivity({ request, approval: otherApproval }, activityFields),
)
assert(
  '7. mismatched request/approval fails and writes nothing',
  mismatchError instanceof ValidationError &&
    mismatchError.errors?.[0]?.field === 'approval' &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const userOriginError = await threw(() =>
  createAgentOriginActivity(authorized, {
    ...activityFields,
    origin: ACTIVITY_ORIGIN.USER,
  }),
)
assert(
  '8. USER origin spoof fails and writes nothing',
  userOriginError instanceof ValidationError &&
    userOriginError.errors?.[0]?.field === 'origin' &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const userActorError = await threw(() =>
  createAgentOriginActivity(authorized, {
    ...activityFields,
    actor: {
      id: request.actor.id,
      kind: ACTIVITY_ACTOR_KIND.USER,
      displayName: request.actor.displayName,
    },
  }),
)
assert(
  '9. USER actor spoof fails and writes nothing',
  userActorError instanceof ValidationError &&
    userActorError.errors?.[0]?.field === 'kind' &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const wrongIdError = await threw(() =>
  createAgentOriginActivity(authorized, {
    ...activityFields,
    actor: {
      id: otherRequest.actor.id,
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: otherRequest.actor.displayName,
    },
  }),
)
assert(
  '10. wrong AGENT actor id fails and writes nothing',
  wrongIdError instanceof ValidationError &&
    wrongIdError.errors?.[0]?.field === 'actor.id' &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const omittedActor = await createAgentOriginActivity(authorized, activityFields)
assert(
  '11. omitted actor is still stamped from authorization',
  omittedActor.origin === ACTIVITY_ORIGIN.AGENT &&
    omittedActor.actor.id === authorized.actor.id &&
    omittedActor.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    omittedActor.actor.displayName === authorized.actor.displayName,
)

installMemoryRepository()
const tenantOverrideError = await threw(() =>
  createAgentOriginActivity(authorized, {
    ...activityFields,
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  }),
)
assert(
  '12. caller-supplied companyId cannot override the authorized tenant',
  tenantOverrideError instanceof ForbiddenError &&
    (await listed(DEFAULT_COMPANY_ID)).length === 0 &&
    (await listed(WORKFLOW_ISOLATION_COMPANY_ID)).length === 0,
)

installMemoryRepository()
const stamped = await createAgentOriginActivity(authorized, {
  ...activityFields,
  origin: ACTIVITY_ORIGIN.AGENT,
  actor: {
    id: authorized.actor.id,
    kind: ACTIVITY_ACTOR_KIND.AGENT,
    displayName: 'Ignored payload name',
  },
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '13. caller-supplied actor/displayName cannot override authorized attribution',
  stamped.origin === ACTIVITY_ORIGIN.AGENT &&
    stamped.actor.id === authorized.actor.id &&
    stamped.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    stamped.actor.displayName === authorized.actor.displayName &&
    stamped.actor.displayName === 'Forge',
)

installMemoryRepository()
const studioCreated = await createStudioActivity({
  ...activityFields,
  origin: ACTIVITY_ORIGIN.AGENT,
  actor: {
    id: request.actor.id,
    kind: ACTIVITY_ACTOR_KIND.AGENT,
    displayName: request.actor.displayName,
  },
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '14. createStudioActivity remains USER-origin',
  studioCreated.origin === ACTIVITY_ORIGIN.USER &&
    studioCreated.origin !== ACTIVITY_ORIGIN.AGENT &&
    authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
    !authoringSource.includes('createAgentOriginActivity'),
)

assert(
  '15. agent actor cannot become a Studio Principal',
  asPrincipal instanceof ValidationError && asPrincipal.errors?.[0]?.field === 'kind',
)

installMemoryRepository()
const toPatch = await createAgentOriginActivity(authorized, activityFields)
const originPatch = await threw(() =>
  updateStudioActivity(toPatch.id, { origin: ACTIVITY_ORIGIN.USER }, DEFAULT_COMPANY_ID),
)
const afterPatch = await getActivityRepository().get(toPatch.id, DEFAULT_COMPANY_ID)
assert(
  '16. PATCH/update cannot change activity origin',
  originPatch instanceof ValidationError &&
    originPatch.errors?.[0]?.field === 'origin' &&
    afterPatch.origin === ACTIVITY_ORIGIN.AGENT,
)

assert(
  '17. no HTTP/auth/SQL/worker/executor/runtime or unrelated approval reuse',
  !existsSync(join(root, 'server/integrationsAgentOriginWritePlugin.js')) &&
    writeSource.includes('getActivityRepository().create') &&
    writeSource.includes('emitNativeActivityCreated') &&
    writeSource.includes('authorizeAgentOriginExecution') &&
    writeSource.includes('makeAgentOriginAttributedActivity') &&
    !writeSource.includes('createStudioActivity(') &&
    !writeSource.includes('executeAutomationAction') &&
    !writeSource.includes('workflow/approvals') &&
    !writeSource.includes('knowledge/approvals') &&
    !writeSource.includes('models/approval') &&
    !writeSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !writeSource.includes('registerTimelineSource') &&
    !/\/api\//.test(writeSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(writeSource) &&
    !originSource.includes('createAgentOriginActivity') &&
    !approvalSource.includes('createAgentOriginActivity') &&
    !executionSource.includes('createAgentOriginActivity') &&
    !attributionSource.includes('createAgentOriginActivity'),
)

resetActivityRepository()
resetAutomationIntakeStore()

console.log('')
console.log(`H16.15 write-facade contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
