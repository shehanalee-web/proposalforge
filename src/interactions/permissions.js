import { WORKFLOW_ROLE } from '../workflow/types.js'
import { isClientAccessible } from '../portal/access.js'

function roleOf(user) {
  return user?.role ?? WORKFLOW_ROLE.VIEWER
}

function isStudioActor(user) {
  return Boolean(user?.id)
}

export function clientCanViewInteraction(portal, now = Date.now()) {
  return isClientAccessible(portal, now)
}

export function clientCanCreateInteraction(portal, now = Date.now()) {
  return isClientAccessible(portal, now)
}

export function studioCanViewInteraction(user) {
  return isStudioActor(user)
}

export function studioCanAcknowledgeInteraction(user) {
  return isStudioActor(user) && roleOf(user) !== WORKFLOW_ROLE.VIEWER
}

export function studioCanResolveInteraction(user) {
  return isStudioActor(user) && roleOf(user) !== WORKFLOW_ROLE.VIEWER
}

export function clientCannotMutateStatus() {
  return false
}

export function clientCannotAcknowledge() {
  return false
}

export function clientCannotResolve() {
  return false
}
