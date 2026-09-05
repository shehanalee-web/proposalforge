import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeProposal } from '../src/models/proposal.js'
import { analyzeProposalHealth } from '../src/insights/index.js'
import { analyzeProposal } from '../src/intelligence/index.js'
import { analyzeConsistency } from '../src/consistency/index.js'
import { analyzeProposalCoaching } from '../src/coach/index.js'
import { generateMockImprovement } from '../src/improve/providers/mock.js'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import {
  addComment,
  allWorkflowRecords,
  approve,
  assignReviewer,
  commentNavigation,
  createTask,
  createTaskFromFinding,
  DEFAULT_ACTOR_ID,
  DEFAULT_COMPANY_ID,
  getActivity,
  getWorkflow,
  getWorkflowStatusMeta,
  getWorkflowSummary,
  reopenComment,
  replaceWorkflowRecords,
  requestChanges,
  resetWorkflowStore,
  resolveComment,
  TASK_SOURCE,
  TASK_STATUS,
  transitionWorkflow,
  updateTask,
  WORKFLOW_CAPABILITIES,
  WORKFLOW_EVENT,
  WORKFLOW_ISOLATION_COMPANY_ID,
  WORKFLOW_STATUS,
} from '../src/workflow/index.js'
import { getWorkflowActor } from '../src/workflow/actors.js'

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

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

const studio = DEFAULT_COMPANY_ID
const other = WORKFLOW_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor(DEFAULT_ACTOR_ID)
const david = getWorkflowActor('user-studio-david')
const sam = getWorkflowActor('user-studio-sam')
const lee = getWorkflowActor('user-harborline-lee')

resetWorkflowStore()

const draft = getWorkflow({ companyId: studio, proposalId: 'prop-workflow-1', actor: sarah })
assert('Test 1 — Initial state', draft.status === WORKFLOW_STATUS.DRAFT)

const afterReview = transitionWorkflow({
  companyId: studio,
  proposalId: 'prop-workflow-1',
  actor: sarah,
  to: WORKFLOW_STATUS.IN_REVIEW,
})
assert('Test 2 — DRAFT → IN_REVIEW', afterReview.status === WORKFLOW_STATUS.IN_REVIEW)

assert(
  'Test 3 — Invalid DRAFT → ACCEPTED',
  throws(
    () =>
      transitionWorkflow({
        companyId: studio,
        proposalId: 'prop-workflow-new',
        actor: sarah,
        to: WORKFLOW_STATUS.ACCEPTED,
      }),
    ValidationError,
  ),
)

resetWorkflowStore()
getWorkflow({ companyId: studio, proposalId: 'prop-assign', actor: sarah })
const assigned = assignReviewer({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  reviewerId: david.id,
})
assert(
  'Test 4 — Assignment',
  assigned.reviewerIds.includes(david.id) && assigned.ownerId === sarah.id,
)

assert(
  'Test 5 — Viewer cannot approve',
  throws(
    () => approve({ companyId: studio, proposalId: 'prop-assign', actor: sam }),
    ForbiddenError,
  ),
)

assert(
  'Test 5b — Viewer cannot send for review',
  throws(
    () =>
      transitionWorkflow({
        companyId: studio,
        proposalId: 'prop-assign',
        actor: sam,
        to: WORKFLOW_STATUS.IN_REVIEW,
      }),
    ForbiddenError,
  ),
)

const commented = addComment({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  body: 'Needs a clearer timeline.',
})
const comment = commented.comment
const resolved = resolveComment({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  commentId: comment.id,
})
assert(
  'Test 6 — Create and resolve comment',
  resolved.comments.find((item) => item.id === comment.id)?.resolved === true,
)
const reopened = reopenComment({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  commentId: comment.id,
})
assert(
  'Test 6b — Reopen comment',
  reopened.comments.find((item) => item.id === comment.id)?.resolved === false,
)

const sectioned = addComment({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: david,
  body: 'Clarify what is included in this deliverable.',
  blockId: 'd1',
})
const sectionComment = sectioned.comment
assert('Test 7 — Section comments', sectionComment.blockId === 'd1')

const nav = commentNavigation(sectionComment)
assert(
  'Test 8 — Comment navigation',
  nav?.blockId === 'd1' && nav.selector === '[data-block-id="d1"]',
)

const tasked = createTask({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  title: 'Add project timeline',
  assigneeId: david.id,
})
const opened = tasked.task
const completed = updateTask({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  taskId: opened.id,
  changes: { status: TASK_STATUS.DONE },
})
assert(
  'Test 9 — Complete task',
  completed.tasks.find((item) => item.id === opened.id)?.status === TASK_STATUS.DONE,
)
const reopenedTask = updateTask({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  taskId: opened.id,
  changes: { status: TASK_STATUS.OPEN },
})
assert(
  'Test 9b — Reopen task',
  reopenedTask.tasks.find((item) => item.id === opened.id)?.status === TASK_STATUS.OPEN,
)

const fromHealth = createTaskFromFinding({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  source: TASK_SOURCE.HEALTH,
  finding: { id: 'find-timeline', code: 'missing_timeline', title: 'Missing Timeline' },
})
const fromConsistency = createTaskFromFinding({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  source: TASK_SOURCE.CONSISTENCY,
  finding: { id: 'cons-duration', title: 'Conflicting durations' },
})
const fromCoach = createTaskFromFinding({
  companyId: studio,
  proposalId: 'prop-assign',
  actor: sarah,
  source: TASK_SOURCE.COACH,
  finding: { id: 'coach-1', title: 'Clarify deliverables' },
})
assert(
  'Test 10 — Finding → task',
  fromHealth.task.source === TASK_SOURCE.HEALTH &&
    fromHealth.task.title === 'Missing Timeline',
)
assert(
  'Test 10b — Consistency / Coach sources',
  fromConsistency.task.source === TASK_SOURCE.CONSISTENCY &&
    fromCoach.task.source === TASK_SOURCE.COACH,
)

resetWorkflowStore()
getWorkflow({ companyId: studio, proposalId: 'prop-approve', actor: sarah })
assignReviewer({
  companyId: studio,
  proposalId: 'prop-approve',
  actor: sarah,
  reviewerId: david.id,
})
assignReviewer({
  companyId: studio,
  proposalId: 'prop-approve',
  actor: sarah,
  reviewerId: 'user-studio-alex',
})
transitionWorkflow({
  companyId: studio,
  proposalId: 'prop-approve',
  actor: sarah,
  to: WORKFLOW_STATUS.IN_REVIEW,
})
const afterDavid = approve({
  companyId: studio,
  proposalId: 'prop-approve',
  actor: david,
})
assert(
  'Test 11 — Partial approval stays in review',
  afterDavid.status === WORKFLOW_STATUS.IN_REVIEW,
)
assert(
  'Test 14 — Approval gate',
  throws(
    () =>
      transitionWorkflow({
        companyId: studio,
        proposalId: 'prop-approve',
        actor: david,
        to: WORKFLOW_STATUS.APPROVED,
      }),
    ValidationError,
  ),
)
const gated = (() => {
  try {
    transitionWorkflow({
      companyId: studio,
      proposalId: 'prop-approve',
      actor: david,
      to: WORKFLOW_STATUS.APPROVED,
    })
    return ''
  } catch (error) {
    return error.message
  }
})()
assert(
  'Test 14b — Gate explains pending reviewers',
  gated.includes('Approval blocked') && gated.includes('pending'),
)

const bothApproved = approve({
  companyId: studio,
  proposalId: 'prop-approve',
  actor: getWorkflowActor('user-studio-alex'),
})
assert('Test 11b — All reviewers approve', bothApproved.status === WORKFLOW_STATUS.APPROVED)

resetWorkflowStore()
getWorkflow({ companyId: studio, proposalId: 'prop-changes', actor: sarah })
assignReviewer({
  companyId: studio,
  proposalId: 'prop-changes',
  actor: sarah,
  reviewerId: david.id,
})
transitionWorkflow({
  companyId: studio,
  proposalId: 'prop-changes',
  actor: sarah,
  to: WORKFLOW_STATUS.IN_REVIEW,
})
const changed = requestChanges({
  companyId: studio,
  proposalId: 'prop-changes',
  actor: david,
  note: 'Please add a timeline.',
})
assert(
  'Test 12 — Request changes',
  changed.status === WORKFLOW_STATUS.CHANGES_REQUESTED &&
    changed.activity.some((item) => item.type === WORKFLOW_EVENT.CHANGES_REQUESTED),
)

const resubmitted = transitionWorkflow({
  companyId: studio,
  proposalId: 'prop-changes',
  actor: sarah,
  to: WORKFLOW_STATUS.IN_REVIEW,
})
assert(
  'Test 13 — Resubmit',
  resubmitted.status === WORKFLOW_STATUS.IN_REVIEW &&
    resubmitted.activity.some((item) => item.type === WORKFLOW_EVENT.RESUBMITTED),
)

resetWorkflowStore()
getWorkflow({ companyId: studio, proposalId: 'prop-ready', actor: sarah })
assignReviewer({
  companyId: studio,
  proposalId: 'prop-ready',
  actor: sarah,
  reviewerId: david.id,
})
transitionWorkflow({
  companyId: studio,
  proposalId: 'prop-ready',
  actor: sarah,
  to: WORKFLOW_STATUS.IN_REVIEW,
})
approve({ companyId: studio, proposalId: 'prop-ready', actor: david })
const ready = transitionWorkflow({
  companyId: studio,
  proposalId: 'prop-ready',
  actor: sarah,
  to: WORKFLOW_STATUS.READY_TO_SEND,
})
assert('Test 15 — Approved → Ready', ready.status === WORKFLOW_STATUS.READY_TO_SEND)

resetWorkflowStore()
const studioWf = getWorkflow({
  companyId: studio,
  proposalId: 'prop-iso',
  actor: sarah,
})
addComment({
  companyId: studio,
  proposalId: 'prop-iso',
  actor: sarah,
  body: 'Studio only',
})
assert(
  'Test 16 — Cross-company actor blocked',
  throws(
    () => getWorkflow({ companyId: studio, proposalId: 'prop-iso', actor: lee }),
    ForbiddenError,
  ),
)
const harbor = getWorkflow({
  companyId: other,
  proposalId: 'prop-iso',
  actor: lee,
})
assert(
  'Test 16b — Company isolation',
  harbor.comments.length === 0 &&
    harbor.companyId === other &&
    studioWf.companyId === studio,
)

const events = getActivity({ companyId: studio, proposalId: 'prop-iso', actor: sarah })
assert(
  'Test 17 — Activity',
  events.some((item) => item.type === WORKFLOW_EVENT.COMMENT_ADDED) &&
    events.every((item) => item.companyId === studio && item.proposalId === 'prop-iso'),
)

const summary = getWorkflowSummary({
  proposal: { id: 'prop-iso', title: 'Demo' },
  workflow: getWorkflow({ companyId: studio, proposalId: 'prop-iso', actor: sarah }),
  health: { overallScore: 84 },
  intelligence: { readiness: { label: 'Minor Improvements Recommended' } },
  consistency: { score: 96 },
  coach: { items: [{ id: 'c1' }] },
})
assert(
  'Test 18 — Summary assembles existing values',
  summary.healthScore === 84 &&
    summary.consistencyScore === 96 &&
    summary.readiness === 'Minor Improvements Recommended' &&
    summary.coachItems === 1,
)

const proposal = makeProposal({ title: 'Workflow analysis check', clientName: 'Harborline' })
const health = analyzeProposalHealth(proposal)
const intelligence = analyzeProposal({
  proposal,
  diagnostics: health.suggestions,
  health,
})
const consistency = analyzeConsistency({ proposal, health, diagnostics: health.suggestions })
const coach = analyzeProposalCoaching({
  proposal,
  health,
  diagnostics: health.suggestions,
  intelligence,
  consistency,
})
const mockImprove = generateMockImprovement({
  finding: health.suggestions[0] || health.warnings[0] || { code: 'weak_summary' },
  proposal,
})
const domainSource = [
  'src/workflow/repository.js',
  'src/workflow/summary.js',
  'src/workflow/transitions.js',
  'src/workflow/permissions.js',
]
  .map((file) => sourceOf(file))
  .join('\n')
assert(
  'Test 19 — Existing proposal analysis',
  Number.isFinite(health.overallScore) &&
    intelligence &&
    Number.isFinite(consistency.score) &&
    Array.isArray(coach.items) &&
    mockImprove &&
    !domainSource.includes("from '../insights") &&
    !domainSource.includes("from '../intelligence") &&
    !domainSource.includes("from '../improve"),
)

const snapshot = allWorkflowRecords()
resetWorkflowStore([])
replaceWorkflowRecords(snapshot)
const reloaded = getWorkflow({ companyId: studio, proposalId: 'prop-iso', actor: sarah, create: false })
assert(
  'Test 20 — Persistence',
  reloaded.comments.some((item) => item.body === 'Studio only'),
)

const panelCss = sourceOf('src/components/Workflow/WorkflowPanel.module.css')
const stripCss = sourceOf('src/components/Workflow/WorkflowStrip.module.css')
assert(
  'Test 21 — Mobile overflow guards',
  panelCss.includes('overflow-x: hidden') &&
    panelCss.includes('100vw') &&
    panelCss.includes('390px') &&
    stripCss.includes('min-width: 0'),
)

assert(
  'Test 22 — Unauthorized comment',
  throws(
    () =>
      addComment({
        companyId: studio,
        proposalId: 'prop-iso',
        actor: sam,
        body: 'Nope',
      }),
    ForbiddenError,
  ),
)

const pluginSource = sourceOf('server/workflowPlugin.js')
const repoSource = sourceOf('src/workflow/repository.js')
const eventSource = sourceOf('src/workflow/events.js')
assert(
  'Test 23 — No client messaging',
  !pluginSource.includes('whatsapp') &&
    !pluginSource.includes('nodemailer') &&
    !repoSource.includes('sendMail') &&
    !repoSource.includes('whatsapp') &&
    eventSource.includes('emitWorkflowEvent') &&
    WORKFLOW_CAPABILITIES.emailDelivery === false &&
    WORKFLOW_CAPABILITIES.whatsapp === false &&
    WORKFLOW_CAPABILITIES.clientPortal === false &&
    WORKFLOW_CAPABILITIES.digitalSignature === false &&
    WORKFLOW_CAPABILITIES.crm === false,
)

const meta = getWorkflowStatusMeta(WORKFLOW_STATUS.IN_REVIEW)
assert(
  'Status meta is centralized',
  meta.label === 'In Review' && Array.isArray(meta.allowedActions),
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
