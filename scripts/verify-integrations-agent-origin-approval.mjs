/**
 * H16.15 Slice 15.2 — Agent-origin approval-gate contract.
 * Focused lifecycle checks. Does not nest other verifiers.
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
  AGENT_ORIGIN_APPROVAL_STATUS,
  AGENT_ORIGIN_APPROVAL_STATUSES,
  AUTOMATION_ACTION_INTENT_STATUS,
  approveAgentOriginApproval,
  cloneAgentOriginApproval,
  makeAgentOriginActivityRequest,
  makeAgentOriginApproval,
  makeStudioPrincipal,
  rejectAgentOriginApproval,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const approvalSource = readFileSync(
  join(root, 'src/integrations/activities/agentOriginApproval.js'),
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
const approver = makeStudioPrincipal({
  id: 'user-studio-sarah',
  kind: ACTIVITY_ACTOR_KIND.USER,
  displayName: 'Sarah',
  companyId: DEFAULT_COMPANY_ID,
})

const pending = makeAgentOriginApproval({
  id: 'aoa-gate-1',
  request,
  approver,
})
assert(
  '1. pending record is company-scoped and linked to the agent-origin request',
  pending.status === AGENT_ORIGIN_APPROVAL_STATUS.PENDING &&
    pending.companyId === DEFAULT_COMPANY_ID &&
    pending.request.origin === ACTIVITY_ORIGIN.AGENT &&
    pending.request.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    pending.request.companyId === pending.companyId &&
    pending.approver.kind === ACTIVITY_ACTOR_KIND.USER &&
    pending.approver.companyId === pending.companyId &&
    pending.decidedAt === null &&
    !Object.prototype.hasOwnProperty.call(pending, 'activityId') &&
    JSON.stringify(cloneAgentOriginApproval(pending)) === JSON.stringify(pending),
)

const approved = approveAgentOriginApproval(pending, approver)
assert(
  '2. pending → approved stamps the Studio Principal and does not create a Native Activity',
  approved.status === AGENT_ORIGIN_APPROVAL_STATUS.APPROVED &&
    approved.id === pending.id &&
    approved.approver.id === approver.id &&
    approved.approver.kind === ACTIVITY_ACTOR_KIND.USER &&
    typeof approved.decidedAt === 'string' &&
    approved.request.origin === ACTIVITY_ORIGIN.AGENT &&
    !Object.prototype.hasOwnProperty.call(approved, 'activityId'),
)

const rejected = rejectAgentOriginApproval(pending, approver)
assert(
  '3. pending → rejected is a terminal gate state',
  rejected.status === AGENT_ORIGIN_APPROVAL_STATUS.REJECTED &&
    rejected.id === pending.id &&
    rejected.approver.kind === ACTIVITY_ACTOR_KIND.USER &&
    rejected.decidedAt !== null,
)

const agentApprover = threw(() =>
  makeAgentOriginApproval({
    request,
    approver: {
      id: request.actor.id,
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: request.actor.displayName,
      companyId: request.companyId,
    },
  }),
)
assert(
  '4. approver cannot be an agent; Studio Principal remains USER-only',
  agentApprover instanceof ValidationError && agentApprover.errors?.[0]?.field === 'kind',
)

const crossTenant = threw(() =>
  makeAgentOriginApproval({
    request,
    approver: {
      id: 'user-harborline-lee',
      kind: ACTIVITY_ACTOR_KIND.USER,
      displayName: 'Lee',
      companyId: WORKFLOW_ISOLATION_COMPANY_ID,
    },
  }),
)
const missingApprover = threw(() => makeAgentOriginApproval({ request }))
const recordedStatus = threw(() =>
  makeAgentOriginApproval({
    request,
    approver,
    status: AUTOMATION_ACTION_INTENT_STATUS.RECORDED,
  }),
)
const reapprove = threw(() => approveAgentOriginApproval(approved, approver))
assert(
  '5. invalid tenant, approver, and state combinations fail',
  crossTenant instanceof ForbiddenError &&
    missingApprover instanceof ValidationError &&
    missingApprover.errors?.[0]?.field === 'approver' &&
    recordedStatus instanceof ValidationError &&
    recordedStatus.errors?.[0]?.field === 'status' &&
    reapprove instanceof ValidationError &&
    reapprove.errors?.[0]?.field === 'status' &&
    AGENT_ORIGIN_APPROVAL_STATUSES.join(',') === 'pending,approved,rejected',
)

assert(
  '6. no Native Activity persist, HTTP, auth, or reused approval stores',
  !existsSync(join(root, 'server/integrationsAgentOriginApprovalPlugin.js')) &&
    !approvalSource.includes('getActivityRepository') &&
    !approvalSource.includes('emitNativeActivityCreated') &&
    !approvalSource.includes('createStudioActivity') &&
    !approvalSource.includes('workflow/approvals') &&
    !approvalSource.includes('knowledge/approvals') &&
    !approvalSource.includes('models/approval') &&
    !approvalSource.includes('AUTOMATION_ACTION_INTENT_STATUS') &&
    !/\/api\//.test(approvalSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(approvalSource) &&
    authoringSource.includes('origin: ACTIVITY_ORIGIN.USER'),
)

console.log('')
console.log(`H16.15 approval-gate contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
