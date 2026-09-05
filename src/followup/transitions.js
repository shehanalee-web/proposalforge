import { ValidationError } from '../services/errors.js'
import { FOLLOWUP_STATUS } from './types.js'

export const FOLLOWUP_TRANSITIONS = Object.freeze({
  [FOLLOWUP_STATUS.OPEN]: [
    FOLLOWUP_STATUS.IN_PROGRESS,
    FOLLOWUP_STATUS.COMPLETED,
    FOLLOWUP_STATUS.DISMISSED,
  ],
  [FOLLOWUP_STATUS.IN_PROGRESS]: [FOLLOWUP_STATUS.COMPLETED, FOLLOWUP_STATUS.DISMISSED],
  [FOLLOWUP_STATUS.COMPLETED]: [],
  [FOLLOWUP_STATUS.DISMISSED]: [],
})

export function allowedFollowupTransitions(from) {
  return FOLLOWUP_TRANSITIONS[from] ?? []
}

export function canTransitionFollowupStatus(from, to) {
  return allowedFollowupTransitions(from).includes(to)
}

export function assertFollowupTransition(from, to) {
  if (canTransitionFollowupStatus(from, to)) return true
  throw new ValidationError('This follow-up transition is not allowed.', [
    {
      field: 'status',
      message: `Cannot move follow-up from ${from || 'unknown'} to ${to || 'unknown'}.`,
    },
  ])
}
