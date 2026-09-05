import { createRecordId } from '../models/ids.js'
import { ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { DEFAULT_ACTOR_ID } from './actors.js'
import {
  APPROVAL_STATUS,
  APPROVAL_STATUSES,
  TASK_SOURCE,
  TASK_SOURCES,
  TASK_STATUS,
  TASK_STATUSES,
  WORKFLOW_EVENT,
  WORKFLOW_EVENTS,
  WORKFLOW_STATUS,
  WORKFLOW_STATUSES,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asIso(value, fallback = null) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

function asIdList(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const next = []
  for (const item of value) {
    const id = asString(item).trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}

export function makeWorkflowEvent(input = {}) {
  const type = WORKFLOW_EVENTS.includes(input.type) ? input.type : WORKFLOW_EVENT.STATUS_CHANGED
  const payload =
    input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
      ? { ...input.payload }
      : {}
  return {
    id: asString(input.id).trim() || createRecordId('wfev'),
    proposalId: asString(input.proposalId).trim(),
    companyId: asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    actorId: asString(input.actorId).trim(),
    actorName: asString(input.actorName).trim(),
    type,
    payload,
    from: input.from ?? payload.from ?? null,
    to: input.to ?? payload.to ?? null,
    createdAt: asIso(input.createdAt, nowIso()),
  }
}

export function makeWorkflowComment(input = {}) {
  return {
    id: asString(input.id).trim() || createRecordId('wfcm'),
    proposalId: asString(input.proposalId).trim(),
    authorId: asString(input.authorId).trim(),
    authorName: asString(input.authorName).trim(),
    body: asString(input.body).trim(),
    blockId: asString(input.blockId).trim() || null,
    required: Boolean(input.required),
    resolved: Boolean(input.resolved),
    resolvedAt: asIso(input.resolvedAt, null),
    resolvedBy: asString(input.resolvedBy).trim() || null,
    createdAt: asIso(input.createdAt, nowIso()),
  }
}

export function makeWorkflowTask(input = {}) {
  const status = TASK_STATUSES.includes(input.status) ? input.status : TASK_STATUS.OPEN
  const source = TASK_SOURCES.includes(input.source) ? input.source : TASK_SOURCE.MANUAL
  return {
    id: asString(input.id).trim() || createRecordId('wftk'),
    proposalId: asString(input.proposalId).trim(),
    title: asString(input.title).trim(),
    description: asString(input.description).trim(),
    assigneeId: asString(input.assigneeId).trim() || null,
    createdBy: asString(input.createdBy).trim(),
    status,
    source,
    sourceId: asString(input.sourceId).trim() || null,
    dueAt: asIso(input.dueAt, null),
    createdAt: asIso(input.createdAt, nowIso()),
    completedAt: asIso(input.completedAt, null),
  }
}

export function makeWorkflowApproval(input = {}) {
  const status = APPROVAL_STATUSES.includes(input.status)
    ? input.status
    : APPROVAL_STATUS.PENDING
  const createdAt = asIso(input.createdAt, nowIso())
  return {
    id: asString(input.id).trim() || createRecordId('wfap'),
    proposalId: asString(input.proposalId).trim(),
    reviewerId: asString(input.reviewerId).trim(),
    status,
    note: asString(input.note).trim(),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  }
}

export function makeWorkflowRecord(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  const status = WORKFLOW_STATUSES.includes(input.status)
    ? input.status
    : WORKFLOW_STATUS.DRAFT
  const proposalId = asString(input.proposalId).trim()
  const companyId = asString(input.companyId).trim() || DEFAULT_COMPANY_ID
  return {
    id: asString(input.id).trim() || createRecordId('wf'),
    companyId,
    proposalId,
    status,
    ownerId: asString(input.ownerId).trim() || DEFAULT_ACTOR_ID,
    reviewerIds: asIdList(input.reviewerIds),
    assigneeIds: asIdList(input.assigneeIds),
    comments: (Array.isArray(input.comments) ? input.comments : []).map((item) =>
      makeWorkflowComment({ ...item, proposalId }),
    ),
    tasks: (Array.isArray(input.tasks) ? input.tasks : []).map((item) =>
      makeWorkflowTask({ ...item, proposalId }),
    ),
    approvals: (Array.isArray(input.approvals) ? input.approvals : []).map((item) =>
      makeWorkflowApproval({ ...item, proposalId }),
    ),
    activity: (Array.isArray(input.activity) ? input.activity : []).map((item) =>
      makeWorkflowEvent({ ...item, proposalId, companyId }),
    ),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
  }
}

export function cloneWorkflow(record) {
  return makeWorkflowRecord(record)
}

export function validateCommentBody(body) {
  const text = asString(body).trim()
  if (!text) {
    throw new ValidationError('Comment text is required.', [
      { field: 'body', message: 'Enter a comment.' },
    ])
  }
  return text
}

export function validateTaskTitle(title) {
  const text = asString(title).trim()
  if (!text) {
    throw new ValidationError('A task title is required.', [
      { field: 'title', message: 'Enter a task title.' },
    ])
  }
  return text
}

export function emptyWorkflow({ companyId, proposalId, ownerId } = {}) {
  return makeWorkflowRecord({
    companyId,
    proposalId,
    ownerId,
    status: WORKFLOW_STATUS.DRAFT,
  })
}
