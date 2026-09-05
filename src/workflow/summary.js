import { getWorkflowActor } from './actors.js'
import { getApprovalBlockers, pendingApprovals } from './approvals.js'
import { openComments } from './comments.js'
import { getWorkflowStatusMeta } from './statuses.js'
import { openTasks, overdueTasks } from './tasks.js'
import { WORKFLOW_STATUS } from './types.js'

function nameOf(id) {
  return getWorkflowActor(id)?.name || id || '—'
}

function namesOf(ids = []) {
  return ids.map(nameOf).filter(Boolean)
}

function nextActionFor(workflow) {
  const status = workflow?.status
  const meta = getWorkflowStatusMeta(status)
  const pending = pendingApprovals(workflow)
  const pendingNames = pending
    .map((item) => nameOf(item.reviewerId))
    .filter(Boolean)

  if (status === WORKFLOW_STATUS.IN_REVIEW) {
    if (pendingNames.length) {
      return `Awaiting approval from ${pendingNames[0]}`
    }
    if ((workflow.reviewerIds ?? []).length) {
      return `Awaiting review from ${nameOf(workflow.reviewerIds[0])}`
    }
    return 'Assign a reviewer'
  }
  if (status === WORKFLOW_STATUS.CHANGES_REQUESTED) {
    const last = [...(workflow.activity ?? [])]
      .reverse()
      .find((item) => item.type === 'workflow.changes_requested')
    const who = last?.actorName
    return who ? `Changes requested by ${who}` : 'Resubmit after edits'
  }
  if (status === WORKFLOW_STATUS.APPROVED) {
    const last = [...(workflow.activity ?? [])]
      .reverse()
      .find((item) => item.type === 'workflow.approved')
    const who = last?.actorName
    return who ? `Approved by ${who}` : meta.description
  }
  if (status === WORKFLOW_STATUS.DRAFT) return 'Send for review'
  if (status === WORKFLOW_STATUS.READY_TO_SEND) return 'Mark sent when delivery is ready'
  return meta.description
}

function waitingFor(workflow) {
  if (workflow?.status === WORKFLOW_STATUS.IN_REVIEW) {
    const pending = pendingApprovals(workflow)
    if (pending[0]) return nameOf(pending[0].reviewerId)
    if (workflow.reviewerIds?.[0]) return nameOf(workflow.reviewerIds[0])
  }
  if (workflow?.status === WORKFLOW_STATUS.CHANGES_REQUESTED) {
    return nameOf(workflow.ownerId)
  }
  return ''
}

/**
 * Assemble existing analysis values. Does not recalculate Health,
 * Intelligence, Consistency, or Coach.
 */
export function getWorkflowSummary({
  proposal,
  workflow,
  health,
  intelligence,
  consistency,
  coach,
} = {}) {
  const status = workflow?.status ?? WORKFLOW_STATUS.DRAFT
  const meta = getWorkflowStatusMeta(status)
  const commentsOpen = openComments(workflow).length
  const tasksOpen = openTasks(workflow).length
  const overdue = overdueTasks(workflow).length
  const blockers = getApprovalBlockers(workflow)

  const healthScore =
    health?.overallScore ?? health?.score ?? intelligence?.summary?.healthScore ?? null
  const consistencyScore = consistency?.score ?? consistency?.summary?.score ?? null
  const readiness =
    intelligence?.readiness?.label ??
    intelligence?.summary?.readinessLabel ??
    intelligence?.readinessLabel ??
    null
  const coachCount = Array.isArray(coach?.items)
    ? coach.items.length
    : Array.isArray(coach)
      ? coach.length
      : 0

  return {
    proposalId: workflow?.proposalId ?? proposal?.id ?? '',
    title: proposal?.title ?? '',
    status,
    statusLabel: meta.label,
    statusDescription: meta.description,
    tone: meta.tone,
    ownerId: workflow?.ownerId ?? null,
    ownerName: nameOf(workflow?.ownerId),
    reviewerIds: workflow?.reviewerIds ?? [],
    reviewerNames: namesOf(workflow?.reviewerIds),
    pendingApprovals: blockers.pendingReviewerIds.length,
    openComments: commentsOpen,
    openTasks: tasksOpen,
    overdueTasks: overdue,
    nextAction: nextActionFor(workflow),
    waitingFor: waitingFor(workflow),
    healthScore,
    consistencyScore,
    readiness,
    coachItems: coachCount,
    approvalBlocked: blockers.blocked,
    approvalMessage: blockers.message,
  }
}
