/**
 * H16.9 Slice 9.3 — Native Activity timeline source.
 *
 * Read-only projection of the registered ActivityRepository. Does not
 * instantiate adapters, import postgres factories, or gate on
 * activityAuthoring. Archived rows stay hidden from the default timeline.
 */

import { AUTOMATION_SOURCE_DOMAIN } from '../../events/types.js'
import { ACTIVITY_REPOSITORY_MODE } from '../../../persistence/activities/types.js'
import { getActivityRepository } from '../../../persistence/activities/port.js'
import { TIMELINE_SOURCE_ID } from '../types.js'

function toCandidate(activity) {
  return {
    sourceId: TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
    nativeId: activity.id,
    companyId: activity.companyId,
    subject: activity.subject,
    kind: activity.kind,
    type: activity.type,
    origin: activity.origin,
    audience: activity.audience,
    occurredAtRaw: activity.occurredAt,
    recordedAtRaw: activity.recordedAt,
    actor: activity.actor,
    subjectLine: activity.subjectLine,
    body: activity.body,
    attributes: activity.attributes,
    source: activity.source,
  }
}

export function createNativeActivityTimelineSource() {
  return {
    id: TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
    canonicalFor: [AUTOMATION_SOURCE_DOMAIN.ACTIVITY],

    describe() {
      return {
        id: TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
        readOnly: true,
        storeRef: 'activity-repository',
      }
    },

    isEnabled() {
      return getActivityRepository().describe().mode !== ACTIVITY_REPOSITORY_MODE.NULL
    },

    async list(query = {}) {
      const page = await getActivityRepository().list({
        companyId: query.companyId,
        subjectType: query.subjectType,
        subjectId: query.subjectId,
        kinds: query.kinds,
        origins: query.origins,
        audience: query.audience,
        since: query.since,
        until: query.until,
        limit: query.limit,
        includeArchived: false,
      })
      const entries = Array.isArray(page?.entries) ? page.entries : []
      return entries.map(toCandidate)
    },
  }
}
