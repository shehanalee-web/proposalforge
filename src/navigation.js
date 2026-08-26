export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/new', label: 'New Proposal', icon: 'new' },
  { to: '/templates', label: 'Templates', icon: 'templates' },
  { to: '/history', label: 'Proposal History', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

/**
 * Resolve the header title for a pathname.
 *
 * Exact nav matches win first. Nested create/edit URLs are not nav items, so
 * they get dedicated labels instead of falling through to Dashboard.
 */
export function getPageTitle(pathname) {
  const exact = NAV_ITEMS.find((item) => item.to === pathname)

  if (exact) return exact.label
  if (/^\/templates\/new\/?$/.test(pathname)) return 'Create template'
  if (/^\/templates\/[^/]+\/edit\/?$/.test(pathname)) return 'Edit template'
  if (pathname.startsWith('/templates')) return 'Templates'
  if (/^\/history\/[^/]+\/edit\/?$/.test(pathname)) return 'Edit proposal'
  if (pathname.startsWith('/history/')) return 'Proposal'

  return 'Dashboard'
}
