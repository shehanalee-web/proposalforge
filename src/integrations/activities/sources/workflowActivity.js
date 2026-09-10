/**
 * H16.7 — Workflow activity timeline source.
 *
 * Projects H10 workflow *events* only. The Activity domain does not own
 * workflow tasks: it never lists, assigns, or transitions them. Task ownership
 * stays with H10 for this phase.
 */

import { allWorkflowRecords } from '../../../workflow/store.js'
import { AUTOMATION_SOURCE_DOMAIN } from '../../events/types.js'
import { TIMELINE_SOURCE_ID } from '../types.js'
import { createDomainActivityTimelineSource } from './domainActivity.js'

export function createWorkflowActivityTimelineSource() {
  return createDomainActivityTimelineSource({
    sourceId: TIMELINE_SOURCE_ID.WORKFLOW_ACTIVITY,
    domain: AUTOMATION_SOURCE_DOMAIN.WORKFLOW,
    storeRef: 'workflow.json',
    listRecords: allWorkflowRecords,
  })
}
