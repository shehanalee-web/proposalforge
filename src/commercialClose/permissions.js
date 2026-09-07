import { WORKFLOW_ROLE } from '../workflow/types.js'

function roleOf(user) {
  return user?.role ?? WORKFLOW_ROLE.VIEWER
}

function isOwnerOrAdmin(user) {
  const role = roleOf(user)
  return role === WORKFLOW_ROLE.OWNER || role === WORKFLOW_ROLE.ADMIN
}

/**
 * Owner / admin / editor / reviewer may view closes in their company.
 */
export function studioCanViewCommercialClose(user) {
  const role = roleOf(user)
  return (
    role === WORKFLOW_ROLE.OWNER ||
    role === WORKFLOW_ROLE.ADMIN ||
    role === WORKFLOW_ROLE.EDITOR ||
    role === WORKFLOW_ROLE.REVIEWER
  )
}

/**
 * Only owner / admin may open (create) a commercial close.
 */
export function studioCanCreateCommercialClose(user) {
  return isOwnerOrAdmin(user)
}

/**
 * Only owner / admin may transition commercial close state (H15.2).
 */
export function studioCanTransitionCommercialClose(user) {
  return isOwnerOrAdmin(user)
}

/**
 * Only owner / admin may request or complete studio-authorized signature actions (H15.3).
 */
export function studioCanManageCommercialCloseSignature(user) {
  return isOwnerOrAdmin(user)
}

/**
 * Only owner / admin may request or complete studio-authorized payment actions (H15.4).
 */
export function studioCanManageCommercialClosePayment(user) {
  return isOwnerOrAdmin(user)
}
