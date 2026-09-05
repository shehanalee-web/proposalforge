import { INTERACTION_STATUS, INTERACTION_TYPE } from './types.js'

const META = Object.freeze({
  [INTERACTION_STATUS.OPEN]: {
    label: 'Open',
    description: 'Submitted and waiting for studio review.',
    tone: 'neutral',
  },
  [INTERACTION_STATUS.ACKNOWLEDGED]: {
    label: 'Acknowledged',
    description: 'The studio has seen this interaction.',
    tone: 'success',
  },
  [INTERACTION_STATUS.RESOLVED]: {
    label: 'Resolved',
    description: 'The studio marked this interaction resolved.',
    tone: 'muted',
  },
})

export function getInteractionStatusMeta(status) {
  return META[status] ?? {
    label: String(status ?? 'Unknown'),
    description: '',
    tone: 'neutral',
  }
}

export const INTERACTION_STATUS_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(META).map(([key, value]) => [key, value.label])),
)

export const INTERACTION_TYPE_LABELS = Object.freeze({
  [INTERACTION_TYPE.COMMENT]: 'Comment',
  [INTERACTION_TYPE.CHANGE_REQUEST]: 'Change request',
  [INTERACTION_TYPE.APPROVAL]: 'Approval',
  [INTERACTION_TYPE.QUESTION]: 'Question',
})
