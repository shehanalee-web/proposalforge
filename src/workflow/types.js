/**
 * Horizon 10 Proposal Workflow identifiers.
 *
 * Future portal / signature / CRM / messaging flags stay explicit and off.
 */

export const WORKFLOW_STATUS = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  READY_TO_SEND: 'ready_to_send',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
})

export const WORKFLOW_STATUSES = Object.freeze(Object.values(WORKFLOW_STATUS))

export const WORKFLOW_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  REVIEWER: 'reviewer',
  VIEWER: 'viewer',
})

export const WORKFLOW_ROLES = Object.freeze(Object.values(WORKFLOW_ROLE))

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes_requested',
})

export const APPROVAL_STATUSES = Object.freeze(Object.values(APPROVAL_STATUS))

export const TASK_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
})

export const TASK_STATUSES = Object.freeze(Object.values(TASK_STATUS))

export const TASK_SOURCE = Object.freeze({
  MANUAL: 'manual',
  HEALTH: 'health',
  CONSISTENCY: 'consistency',
  COACH: 'coach',
})

export const TASK_SOURCES = Object.freeze(Object.values(TASK_SOURCE))

export const WORKFLOW_EVENT = Object.freeze({
  STATUS_CHANGED: 'workflow.status_changed',
  REVIEW_REQUESTED: 'workflow.review_requested',
  CHANGES_REQUESTED: 'workflow.changes_requested',
  RESUBMITTED: 'workflow.resubmitted',
  APPROVED: 'workflow.approved',
  READY_TO_SEND: 'workflow.ready_to_send',
  SENT: 'workflow.sent',
  VIEWED: 'workflow.viewed',
  ACCEPTED: 'workflow.accepted',
  REJECTED: 'workflow.rejected',
  EXPIRED: 'workflow.expired',
  COMMENT_ADDED: 'workflow.comment_added',
  COMMENT_RESOLVED: 'workflow.comment_resolved',
  COMMENT_REOPENED: 'workflow.comment_reopened',
  COMMENT_DELETED: 'workflow.comment_deleted',
  TASK_CREATED: 'workflow.task_created',
  TASK_ASSIGNED: 'workflow.task_assigned',
  TASK_COMPLETED: 'workflow.task_completed',
  TASK_REOPENED: 'workflow.task_reopened',
  TASK_UPDATED: 'workflow.task_updated',
  REVIEWER_ASSIGNED: 'workflow.reviewer_assigned',
  REVIEWER_REMOVED: 'workflow.reviewer_removed',
  OWNER_ASSIGNED: 'workflow.owner_assigned',
  APPROVAL_REQUESTED: 'workflow.approval_requested',
})

export const WORKFLOW_EVENTS = Object.freeze(Object.values(WORKFLOW_EVENT))

export const WORKFLOW_ACTION = Object.freeze({
  SEND_FOR_REVIEW: 'send_for_review',
  REQUEST_CHANGES: 'request_changes',
  APPROVE: 'approve',
  RESUBMIT: 'resubmit',
  MARK_READY: 'mark_ready',
  MARK_SENT: 'mark_sent',
  MARK_VIEWED: 'mark_viewed',
})

/** Future Horizons. All remain off in Horizon 10. */
export const WORKFLOW_CAPABILITIES = Object.freeze({
  clientPortal: false,
  digitalSignature: false,
  emailDelivery: false,
  whatsapp: false,
  slack: false,
  teams: false,
  calendar: false,
  crm: false,
  clientComments: false,
  clientApprovals: false,
  slaTracking: false,
  automatedReminders: true,
  multiStageApprovals: false,
  conditionalApprovals: false,
  departmentWorkflows: false,
  enterprisePermissions: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export const WORKFLOW_ISOLATION_COMPANY_ID = 'company-harborline'
