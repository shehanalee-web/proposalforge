/**
 * H16.15 Slice 15.4 — Agent-origin attribution contract.
 * Focused write-shape checks. Does not nest other verifiers.
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
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
  approveAgentOriginApproval,
  authorizeAgentOriginExecution,
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeAgentOriginAttributedActivity,
  makeStudioPrincipal,
  rejectAgentOriginApproval,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const attributionSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginAttribution.js'),
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
const authoringSource = readFileSync(
  join(root, 'src/integrations/activities/authoring.js'),
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

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
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
  id: 'aoa-attr-1',
  request,
  approver,
})
const approved = approveAgentOriginApproval(pending, approver)
const rejected = rejectAgentOriginApproval(pending, approver)
const authorized = authorizeAgentOriginExecution(request, approved)

const activityFields = {
  kind: ACTIVITY_KIND.NOTE,
  subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-studio-1' },
}

const attributed = makeAgentOriginAttributedActivity(authorized, activityFields)
const asPrincipal = threw(() =>
  makeStudioPrincipal({
    id: attributed.actor.id,
    kind: attributed.actor.kind,
    displayName: attributed.actor.displayName,
    companyId: attributed.companyId,
  }),
)
const matchingActor = makeAgentOriginAttributedActivity(authorized, {
  ...activityFields,
  origin: ACTIVITY_ORIGIN.AGENT,
  actor: {
    id: request.actor.id,
    kind: ACTIVITY_ACTOR_KIND.AGENT,
    displayName: 'Ignored payload name',
  },
})
const userKindActor = threw(() =>
  makeAgentOriginAttributedActivity(authorized, {
    ...activityFields,
    actor: {
      id: request.actor.id,
      kind: ACTIVITY_ACTOR_KIND.USER,
      displayName: request.actor.displayName,
    },
  }),
)
const wrongIdActor = threw(() =>
  makeAgentOriginAttributedActivity(authorized, {
    ...activityFields,
    actor: {
      id: otherRequest.actor.id,
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: otherRequest.actor.displayName,
    },
  }),
)
const spoofedOrigin = threw(() =>
  makeAgentOriginAttributedActivity(authorized, {
    ...activityFields,
    origin: ACTIVITY_ORIGIN.USER,
  }),
)

assert(
  '1. authorized execution maps to a frozen AGENT write shape without activityId',
  Object.isFrozen(attributed) &&
    Object.isFrozen(attributed.actor) &&
    Object.isFrozen(attributed.subject) &&
    attributed.origin === ACTIVITY_ORIGIN.AGENT &&
    attributed.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    attributed.actor.id === request.actor.id &&
    attributed.actor.displayName === request.actor.displayName &&
    attributed.companyId === DEFAULT_COMPANY_ID &&
    attributed.companyId === authorized.companyId &&
    attributed.kind === ACTIVITY_KIND.NOTE &&
    attributed.subject.type === ACTIVITY_SUBJECT_TYPE.PROPOSAL &&
    attributed.subject.id === 'prop-studio-1' &&
    attributed.type === ACTIVITY_NATIVE_TYPE.NOTE_CREATED &&
    !Object.prototype.hasOwnProperty.call(attributed, 'activityId') &&
    !Object.prototype.hasOwnProperty.call(attributed, 'id') &&
    !Object.prototype.hasOwnProperty.call(attributed, 'createdAt'),
)

assert(
  '2. pending approval cannot be attributed',
  threw(() => makeAgentOriginAttributedActivity({ request, approval: pending }, activityFields)) instanceof
    ValidationError &&
    threw(() => makeAgentOriginAttributedActivity({ request, approval: pending }, activityFields))
      .errors?.[0]?.field === 'status',
)

assert(
  '3. rejected approval cannot be attributed',
  threw(() =>
    makeAgentOriginAttributedActivity({ request, approval: rejected }, activityFields),
  ) instanceof ValidationError &&
    threw(() =>
      makeAgentOriginAttributedActivity({ request, approval: rejected }, activityFields),
    ).errors?.[0]?.field === 'status',
)

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

assert(
  '4. cross-tenant authorization fails with ForbiddenError',
  threw(() =>
    makeAgentOriginAttributedActivity(
      { request, approval: otherTenantApproval },
      activityFields,
    ),
  ) instanceof ForbiddenError,
)

assert(
  '5. mismatched request/approval fails with ValidationError',
  threw(() =>
    makeAgentOriginAttributedActivity({ request, approval: otherApproval }, activityFields),
  ) instanceof ValidationError &&
    threw(() =>
      makeAgentOriginAttributedActivity({ request, approval: otherApproval }, activityFields),
    ).errors?.[0]?.field === 'approval',
)

assert(
  '6. spoofed USER origin is rejected with ValidationError',
  spoofedOrigin instanceof ValidationError && spoofedOrigin.errors?.[0]?.field === 'origin',
)

assert(
  '7. actor with USER kind is rejected',
  userKindActor instanceof ValidationError && userKindActor.errors?.[0]?.field === 'kind',
)

assert(
  '8. actor with AGENT kind but wrong id is rejected',
  wrongIdActor instanceof ValidationError && wrongIdActor.errors?.[0]?.field === 'actor.id',
)

assert(
  '9. actor with AGENT kind and matching id succeeds; stamps come from authorized execution',
  matchingActor.origin === ACTIVITY_ORIGIN.AGENT &&
    matchingActor.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    matchingActor.actor.id === authorized.actor.id &&
    matchingActor.actor.displayName === authorized.actor.displayName &&
    matchingActor.actor.displayName === 'Forge' &&
    matchingActor.companyId === authorized.companyId,
)

assert(
  '10. omitted actor remains valid and is stamped from authorized execution',
  attributed.origin === ACTIVITY_ORIGIN.AGENT &&
    attributed.actor.id === authorized.actor.id &&
    attributed.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    attributed.actor.displayName === authorized.actor.displayName &&
    attributed.companyId === authorized.companyId,
)

assert(
  '11. attributed actor cannot be used as a Studio Principal',
  asPrincipal instanceof ValidationError && asPrincipal.errors?.[0]?.field === 'kind',
)

assert(
  '12. mapper has no persist, emit, executor, HTTP, auth, or reused approval stores',
  !existsSync(join(root, 'server/integrationsAgentOriginAttributionPlugin.js')) &&
    !attributionSource.includes('getActivityRepository') &&
    !attributionSource.includes('emitNativeActivityCreated') &&
    !attributionSource.includes('createStudioActivity') &&
    !attributionSource.includes('executeAutomationAction') &&
    !attributionSource.includes('workflow/approvals') &&
    !attributionSource.includes('knowledge/approvals') &&
    !attributionSource.includes('models/approval') &&
    !attributionSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !/\/api\//.test(attributionSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(attributionSource),
)

assert(
  '13. createStudioActivity remains the USER-origin path and does not import attribution',
  authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
    !authoringSource.includes('makeAgentOriginAttributedActivity') &&
    !authoringSource.includes('agentOriginAttribution') &&
    !authoringSource.includes('makeAgentOriginActivityRequest') &&
    !authoringSource.includes('authorizeAgentOriginExecution'),
)

assert(
  '14. H16.15.1–15.3 contracts do not call the attribution helper',
  originSource.includes('makeAgentOriginActivityRequest') &&
    approvalSource.includes('approveAgentOriginApproval') &&
    executionSource.includes('authorizeAgentOriginExecution') &&
    executionSource.includes("AUTHORIZED: 'authorized'") &&
    !originSource.includes('makeAgentOriginAttributedActivity') &&
    !approvalSource.includes('makeAgentOriginAttributedActivity') &&
    !executionSource.includes('makeAgentOriginAttributedActivity') &&
    !originSource.includes('agentOriginAttribution') &&
    !approvalSource.includes('agentOriginAttribution') &&
    !executionSource.includes('agentOriginAttribution'),
)

console.log('')
console.log(`H16.15 attribution contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
