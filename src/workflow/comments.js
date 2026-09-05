import { commentNavigation } from './navigation.js'

export { commentNavigation }

export function openComments(workflow) {
  return (workflow?.comments ?? []).filter((item) => !item.resolved)
}

export function resolvedComments(workflow) {
  return (workflow?.comments ?? []).filter((item) => item.resolved)
}

export function unresolvedRequiredComments(workflow) {
  return (workflow?.comments ?? []).filter((item) => item.required && !item.resolved)
}
