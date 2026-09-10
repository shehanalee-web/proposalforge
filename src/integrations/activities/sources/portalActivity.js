/**
 * H16.7 — Portal activity timeline source.
 *
 * Projects H11 portal lifecycle events (created, published, revoked, expired)
 * that predate H16.2 intake. Read-only; never touches the portal record.
 */

import { allPortalRecords } from '../../../portal/store.js'
import { AUTOMATION_SOURCE_DOMAIN } from '../../events/types.js'
import { TIMELINE_SOURCE_ID } from '../types.js'
import { createDomainActivityTimelineSource } from './domainActivity.js'

export function createPortalActivityTimelineSource() {
  return createDomainActivityTimelineSource({
    sourceId: TIMELINE_SOURCE_ID.PORTAL_ACTIVITY,
    domain: AUTOMATION_SOURCE_DOMAIN.PORTAL,
    storeRef: 'portal.json',
    listRecords: allPortalRecords,
  })
}
