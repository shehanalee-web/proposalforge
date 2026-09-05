import { WORKFLOW_ACTION, WORKFLOW_STATUS } from './types.js'

const META = Object.freeze({
  [WORKFLOW_STATUS.DRAFT]: {
    label: 'Draft',
    description: 'Internal draft. Not in review.',
    tone: 'neutral',
    allowedActions: [WORKFLOW_ACTION.SEND_FOR_REVIEW],
  },
  [WORKFLOW_STATUS.IN_REVIEW]: {
    label: 'In Review',
    description: 'Waiting on reviewer action.',
    tone: 'info',
    allowedActions: [WORKFLOW_ACTION.APPROVE, WORKFLOW_ACTION.REQUEST_CHANGES],
  },
  [WORKFLOW_STATUS.CHANGES_REQUESTED]: {
    label: 'Changes Requested',
    description: 'Reviewer asked for edits before approval.',
    tone: 'warning',
    allowedActions: [WORKFLOW_ACTION.RESUBMIT],
  },
  [WORKFLOW_STATUS.APPROVED]: {
    label: 'Approved',
    description: 'Required reviewers have approved.',
    tone: 'success',
    allowedActions: [WORKFLOW_ACTION.MARK_READY, WORKFLOW_ACTION.REQUEST_CHANGES],
  },
  [WORKFLOW_STATUS.READY_TO_SEND]: {
    label: 'Ready to Send',
    description: 'Approved and ready. Nothing is sent yet.',
    tone: 'accent',
    allowedActions: [WORKFLOW_ACTION.MARK_SENT, WORKFLOW_ACTION.REQUEST_CHANGES],
  },
  [WORKFLOW_STATUS.SENT]: {
    label: 'Sent',
    description: 'Marked sent for future delivery systems.',
    tone: 'info',
    allowedActions: [WORKFLOW_ACTION.MARK_VIEWED],
  },
  [WORKFLOW_STATUS.VIEWED]: {
    label: 'Viewed',
    description: 'Marked viewed for future portal tracking.',
    tone: 'accent',
    allowedActions: [],
  },
  [WORKFLOW_STATUS.ACCEPTED]: {
    label: 'Accepted',
    description: 'Placeholder for future client acceptance.',
    tone: 'success',
    allowedActions: [],
  },
  [WORKFLOW_STATUS.REJECTED]: {
    label: 'Rejected',
    description: 'Placeholder for future client rejection.',
    tone: 'danger',
    allowedActions: [],
  },
  [WORKFLOW_STATUS.EXPIRED]: {
    label: 'Expired',
    description: 'Placeholder for future expiry handling.',
    tone: 'muted',
    allowedActions: [],
  },
})

/**
 * Central status → label / tone / actions. Do not hard-code in components.
 *
 * @param {string} status
 */
export function getWorkflowStatusMeta(status) {
  return META[status] ?? {
    label: String(status ?? 'Unknown'),
    description: '',
    tone: 'neutral',
    allowedActions: [],
  }
}

export const WORKFLOW_STATUS_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(META).map(([key, value]) => [key, value.label])),
)
