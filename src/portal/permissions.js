import { WORKFLOW_ROLE } from '../workflow/types.js'

function roleOf(user) {
  return user?.role ?? WORKFLOW_ROLE.VIEWER
}

function isOwnerOrAdmin(user) {
  const role = roleOf(user)
  return role === WORKFLOW_ROLE.OWNER || role === WORKFLOW_ROLE.ADMIN
}

export function canReadPortal(user) {
  return Boolean(user?.id)
}

export function canCreatePortal(user) {
  return roleOf(user) !== WORKFLOW_ROLE.VIEWER
}

export function canPublishPortal(user) {
  return isOwnerOrAdmin(user)
}

export function canRevokePortal(user) {
  return isOwnerOrAdmin(user)
}
