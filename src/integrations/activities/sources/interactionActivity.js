/**
 * H16.7 — Interaction activity timeline source.
 *
 * Projects H12 interaction lifecycle events (created, acknowledged, resolved).
 *
 * Engagement mirrors such as comment_added and change_requested are canonical
 * on living per the H16.2 normalizer, so they are filtered here as well as in
 * the de-duplication policy. Filtering at the source keeps a legacy record that
 * predates the ledger from smuggling a living-owned fact into the timeline.
 */

import { allInteractionRecords } from '../../../interactions/store.js'
import { AUTOMATION_SOURCE_DOMAIN } from '../../events/types.js'
import {
  TIMELINE_LIVING_CANONICAL_INTERACTION_TYPES,
  TIMELINE_SOURCE_ID,
} from '../types.js'
import { createDomainActivityTimelineSource } from './domainActivity.js'

function isLivingCanonical(event) {
  const type = String(event?.type ?? '').trim()
  const bare = type.startsWith(`${AUTOMATION_SOURCE_DOMAIN.INTERACTION}.`)
    ? type.slice(AUTOMATION_SOURCE_DOMAIN.INTERACTION.length + 1)
    : type
  return TIMELINE_LIVING_CANONICAL_INTERACTION_TYPES.includes(bare)
}

export function createInteractionActivityTimelineSource() {
  return createDomainActivityTimelineSource({
    sourceId: TIMELINE_SOURCE_ID.INTERACTION_ACTIVITY,
    domain: AUTOMATION_SOURCE_DOMAIN.INTERACTION,
    storeRef: 'interactions.json',
    listRecords: allInteractionRecords,
    acceptEvent: (event) => !isLivingCanonical(event),
  })
}
