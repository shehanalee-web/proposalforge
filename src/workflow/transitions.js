import { ValidationError } from '../services/errors.js'
import { WORKFLOW_STATUS } from './types.js'

export const WORKFLOW_TRANSITIONS = Object.freeze({
  [WORKFLOW_STATUS.DRAFT]: [WORKFLOW_STATUS.IN_REVIEW],
  [WORKFLOW_STATUS.IN_REVIEW]: [
    WORKFLOW_STATUS.CHANGES_REQUESTED,
    WORKFLOW_STATUS.APPROVED,
    WORKFLOW_STATUS.DRAFT,
  ],
  [WORKFLOW_STATUS.CHANGES_REQUESTED]: [
    WORKFLOW_STATUS.IN_REVIEW,
    WORKFLOW_STATUS.DRAFT,
  ],
  [WORKFLOW_STATUS.APPROVED]: [
    WORKFLOW_STATUS.READY_TO_SEND,
    WORKFLOW_STATUS.CHANGES_REQUESTED,
  ],
  [WORKFLOW_STATUS.READY_TO_SEND]: [
    WORKFLOW_STATUS.SENT,
    WORKFLOW_STATUS.CHANGES_REQUESTED,
  ],
  [WORKFLOW_STATUS.SENT]: [
    WORKFLOW_STATUS.VIEWED,
    WORKFLOW_STATUS.ACCEPTED,
    WORKFLOW_STATUS.REJECTED,
    WORKFLOW_STATUS.EXPIRED,
  ],
  [WORKFLOW_STATUS.VIEWED]: [
    WORKFLOW_STATUS.ACCEPTED,
    WORKFLOW_STATUS.REJECTED,
    WORKFLOW_STATUS.EXPIRED,
  ],
  [WORKFLOW_STATUS.ACCEPTED]: [],
  [WORKFLOW_STATUS.REJECTED]: [],
  [WORKFLOW_STATUS.EXPIRED]: [],
})

export function allowedTransitions(from) {
  return WORKFLOW_TRANSITIONS[from] ?? []
}

export function canTransitionStatus(from, to) {
  return allowedTransitions(from).includes(to)
}

export function assertTransition(from, to) {
  if (canTransitionStatus(from, to)) return true
  throw new ValidationError('This workflow transition is not allowed.', [
    {
      field: 'status',
      message: `Cannot move from ${from || 'unknown'} to ${to || 'unknown'}.`,
    },
  ])
}
