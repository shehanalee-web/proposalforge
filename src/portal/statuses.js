import { PORTAL_STATUS } from './types.js'

const META = Object.freeze({
  [PORTAL_STATUS.DRAFT]: {
    label: 'Unpublished',
    description: 'Internal draft. Clients cannot view this proposal.',
    tone: 'neutral',
  },
  [PORTAL_STATUS.PUBLISHED]: {
    label: 'Published',
    description: 'Clients can view the published proposal.',
    tone: 'success',
  },
  [PORTAL_STATUS.REVOKED]: {
    label: 'Revoked',
    description: 'Client access was revoked. The proposal is unchanged.',
    tone: 'danger',
  },
  [PORTAL_STATUS.EXPIRED]: {
    label: 'Expired',
    description: 'This portal link is past its expiry and is no longer accessible.',
    tone: 'muted',
  },
})

export function getPortalStatusMeta(status) {
  return META[status] ?? {
    label: String(status ?? 'Unknown'),
    description: '',
    tone: 'neutral',
  }
}

export const PORTAL_STATUS_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(META).map(([key, value]) => [key, value.label])),
)
