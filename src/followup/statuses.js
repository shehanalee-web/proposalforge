import { FOLLOWUP_PRIORITY, FOLLOWUP_REASON, FOLLOWUP_STATUS } from './types.js'
import { isDueToday, isFollowupOverdue } from './policy.js'

const STATUS_META = Object.freeze({
  [FOLLOWUP_STATUS.OPEN]: {
    label: 'Open',
    description: 'Waiting for studio action.',
    tone: 'warning',
  },
  [FOLLOWUP_STATUS.IN_PROGRESS]: {
    label: 'In progress',
    description: 'Someone is working this follow-up.',
    tone: 'info',
  },
  [FOLLOWUP_STATUS.COMPLETED]: {
    label: 'Completed',
    description: 'The studio marked this follow-up done.',
    tone: 'success',
  },
  [FOLLOWUP_STATUS.DISMISSED]: {
    label: 'Dismissed',
    description: 'The studio chose not to act on this signal.',
    tone: 'muted',
  },
})

export function getFollowupStatusMeta(status) {
  return (
    STATUS_META[status] ?? {
      label: String(status ?? 'Unknown'),
      description: '',
      tone: 'neutral',
    }
  )
}

export const FOLLOWUP_STATUS_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(STATUS_META).map(([key, value]) => [key, value.label])),
)

export const FOLLOWUP_REASON_LABELS = Object.freeze({
  [FOLLOWUP_REASON.NEVER_OPENED]: 'Never opened',
  [FOLLOWUP_REASON.AWAITING_RESPONSE]: 'Awaiting response',
  [FOLLOWUP_REASON.CLIENT_INTERACTION]: 'Client feedback',
  [FOLLOWUP_REASON.CHANGES_REQUESTED]: 'Changes requested',
  [FOLLOWUP_REASON.EXPIRING]: 'Expiring',
  [FOLLOWUP_REASON.ACCEPTED_NEXT_STEP]: 'Accepted handoff',
  [FOLLOWUP_REASON.OVERDUE_TASK]: 'Overdue task',
  [FOLLOWUP_REASON.MANUAL]: 'Manual',
})

export const FOLLOWUP_REASON_ACTIONS = Object.freeze({
  [FOLLOWUP_REASON.NEVER_OPENED]: 'Follow up with client',
  [FOLLOWUP_REASON.AWAITING_RESPONSE]: 'Follow up with client',
  [FOLLOWUP_REASON.CLIENT_INTERACTION]: 'Respond to client feedback',
  [FOLLOWUP_REASON.CHANGES_REQUESTED]: 'Address requested changes',
  [FOLLOWUP_REASON.EXPIRING]: 'Follow up before expiry',
  [FOLLOWUP_REASON.ACCEPTED_NEXT_STEP]: 'Complete the next handoff',
  [FOLLOWUP_REASON.OVERDUE_TASK]: 'Complete overdue task',
  [FOLLOWUP_REASON.MANUAL]: 'Follow up',
})

export function isTerminalFollowupStatus(status) {
  return status === FOLLOWUP_STATUS.COMPLETED || status === FOLLOWUP_STATUS.DISMISSED
}

export function isOpenFollowupStatus(status) {
  return status === FOLLOWUP_STATUS.OPEN || status === FOLLOWUP_STATUS.IN_PROGRESS
}

export function followupQueueBucket(record, now = Date.now()) {
  if (!isOpenFollowupStatus(record?.status)) return null
  if (isFollowupOverdue(record.dueAt, now)) return 'overdue'
  if (isDueToday(record.dueAt, now)) return 'due_today'
  if (
    record.reason === FOLLOWUP_REASON.CLIENT_INTERACTION ||
    record.reason === FOLLOWUP_REASON.CHANGES_REQUESTED
  ) {
    return 'client_feedback'
  }
  if (record.reason === FOLLOWUP_REASON.EXPIRING) return 'expiring'
  if (
    record.reason === FOLLOWUP_REASON.NEVER_OPENED ||
    record.reason === FOLLOWUP_REASON.AWAITING_RESPONSE
  ) {
    return 'waiting_for_client'
  }
  return 'open'
}

export function priorityRank(priority) {
  if (priority === FOLLOWUP_PRIORITY.HIGH) return 0
  if (priority === FOLLOWUP_PRIORITY.MEDIUM) return 1
  return 2
}
