import { WORKFLOW_ROLE, WORKFLOW_STATUS } from './types.js'

function roleOf(user) {
  return user?.role ?? WORKFLOW_ROLE.VIEWER
}

function isOwnerOrAdmin(user) {
  const role = roleOf(user)
  return role === WORKFLOW_ROLE.OWNER || role === WORKFLOW_ROLE.ADMIN
}

function isAssignedReviewer(user, workflow) {
  return (workflow?.reviewerIds ?? []).includes(user?.id)
}

export function canComment(user) {
  return roleOf(user) !== WORKFLOW_ROLE.VIEWER
}

export function canAssign(user) {
  return isOwnerOrAdmin(user)
}

export function canCreateTask(user) {
  return roleOf(user) !== WORKFLOW_ROLE.VIEWER
}

export function canApprove(user, workflow) {
  if (roleOf(user) === WORKFLOW_ROLE.VIEWER) return false
  if (roleOf(user) === WORKFLOW_ROLE.ADMIN) return true
  return isAssignedReviewer(user, workflow)
}

export function canRequestChanges(user, workflow) {
  return isOwnerOrAdmin(user) || canApprove(user, workflow)
}

export function canMarkReady(user) {
  return isOwnerOrAdmin(user)
}

export function canTransition(user, workflow, from, to) {
  if (from !== workflow?.status) return false
  if (roleOf(user) === WORKFLOW_ROLE.VIEWER) return false

  if (to === WORKFLOW_STATUS.IN_REVIEW) {
    return isOwnerOrAdmin(user) || roleOf(user) === WORKFLOW_ROLE.EDITOR
  }
  if (to === WORKFLOW_STATUS.APPROVED) return canApprove(user, workflow)
  if (to === WORKFLOW_STATUS.CHANGES_REQUESTED) return canRequestChanges(user, workflow)
  if (to === WORKFLOW_STATUS.READY_TO_SEND) return canMarkReady(user)
  if (to === WORKFLOW_STATUS.DRAFT) return isOwnerOrAdmin(user) || roleOf(user) === WORKFLOW_ROLE.EDITOR
  if (
    to === WORKFLOW_STATUS.SENT ||
    to === WORKFLOW_STATUS.VIEWED ||
    to === WORKFLOW_STATUS.ACCEPTED ||
    to === WORKFLOW_STATUS.REJECTED ||
    to === WORKFLOW_STATUS.EXPIRED
  ) {
    return isOwnerOrAdmin(user)
  }
  return false
}

export function canDeleteComment(user, comment) {
  if (isOwnerOrAdmin(user)) return true
  return comment?.authorId === user?.id
}
