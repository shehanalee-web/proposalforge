import { PATH } from './workspace/paths.js'
import { getWorkspaceModuleByPath, listNavModules } from './workspace/registry.js'

export const NAV_ITEMS = listNavModules().map((module) => ({
  to: module.path,
  label: module.label,
  icon: module.icon,
  group: module.group,
}))

/**
 * Resolve the header title for a pathname.
 *
 * Exact module matches win first. Nested create/edit URLs are not nav items,
 * so they get dedicated labels instead of falling through to Dashboard.
 */
export function getPageTitle(pathname) {
  const exact = getWorkspaceModuleByPath(pathname)

  if (exact) return exact.label

  if (pathname === PATH.NEW_PROPOSAL) return 'New proposal'
  if (/^\/templates\/new\/?$/.test(pathname)) return 'Create template'
  if (/^\/templates\/[^/]+\/edit\/?$/.test(pathname)) return 'Edit template'
  if (pathname.startsWith(PATH.TEMPLATES)) return 'Templates'
  if (/^\/proposals\/[^/]+\/edit\/?$/.test(pathname)) return 'Edit proposal'
  if (pathname.startsWith(PATH.PROPOSALS)) return 'Proposal'
  if (/^\/history\/[^/]+\/edit\/?$/.test(pathname)) return 'Edit proposal'
  if (pathname.startsWith('/history')) return 'Proposal'

  return 'Dashboard'
}
