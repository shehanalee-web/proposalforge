import { APPROVAL_STATUS } from './types.js'
import { unresolvedRequiredComments } from './comments.js'

export function pendingApprovals(workflow) {
  return (workflow?.approvals ?? []).filter((item) => item.status === APPROVAL_STATUS.PENDING)
}

export function requiredReviewers(workflow) {
  return [...new Set(workflow?.reviewerIds ?? [])]
}

export function approvalForReviewer(workflow, reviewerId) {
  return (workflow?.approvals ?? []).find((item) => item.reviewerId === reviewerId)
}

/**
 * All required reviewers must approve. Required comments must be resolved.
 */
export function getApprovalBlockers(workflow) {
  const reviewers = requiredReviewers(workflow)
  const pending = reviewers.filter((id) => {
    const record = (workflow?.approvals ?? []).find((item) => item.reviewerId === id)
    return !record || record.status !== APPROVAL_STATUS.APPROVED
  })
  const requiredOpen = unresolvedRequiredComments(workflow)
  const reasons = []
  if (reviewers.length === 0) {
    reasons.push('No reviewers are assigned.')
  }
  if (pending.length > 0) {
    reasons.push(
      pending.length === 1
        ? '1 required reviewer still pending.'
        : `${pending.length} required reviewers still pending.`,
    )
  }
  if (requiredOpen.length > 0) {
    reasons.push(
      requiredOpen.length === 1
        ? '1 required change is still unresolved.'
        : `${requiredOpen.length} required changes are still unresolved.`,
    )
  }
  return {
    blocked: reasons.length > 0,
    pendingReviewerIds: pending,
    unresolvedRequiredCount: requiredOpen.length,
    reasons,
    message: reasons.length ? `Approval blocked. ${reasons.join(' ')}` : '',
  }
}

export function canBecomeApproved(workflow) {
  return !getApprovalBlockers(workflow).blocked
}
