import { ForbiddenError, NotFoundError, ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { getWorkflowActor, resolveWorkflowActor } from './actors.js'
import { appendActivity } from './activity.js'
import {
  assignOwner as setOwner,
  assignReviewer as addReviewerId,
  assignSupporting as addAssigneeId,
  removeReviewer as dropReviewer,
} from './assignments.js'
import { canBecomeApproved, getApprovalBlockers } from './approvals.js'
import { emitWorkflowEvent } from './events.js'
import { commentNavigation } from './navigation.js'
import {
  canApprove,
  canAssign,
  canComment,
  canCreateTask,
  canDeleteComment,
  canRequestChanges,
  canTransition,
} from './permissions.js'
import {
  emptyWorkflow,
  makeWorkflowApproval,
  makeWorkflowComment,
  makeWorkflowRecord,
  makeWorkflowTask,
  validateCommentBody,
  validateTaskTitle,
} from './schema.js'
import {
  findWorkflowByProposal,
  insertWorkflowRecord,
  replaceWorkflowRecord,
  listWorkflowsForCompany,
} from './store.js'
import { assertTransition } from './transitions.js'
import { findingTaskFields } from './tasks.js'
import {
  APPROVAL_STATUS,
  TASK_SOURCE,
  TASK_STATUS,
  WORKFLOW_EVENT,
  WORKFLOW_STATUS,
} from './types.js'

function scopedCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function actorOf(input) {
  return resolveWorkflowActor(input)
}

function assertCompanyActor(actor, companyId) {
  if (actor.companyId !== companyId) {
    throw new ForbiddenError('You cannot access another company workspace.')
  }
}

function stamp(workflow) {
  return { ...workflow, updatedAt: new Date().toISOString() }
}

function save(workflow) {
  const next = makeWorkflowRecord(stamp(workflow))
  const existing = findWorkflowByProposal(next.companyId, next.proposalId)
  if (existing) replaceWorkflowRecord(existing.id, { ...next, id: existing.id })
  else insertWorkflowRecord(next)
  return makeWorkflowRecord(findWorkflowByProposal(next.companyId, next.proposalId))
}

function recordEvent(workflow, actor, type, payload = {}) {
  const { workflow: next, event } = appendActivity(workflow, {
    type,
    actorId: actor.id,
    actorName: actor.name,
    payload,
    from: payload.from ?? null,
    to: payload.to ?? null,
  })
  emitWorkflowEvent(event)
  return next
}

function ensureApprovals(workflow) {
  const existing = new Map((workflow.approvals ?? []).map((item) => [item.reviewerId, item]))
  const approvals = (workflow.reviewerIds ?? []).map((reviewerId) => {
    const current = existing.get(reviewerId)
    if (current) return current
    return makeWorkflowApproval({
      proposalId: workflow.proposalId,
      reviewerId,
      status: APPROVAL_STATUS.PENDING,
    })
  })
  return { ...workflow, approvals }
}

function resetApprovalsForResubmit(workflow) {
  return {
    ...workflow,
    approvals: (workflow.approvals ?? []).map((item) =>
      makeWorkflowApproval({
        ...item,
        status: APPROVAL_STATUS.PENDING,
        note: '',
        updatedAt: new Date().toISOString(),
      }),
    ),
  }
}

function applyStatus(workflow, actor, to, extraType) {
  const from = workflow.status
  assertTransition(from, to)
  if (!canTransition(actor, workflow, from, to)) {
    throw new ForbiddenError('You do not have permission to change this workflow status.')
  }
  if (to === WORKFLOW_STATUS.APPROVED && !canBecomeApproved(workflow)) {
    throw new ValidationError(getApprovalBlockers(workflow).message, [
      { field: 'status', message: getApprovalBlockers(workflow).message },
    ])
  }

  let next = { ...workflow, status: to }
  next = recordEvent(next, actor, WORKFLOW_EVENT.STATUS_CHANGED, { from, to })
  if (extraType) next = recordEvent(next, actor, extraType, { from, to })
  return next
}

export function getWorkflow({ companyId, proposalId, actor, create = true } = {}) {
  const scoped = scopedCompany(companyId)
  const pid = String(proposalId ?? '').trim()
  if (!pid) {
    throw new ValidationError('A proposal id is required.', [
      { field: 'proposalId', message: 'proposalId is required.' },
    ])
  }
  const user = actorOf(actor)
  assertCompanyActor(user, scoped)

  const found = findWorkflowByProposal(scoped, pid)
  if (found) return found
  if (!create) {
    throw new NotFoundError('Workflow not found.')
  }
  return save(emptyWorkflow({ companyId: scoped, proposalId: pid, ownerId: user.id }))
}

export function listWorkflows({ companyId, proposalIds } = {}) {
  const scoped = scopedCompany(companyId)
  const all = listWorkflowsForCompany(scoped)
  if (!proposalIds?.length) return all
  const wanted = new Set(proposalIds.map(String))
  return all.filter((item) => wanted.has(item.proposalId))
}

export function transitionWorkflow({ companyId, proposalId, actor, to, note } = {}) {
  const user = actorOf(actor)
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  const extra =
    to === WORKFLOW_STATUS.IN_REVIEW && workflow.status === WORKFLOW_STATUS.CHANGES_REQUESTED
      ? WORKFLOW_EVENT.RESUBMITTED
      : to === WORKFLOW_STATUS.IN_REVIEW
        ? WORKFLOW_EVENT.REVIEW_REQUESTED
        : to === WORKFLOW_STATUS.READY_TO_SEND
          ? WORKFLOW_EVENT.READY_TO_SEND
          : to === WORKFLOW_STATUS.SENT
            ? WORKFLOW_EVENT.SENT
            : to === WORKFLOW_STATUS.VIEWED
              ? WORKFLOW_EVENT.VIEWED
              : to === WORKFLOW_STATUS.ACCEPTED
                ? WORKFLOW_EVENT.ACCEPTED
                : to === WORKFLOW_STATUS.REJECTED
                  ? WORKFLOW_EVENT.REJECTED
                  : to === WORKFLOW_STATUS.EXPIRED
                    ? WORKFLOW_EVENT.EXPIRED
                    : to === WORKFLOW_STATUS.CHANGES_REQUESTED
                      ? WORKFLOW_EVENT.CHANGES_REQUESTED
                      : to === WORKFLOW_STATUS.APPROVED
                        ? WORKFLOW_EVENT.APPROVED
                        : null

  if (to === WORKFLOW_STATUS.IN_REVIEW) {
    workflow = ensureApprovals(workflow)
    if (workflow.status === WORKFLOW_STATUS.CHANGES_REQUESTED) {
      workflow = resetApprovalsForResubmit(workflow)
    }
    workflow = recordEvent(workflow, user, WORKFLOW_EVENT.APPROVAL_REQUESTED, {
      reviewerIds: workflow.reviewerIds,
    })
  }

  if (to === WORKFLOW_STATUS.CHANGES_REQUESTED && note) {
    workflow = {
      ...workflow,
      comments: [
        ...workflow.comments,
        makeWorkflowComment({
          proposalId: workflow.proposalId,
          authorId: user.id,
          authorName: user.name,
          body: note,
          required: true,
        }),
      ],
    }
  }

  return save(applyStatus(workflow, user, to, extra))
}

export function assignOwner({ companyId, proposalId, actor, ownerId } = {}) {
  const user = actorOf(actor)
  if (!canAssign(user)) throw new ForbiddenError('You cannot assign workflow owners.')
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  const nextOwner = String(ownerId ?? '').trim()
  if (!nextOwner) {
    throw new ValidationError('An owner is required.', [
      { field: 'ownerId', message: 'ownerId is required.' },
    ])
  }
  workflow = setOwner(workflow, nextOwner)
  workflow = recordEvent(workflow, user, WORKFLOW_EVENT.OWNER_ASSIGNED, {
    ownerId: nextOwner,
    ownerName: getWorkflowActor(nextOwner)?.name ?? nextOwner,
  })
  return save(workflow)
}

export function assignReviewer({ companyId, proposalId, actor, reviewerId } = {}) {
  const user = actorOf(actor)
  if (!canAssign(user)) throw new ForbiddenError('You cannot assign reviewers.')
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  const nextId = String(reviewerId ?? '').trim()
  if (!nextId) {
    throw new ValidationError('A reviewer is required.', [
      { field: 'reviewerId', message: 'reviewerId is required.' },
    ])
  }
  workflow = addReviewerId(workflow, nextId)
  if (workflow.status === WORKFLOW_STATUS.IN_REVIEW) {
    workflow = ensureApprovals(workflow)
  }
  workflow = recordEvent(workflow, user, WORKFLOW_EVENT.REVIEWER_ASSIGNED, {
    reviewerId: nextId,
    reviewerName: getWorkflowActor(nextId)?.name ?? nextId,
  })
  return save(workflow)
}

export function removeReviewer({ companyId, proposalId, actor, reviewerId } = {}) {
  const user = actorOf(actor)
  if (!canAssign(user)) throw new ForbiddenError('You cannot change reviewers.')
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  workflow = dropReviewer(workflow, String(reviewerId ?? '').trim())
  workflow = recordEvent(workflow, user, WORKFLOW_EVENT.REVIEWER_REMOVED, {
    reviewerId,
  })
  return save(workflow)
}

export function assignSupporting({ companyId, proposalId, actor, assigneeId } = {}) {
  const user = actorOf(actor)
  if (!canAssign(user)) throw new ForbiddenError('You cannot assign people.')
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  workflow = addAssigneeId(workflow, String(assigneeId ?? '').trim())
  return save(workflow)
}

export function addComment({ companyId, proposalId, actor, body, blockId, required } = {}) {
  const user = actorOf(actor)
  if (!canComment(user)) throw new ForbiddenError('You cannot comment on this proposal.')
  const workflow = getWorkflow({ companyId, proposalId, actor: user })
  const comment = makeWorkflowComment({
    proposalId: workflow.proposalId,
    authorId: user.id,
    authorName: user.name,
    body: validateCommentBody(body),
    blockId,
    required: Boolean(required),
  })
  let next = { ...workflow, comments: [...workflow.comments, comment] }
  next = recordEvent(next, user, WORKFLOW_EVENT.COMMENT_ADDED, {
    commentId: comment.id,
    blockId: comment.blockId,
  })
  const saved = save(next)
  return { workflow: saved, comment }
}

export function resolveComment({ companyId, proposalId, actor, commentId } = {}) {
  const user = actorOf(actor)
  if (!canComment(user)) throw new ForbiddenError('You cannot resolve comments.')
  const workflow = getWorkflow({ companyId, proposalId, actor: user })
  const index = workflow.comments.findIndex((item) => item.id === commentId)
  if (index === -1) throw new NotFoundError('Comment not found.')
  const comments = [...workflow.comments]
  comments[index] = {
    ...comments[index],
    resolved: true,
    resolvedAt: new Date().toISOString(),
    resolvedBy: user.id,
  }
  let next = { ...workflow, comments }
  next = recordEvent(next, user, WORKFLOW_EVENT.COMMENT_RESOLVED, { commentId })
  return save(next)
}

export function reopenComment({ companyId, proposalId, actor, commentId } = {}) {
  const user = actorOf(actor)
  if (!canComment(user)) throw new ForbiddenError('You cannot reopen comments.')
  const workflow = getWorkflow({ companyId, proposalId, actor: user })
  const index = workflow.comments.findIndex((item) => item.id === commentId)
  if (index === -1) throw new NotFoundError('Comment not found.')
  const comments = [...workflow.comments]
  comments[index] = {
    ...comments[index],
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  }
  let next = { ...workflow, comments }
  next = recordEvent(next, user, WORKFLOW_EVENT.COMMENT_REOPENED, { commentId })
  return save(next)
}

export function deleteComment({ companyId, proposalId, actor, commentId } = {}) {
  const user = actorOf(actor)
  const workflow = getWorkflow({ companyId, proposalId, actor: user })
  const comment = workflow.comments.find((item) => item.id === commentId)
  if (!comment) throw new NotFoundError('Comment not found.')
  if (!canDeleteComment(user, comment)) {
    throw new ForbiddenError('You can only delete your own comments.')
  }
  let next = {
    ...workflow,
    comments: workflow.comments.filter((item) => item.id !== commentId),
  }
  next = recordEvent(next, user, WORKFLOW_EVENT.COMMENT_DELETED, { commentId })
  return save(next)
}

export function createTask({
  companyId,
  proposalId,
  actor,
  title,
  description,
  assigneeId,
  dueAt,
  source,
  sourceId,
  status,
} = {}) {
  const user = actorOf(actor)
  if (!canCreateTask(user)) throw new ForbiddenError('You cannot create workflow tasks.')
  const workflow = getWorkflow({ companyId, proposalId, actor: user })
  const task = makeWorkflowTask({
    proposalId: workflow.proposalId,
    title: validateTaskTitle(title),
    description,
    assigneeId,
    createdBy: user.id,
    dueAt,
    source: source || TASK_SOURCE.MANUAL,
    sourceId,
    status: status || TASK_STATUS.OPEN,
  })
  let next = { ...workflow, tasks: [...workflow.tasks, task] }
  next = recordEvent(next, user, WORKFLOW_EVENT.TASK_CREATED, {
    taskId: task.id,
    source: task.source,
    title: task.title,
  })
  if (task.assigneeId) {
    next = recordEvent(next, user, WORKFLOW_EVENT.TASK_ASSIGNED, {
      taskId: task.id,
      assigneeId: task.assigneeId,
    })
  }
  const saved = save(next)
  return { workflow: saved, task: saved.tasks.find((item) => item.id === task.id) }
}

export function createTaskFromFinding({ companyId, proposalId, actor, finding, source } = {}) {
  const fields = findingTaskFields(finding, source || TASK_SOURCE.MANUAL)
  return createTask({
    companyId,
    proposalId,
    actor,
    title: fields.title,
    description: fields.description,
    source: fields.source,
    sourceId: fields.sourceId,
  })
}

export function updateTask({ companyId, proposalId, actor, taskId, changes = {} } = {}) {
  const user = actorOf(actor)
  if (!canCreateTask(user)) throw new ForbiddenError('You cannot update workflow tasks.')
  const workflow = getWorkflow({ companyId, proposalId, actor: user })
  const index = workflow.tasks.findIndex((item) => item.id === taskId)
  if (index === -1) throw new NotFoundError('Task not found.')
  const previous = workflow.tasks[index]
  const status = changes.status ?? previous.status
  const completedAt =
    status === TASK_STATUS.DONE
      ? previous.completedAt || new Date().toISOString()
      : status === TASK_STATUS.OPEN || status === TASK_STATUS.IN_PROGRESS
        ? null
        : previous.completedAt
  const task = makeWorkflowTask({
    ...previous,
    ...changes,
    status,
    completedAt,
    title: changes.title != null ? validateTaskTitle(changes.title) : previous.title,
  })
  const tasks = [...workflow.tasks]
  tasks[index] = task
  let next = { ...workflow, tasks }
  if (previous.status !== task.status && task.status === TASK_STATUS.DONE) {
    next = recordEvent(next, user, WORKFLOW_EVENT.TASK_COMPLETED, { taskId })
  } else if (previous.status === TASK_STATUS.DONE && task.status !== TASK_STATUS.DONE) {
    next = recordEvent(next, user, WORKFLOW_EVENT.TASK_REOPENED, { taskId })
  } else if (previous.assigneeId !== task.assigneeId && task.assigneeId) {
    next = recordEvent(next, user, WORKFLOW_EVENT.TASK_ASSIGNED, {
      taskId,
      assigneeId: task.assigneeId,
    })
  } else {
    next = recordEvent(next, user, WORKFLOW_EVENT.TASK_UPDATED, { taskId })
  }
  return save(next)
}

export function approve({ companyId, proposalId, actor, note } = {}) {
  const user = actorOf(actor)
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  if (!canApprove(user, workflow)) {
    throw new ForbiddenError('You cannot approve this proposal.')
  }
  workflow = ensureApprovals(workflow)
  const index = workflow.approvals.findIndex((item) => item.reviewerId === user.id)
  if (index === -1) {
    throw new ForbiddenError('You are not an assigned reviewer.')
  }
  const approvals = [...workflow.approvals]
  approvals[index] = makeWorkflowApproval({
    ...approvals[index],
    status: APPROVAL_STATUS.APPROVED,
    note: note ?? approvals[index].note,
    updatedAt: new Date().toISOString(),
  })
  workflow = { ...workflow, approvals }
  workflow = recordEvent(workflow, user, WORKFLOW_EVENT.APPROVED, {
    reviewerId: user.id,
    note: note || '',
  })
  if (canBecomeApproved(workflow) && workflow.status === WORKFLOW_STATUS.IN_REVIEW) {
    workflow = applyStatus(workflow, user, WORKFLOW_STATUS.APPROVED, null)
  }
  return save(workflow)
}

export function requestChanges({ companyId, proposalId, actor, note, blockId } = {}) {
  const user = actorOf(actor)
  let workflow = getWorkflow({ companyId, proposalId, actor: user })
  if (!canRequestChanges(user, workflow)) {
    throw new ForbiddenError('You cannot request changes on this proposal.')
  }
  if (note) {
    workflow = {
      ...workflow,
      comments: [
        ...workflow.comments,
        makeWorkflowComment({
          proposalId: workflow.proposalId,
          authorId: user.id,
          authorName: user.name,
          body: validateCommentBody(note),
          blockId,
          required: true,
        }),
      ],
    }
  }
  if (workflow.status === WORKFLOW_STATUS.IN_REVIEW) {
    workflow = ensureApprovals(workflow)
    const index = workflow.approvals.findIndex((item) => item.reviewerId === user.id)
    if (index !== -1) {
      const approvals = [...workflow.approvals]
      approvals[index] = makeWorkflowApproval({
        ...approvals[index],
        status: APPROVAL_STATUS.CHANGES_REQUESTED,
        note: note ?? '',
        updatedAt: new Date().toISOString(),
      })
      workflow = { ...workflow, approvals }
    }
  }
  return save(
    applyStatus(workflow, user, WORKFLOW_STATUS.CHANGES_REQUESTED, WORKFLOW_EVENT.CHANGES_REQUESTED),
  )
}

export function getActivity({ companyId, proposalId, actor } = {}) {
  const workflow = getWorkflow({ companyId, proposalId, actor })
  return workflow.activity ?? []
}

export function getCompanyWorkflowOverview({ companyId } = {}) {
  const items = listWorkflows({ companyId })
  const count = (status) => items.filter((item) => item.status === status).length
  let overdue = 0
  for (const item of items) {
    overdue += (item.tasks ?? []).filter((task) => {
      if (!task.dueAt) return false
      if (task.status === TASK_STATUS.DONE || task.status === TASK_STATUS.CANCELLED) return false
      return new Date(task.dueAt).getTime() < Date.now()
    }).length
  }
  return {
    awaitingReview: count(WORKFLOW_STATUS.IN_REVIEW),
    changesRequested: count(WORKFLOW_STATUS.CHANGES_REQUESTED),
    readyToSend: count(WORKFLOW_STATUS.READY_TO_SEND),
    sent: count(WORKFLOW_STATUS.SENT),
    accepted: count(WORKFLOW_STATUS.ACCEPTED),
    rejected: count(WORKFLOW_STATUS.REJECTED),
    overdueTasks: overdue,
  }
}

export { getApprovalBlockers, commentNavigation, canBecomeApproved }
