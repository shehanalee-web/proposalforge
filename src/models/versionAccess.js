/**
 * Studio access for proposal versioning.
 *
 * There is no multi-user login in this app. The active role is stored locally
 * so the permission checks stay real at the service layer.
 */

export const STUDIO_ROLE = Object.freeze({
  EDITOR: 'editor',
  ADMIN: 'admin',
})

export const STUDIO_ROLES = Object.freeze(Object.values(STUDIO_ROLE))

const ROLE_KEY = 'proposalforge.studioRole'
const ACCEPTED = 'accepted'
const DRAFT = 'draft'

export function getStudioRole() {
  if (typeof window === 'undefined') return STUDIO_ROLE.ADMIN
  const stored = window.localStorage.getItem(ROLE_KEY)
  return STUDIO_ROLES.includes(stored) ? stored : STUDIO_ROLE.ADMIN
}

export function setStudioRole(role) {
  if (typeof window === 'undefined') return
  if (STUDIO_ROLES.includes(role)) {
    window.localStorage.setItem(ROLE_KEY, role)
  }
}

export function isApprovedVersion(version) {
  return version?.status === ACCEPTED
}

export function canCreateProposalVersion(role = getStudioRole()) {
  return role === STUDIO_ROLE.EDITOR || role === STUDIO_ROLE.ADMIN
}

export function canRestoreProposalVersion(role = getStudioRole()) {
  return canCreateProposalVersion(role)
}

export function canCompareProposalVersions(role = getStudioRole()) {
  return canCreateProposalVersion(role)
}

export function canDeleteDraftVersion(version, role = getStudioRole()) {
  return (
    role === STUDIO_ROLE.ADMIN &&
    version?.status === DRAFT &&
    !isApprovedVersion(version)
  )
}
