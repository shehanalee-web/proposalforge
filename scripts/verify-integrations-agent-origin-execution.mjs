/**
 * H16.15 Slice 15.3 — Agent-origin execution-boundary contract.
 * Focused authorization checks. Does not nest other verifiers.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ORIGIN,
  AGENT_ORIGIN_EXECUTION_STATUS,
  approveAgentOriginApproval,
  authorizeAgentOriginExecution,
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeStudioPrincipal,
  rejectAgentOriginApproval,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
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
  id: 'aoa-exec-1',
  request,
  approver,
})
const approved = approveAgentOriginApproval(pending, approver)
const rejected = rejectAgentOriginApproval(pending, approver)

const authorized = authorizeAgentOriginExecution(request, approved)
const asPrincipal = threw(() =>
  makeStudioPrincipal({
    id: authorized.actor.id,
    kind: authorized.actor.kind,
    displayName: authorized.actor.displayName,
    companyId: authorized.companyId,
  }),
)
const spoofed = threw(() =>
  authorizeAgentOriginExecution(
    {
      origin: ACTIVITY_ORIGIN.USER,
      actor: {
        id: request.actor.id,
        kind: ACTIVITY_ACTOR_KIND.USER,
        displayName: request.actor.displayName,
      },
      companyId: DEFAULT_COMPANY_ID,
    },
    approved,
  ),
)
assert(
  '1. approved request is authorized for execution without creating a Native Activity',
  authorized.status === AGENT_ORIGIN_EXECUTION_STATUS.AUTHORIZED &&
    authorized.origin === ACTIVITY_ORIGIN.AGENT &&
    authorized.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    authorized.actor.id === request.actor.id &&
    authorized.companyId === DEFAULT_COMPANY_ID &&
    authorized.companyId === request.companyId &&
    authorized.request.origin === ACTIVITY_ORIGIN.AGENT &&
    authorized.approval.status === 'approved' &&
    authorized.approval.id === approved.id &&
    !Object.prototype.hasOwnProperty.call(authorized, 'activityId') &&
    asPrincipal instanceof ValidationError &&
    asPrincipal.errors?.[0]?.field === 'kind',
)

assert(
  '2. pending and rejected approvals cannot be authorized',
  threw(() => authorizeAgentOriginExecution(request, pending)) instanceof ValidationError &&
    threw(() => authorizeAgentOriginExecution(request, pending)).errors?.[0]?.field ===
      'status' &&
    threw(() => authorizeAgentOriginExecution(request, rejected)) instanceof ValidationError &&
    threw(() => authorizeAgentOriginExecution(request, rejected)).errors?.[0]?.field ===
      'status',
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
  '3. cross-tenant and mismatched request/approval pairs fail',
  threw(() => authorizeAgentOriginExecution(request, otherTenantApproval)) instanceof
    ForbiddenError &&
    threw(() => authorizeAgentOriginExecution(request, otherApproval)) instanceof
      ValidationError &&
    threw(() => authorizeAgentOriginExecution(request, otherApproval)).errors?.[0]?.field ===
      'approval',
)

assert(
  '4. spoofed USER-origin request is rejected with ValidationError',
  spoofed instanceof ValidationError && spoofed.errors?.[0]?.field === 'origin',
)

assert(
  '5. no Native Activity persist, HTTP, auth, executor, or USER-path change',
  !existsSync(join(root, 'server/integrationsAgentOriginExecutionPlugin.js')) &&
    !executionSource.includes('getActivityRepository') &&
    !executionSource.includes('emitNativeActivityCreated') &&
    !executionSource.includes('createStudioActivity') &&
    !executionSource.includes('executeAutomationAction') &&
    !executionSource.includes('workflow/approvals') &&
    !executionSource.includes('knowledge/approvals') &&
    !executionSource.includes('models/approval') &&
    !executionSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !/\/api\//.test(executionSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(executionSource) &&
    authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
    !authoringSource.includes('authorizeAgentOriginExecution') &&
    !authoringSource.includes('makeAgentOriginActivityRequest'),
)

console.log('')
console.log(`H16.15 execution-boundary contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
