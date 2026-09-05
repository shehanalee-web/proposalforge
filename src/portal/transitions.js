import { ValidationError } from '../services/errors.js'
import { PORTAL_STATUS } from './types.js'

export const PORTAL_TRANSITIONS = Object.freeze({
  [PORTAL_STATUS.DRAFT]: [PORTAL_STATUS.PUBLISHED],
  [PORTAL_STATUS.PUBLISHED]: [PORTAL_STATUS.REVOKED, PORTAL_STATUS.EXPIRED],
  [PORTAL_STATUS.REVOKED]: [PORTAL_STATUS.PUBLISHED],
  [PORTAL_STATUS.EXPIRED]: [PORTAL_STATUS.PUBLISHED, PORTAL_STATUS.REVOKED],
})

export function allowedPortalTransitions(from) {
  return PORTAL_TRANSITIONS[from] ?? []
}

export function canTransitionPortalStatus(from, to) {
  return allowedPortalTransitions(from).includes(to)
}

export function assertPortalTransition(from, to) {
  if (canTransitionPortalStatus(from, to)) return true
  throw new ValidationError('This portal transition is not allowed.', [
    {
      field: 'status',
      message: `Cannot move portal from ${from || 'unknown'} to ${to || 'unknown'}.`,
    },
  ])
}
