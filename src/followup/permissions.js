import { WORKFLOW_ROLE } from '../workflow/types.js'

function roleOf(user) {
  return user?.role ?? WORKFLOW_ROLE.VIEWER
}

function isStudioActor(user) {
  return Boolean(user?.id)
}

export function studioCanViewFollowup(user) {
  return isStudioActor(user)
}

export function studioCanMutateFollowup(user) {
  return isStudioActor(user) && roleOf(user) !== WORKFLOW_ROLE.VIEWER
}

export function studioCanAssignFollowup(user) {
  return studioCanMutateFollowup(user)
}
