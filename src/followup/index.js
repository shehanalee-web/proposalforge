/**
 * Proposal follow-up public API.
 *
 * Operational recommendations above Proposal, Workflow, Portal, and Interactions.
 * Does not own those domains or write proposal content.
 */

export {
  DEFAULT_COMPANY_ID,
  FOLLOWUP_CAPABILITIES,
  FOLLOWUP_EVENT,
  FOLLOWUP_EVENTS,
  FOLLOWUP_ISOLATION_COMPANY_ID,
  FOLLOWUP_PRIORITY,
  FOLLOWUP_PRIORITIES,
  FOLLOWUP_REASON,
  FOLLOWUP_REASONS,
  FOLLOWUP_SOURCE,
  FOLLOWUP_SOURCES,
  FOLLOWUP_STATUS,
  FOLLOWUP_STATUSES,
} from './types.js'

export {
  FOLLOWUP_REASON_ACTIONS,
  FOLLOWUP_REASON_LABELS,
  FOLLOWUP_STATUS_LABELS,
  followupQueueBucket,
  getFollowupStatusMeta,
  isOpenFollowupStatus,
  isTerminalFollowupStatus,
} from './statuses.js'
export { FOLLOWUP_REASON_META, followupSignalKey, getFollowupReasonMeta, reasonLabel } from './reasons.js'
export { FOLLOWUP_POLICY } from './policy.js'
export {
  FOLLOWUP_TRANSITIONS,
  allowedFollowupTransitions,
  assertFollowupTransition,
  canTransitionFollowupStatus,
} from './transitions.js'
export { studioCanAssignFollowup, studioCanMutateFollowup, studioCanViewFollowup } from './permissions.js'
export {
  resetFollowupStore,
  allFollowupRecords,
  configureFollowupStore,
  replaceFollowupRecords,
  findFollowupRecord,
} from './store.js'
export { configureFollowupResolvers, resetFollowupResolvers } from './lookups.js'
export { makeFollowupRecord, emptyFollowup, containsSecret } from './schema.js'
export { evaluateFollowupSignals } from './resolver.js'
export { FOLLOWUP_NOTIFICATION_EVENTS, emitFollowupEvent } from './events.js'
export { getNextFollowupAction, presentStudioFollowup, summarizeFollowupQueue } from './summary.js'

export {
  listFollowupSignals,
  listStudioFollowups,
  getStudioFollowup,
  getProposalFollowupView,
  getCompanyFollowupOverview,
  createManualFollowup,
  startFollowup,
  completeFollowup,
  dismissFollowup,
  assignFollowupOwner,
  scheduleFollowup,
  syncFollowupsForProposal,
  syncFollowupsForCompany,
  clientFollowupApiDenied,
} from './repository.js'
