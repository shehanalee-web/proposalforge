import { ValidationError } from '../services/errors.js'
import { INTERACTION_STATUS } from './types.js'

export const INTERACTION_TRANSITIONS = Object.freeze({
  [INTERACTION_STATUS.OPEN]: [INTERACTION_STATUS.ACKNOWLEDGED, INTERACTION_STATUS.RESOLVED],
  [INTERACTION_STATUS.ACKNOWLEDGED]: [INTERACTION_STATUS.RESOLVED],
  [INTERACTION_STATUS.RESOLVED]: [],
})

export function allowedInteractionTransitions(from) {
  return INTERACTION_TRANSITIONS[from] ?? []
}

export function canTransitionInteractionStatus(from, to) {
  return allowedInteractionTransitions(from).includes(to)
}

export function assertInteractionTransition(from, to) {
  if (canTransitionInteractionStatus(from, to)) return true
  throw new ValidationError('This interaction transition is not allowed.', [
    {
      field: 'status',
      message: `Cannot move interaction from ${from || 'unknown'} to ${to || 'unknown'}.`,
    },
  ])
}
