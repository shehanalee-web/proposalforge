export function assignOwner(workflow, ownerId) {
  return { ...workflow, ownerId }
}

export function assignReviewer(workflow, reviewerId) {
  const reviewerIds = [...new Set([...(workflow.reviewerIds ?? []), reviewerId])]
  return { ...workflow, reviewerIds }
}

export function removeReviewer(workflow, reviewerId) {
  return {
    ...workflow,
    reviewerIds: (workflow.reviewerIds ?? []).filter((id) => id !== reviewerId),
    approvals: (workflow.approvals ?? []).filter((item) => item.reviewerId !== reviewerId),
  }
}

export function assignSupporting(workflow, assigneeId) {
  const assigneeIds = [...new Set([...(workflow.assigneeIds ?? []), assigneeId])]
  return { ...workflow, assigneeIds }
}
