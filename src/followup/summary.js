import { getWorkflowActor } from '../workflow/actors.js'
import { clockOf, isDueToday, isFollowupOverdue } from './policy.js'
import { followupQueueBucket, isOpenFollowupStatus, priorityRank } from './statuses.js'
import { FOLLOWUP_STATUS } from './types.js'

export function presentStudioFollowup(record, now = Date.now()) {
  if (!record) return null
  const owner = record.ownerActorId ? getWorkflowActor(record.ownerActorId) : null
  return {
    kind: 'studio_followup',
    id: record.id,
    companyId: record.companyId,
    proposalId: record.proposalId,
    ownerActorId: record.ownerActorId,
    ownerName: owner?.name || '',
    reason: record.reason,
    title: record.title,
    description: record.description,
    priority: record.priority,
    status: record.status,
    dueAt: record.dueAt,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    dismissedAt: record.dismissedAt,
    overdue: isOpenFollowupStatus(record.status) && isFollowupOverdue(record.dueAt, now),
    dueToday: isOpenFollowupStatus(record.status) && isDueToday(record.dueAt, now),
    bucket: followupQueueBucket(record, now),
  }
}

export function presentFollowupSignal(signal) {
  return {
    kind: 'followup_signal',
    reason: signal.reason,
    title: signal.title,
    description: signal.description,
    priority: signal.priority,
    sourceType: signal.sourceType,
    sourceId: signal.sourceId,
    dueAt: signal.dueAt,
    ownerActorId: signal.ownerActorId,
    signalKey: signal.signalKey,
  }
}

export function compareFollowups(left, right, now = Date.now()) {
  const leftOpen = isOpenFollowupStatus(left.status) ? 0 : 1
  const rightOpen = isOpenFollowupStatus(right.status) ? 0 : 1
  if (leftOpen !== rightOpen) return leftOpen - rightOpen
  const leftOverdue = isFollowupOverdue(left.dueAt, now) ? 0 : 1
  const rightOverdue = isFollowupOverdue(right.dueAt, now) ? 0 : 1
  if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue
  const byPriority = priorityRank(left.priority) - priorityRank(right.priority)
  if (byPriority !== 0) return byPriority
  return String(left.dueAt || '').localeCompare(String(right.dueAt || ''))
}

export function getNextFollowupAction(records, now = Date.now()) {
  const open = (records ?? [])
    .filter((item) => isOpenFollowupStatus(item.status))
    .sort((left, right) => compareFollowups(left, right, now))
  const next = open[0]
  if (!next) return null
  const presented = presentStudioFollowup(next, now)
  return {
    followupId: presented.id,
    proposalId: presented.proposalId,
    title: presented.title,
    description: presented.description,
    reason: presented.reason,
    ownerActorId: presented.ownerActorId,
    ownerName: presented.ownerName,
    dueAt: presented.dueAt,
    status: presented.status,
    priority: presented.priority,
    overdue: presented.overdue,
  }
}

export function summarizeFollowupQueue(records, now = Date.now()) {
  const list = records ?? []
  const buckets = {
    due_today: [],
    overdue: [],
    waiting_for_client: [],
    expiring: [],
    client_feedback: [],
    open: [],
  }
  for (const record of list) {
    if (record.status === FOLLOWUP_STATUS.COMPLETED || record.status === FOLLOWUP_STATUS.DISMISSED) {
      continue
    }
    const bucket = followupQueueBucket(record, now)
    if (bucket === 'overdue') buckets.overdue.push(record)
    else if (bucket === 'due_today') buckets.due_today.push(record)
    if (bucket === 'waiting_for_client' || record.reason === 'never_opened' || record.reason === 'awaiting_response') {
      if (isOpenFollowupStatus(record.status)) buckets.waiting_for_client.push(record)
    }
    if (bucket === 'expiring' || record.reason === 'expiring') {
      if (isOpenFollowupStatus(record.status)) buckets.expiring.push(record)
    }
    if (bucket === 'client_feedback' || record.reason === 'client_interaction' || record.reason === 'changes_requested') {
      if (isOpenFollowupStatus(record.status)) buckets.client_feedback.push(record)
    }
    if (isOpenFollowupStatus(record.status)) buckets.open.push(record)
  }

  const unique = (items) => {
    const seen = new Set()
    return items.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }

  return {
    dueToday: unique(buckets.due_today).length,
    overdue: unique(buckets.overdue).length,
    waitingForClient: unique(buckets.waiting_for_client).length,
    expiring: unique(buckets.expiring).length,
    clientFeedback: unique(buckets.client_feedback).length,
    open: unique(buckets.open).length,
    nextAction: getNextFollowupAction(list, now),
  }
}

export { clockOf }
