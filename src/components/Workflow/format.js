import { getWorkflowActor } from '../../workflow/actors.js'
import { getWorkflowStatusMeta } from '../../workflow/statuses.js'
import { WORKFLOW_EVENT } from '../../workflow/types.js'

export function actorName(id) {
  return getWorkflowActor(id)?.name || id || 'Someone'
}

export function activityLabel(event) {
  const actor = event.actorName || actorName(event.actorId)
  const payload = event.payload ?? {}
  switch (event.type) {
    case WORKFLOW_EVENT.STATUS_CHANGED:
      return `${actor} moved workflow to ${payload.to || event.to || 'a new status'}`
    case WORKFLOW_EVENT.REVIEW_REQUESTED:
      return `${actor} sent the proposal for review`
    case WORKFLOW_EVENT.RESUBMITTED:
      return `${actor} resubmitted for review`
    case WORKFLOW_EVENT.REVIEWER_ASSIGNED:
      return `${actor} assigned ${payload.reviewerName || actorName(payload.reviewerId)} as reviewer`
    case WORKFLOW_EVENT.REVIEWER_REMOVED:
      return `${actor} removed a reviewer`
    case WORKFLOW_EVENT.OWNER_ASSIGNED:
      return `${actor} assigned ${payload.ownerName || actorName(payload.ownerId)} as owner`
    case WORKFLOW_EVENT.COMMENT_ADDED:
      return payload.blockId
        ? `${actor} commented on a section`
        : `${actor} added a comment`
    case WORKFLOW_EVENT.COMMENT_RESOLVED:
      return `${actor} resolved a comment`
    case WORKFLOW_EVENT.COMMENT_REOPENED:
      return `${actor} reopened a comment`
    case WORKFLOW_EVENT.TASK_CREATED:
      return `${actor} created task "${payload.title || 'Untitled'}"`
    case WORKFLOW_EVENT.TASK_ASSIGNED:
      return `${actor} assigned a task`
    case WORKFLOW_EVENT.TASK_COMPLETED:
      return `${actor} completed a task`
    case WORKFLOW_EVENT.TASK_REOPENED:
      return `${actor} reopened a task`
    case WORKFLOW_EVENT.APPROVAL_REQUESTED:
      return `${actor} requested reviewer approval`
    case WORKFLOW_EVENT.APPROVED:
      return `${actor} approved the proposal`
    case WORKFLOW_EVENT.CHANGES_REQUESTED:
      return `${actor} requested changes`
    case WORKFLOW_EVENT.READY_TO_SEND:
      return `${actor} marked the proposal ready to send`
    case WORKFLOW_EVENT.SENT:
      return `${actor} marked the proposal sent`
    case WORKFLOW_EVENT.VIEWED:
      return `${actor} marked the proposal viewed`
    default:
      return `${actor} updated workflow`
  }
}

export function actionLabel(action) {
  return getWorkflowStatusMeta('draft').allowedActions.includes(action)
    ? action
    : {
        send_for_review: 'Send for Review',
        request_changes: 'Request Changes',
        approve: 'Approve',
        resubmit: 'Resubmit',
        mark_ready: 'Mark Ready',
        mark_sent: 'Mark Sent',
        mark_viewed: 'Mark Viewed',
      }[action] || action
}
