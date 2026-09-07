import { ValidationError } from '../services/errors.js'
import { COMMERCIAL_CLOSE_STATUS } from './types.js'

/**
 * Authoritative commercial-close transition graph (H15.2).
 * Vendor-neutral: "signed" / "paid" mean architectural states, not providers.
 */

export const COMMERCIAL_CLOSE_TRANSITIONS = Object.freeze({
  [COMMERCIAL_CLOSE_STATUS.OPEN]: [
    COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
    COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
    COMMERCIAL_CLOSE_STATUS.CANCELLED,
    COMMERCIAL_CLOSE_STATUS.EXPIRED,
  ],
  [COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING]: [
    COMMERCIAL_CLOSE_STATUS.SIGNED,
    COMMERCIAL_CLOSE_STATUS.CANCELLED,
    COMMERCIAL_CLOSE_STATUS.EXPIRED,
  ],
  [COMMERCIAL_CLOSE_STATUS.SIGNED]: [
    COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
    COMMERCIAL_CLOSE_STATUS.CLOSED,
    COMMERCIAL_CLOSE_STATUS.CANCELLED,
  ],
  [COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING]: [
    COMMERCIAL_CLOSE_STATUS.PAID,
    COMMERCIAL_CLOSE_STATUS.CANCELLED,
    COMMERCIAL_CLOSE_STATUS.EXPIRED,
  ],
  [COMMERCIAL_CLOSE_STATUS.PAID]: [COMMERCIAL_CLOSE_STATUS.CLOSED],
  [COMMERCIAL_CLOSE_STATUS.CLOSED]: [],
  [COMMERCIAL_CLOSE_STATUS.CANCELLED]: [],
  [COMMERCIAL_CLOSE_STATUS.EXPIRED]: [],
})

export function allowedCommercialCloseTransitions(from) {
  return COMMERCIAL_CLOSE_TRANSITIONS[from] ?? []
}

export function canTransitionCommercialCloseStatus(from, to) {
  return allowedCommercialCloseTransitions(from).includes(to)
}

export function assertCommercialCloseTransition(from, to) {
  if (canTransitionCommercialCloseStatus(from, to)) return true
  throw new ValidationError('This commercial close transition is not allowed.', [
    {
      field: 'to',
      message: `Cannot move from ${from || 'unknown'} to ${to || 'unknown'}.`,
    },
  ])
}
