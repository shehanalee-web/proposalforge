/**
 * Proposal workflow public API.
 *
 * Metadata and activity around an existing proposal. Does not own proposal
 * content, Health, Intelligence, Consistency, Coach, or AI Improvements.
 */

export {
  APPROVAL_STATUS,
  APPROVAL_STATUSES,
  DEFAULT_COMPANY_ID,
  TASK_SOURCE,
  TASK_SOURCES,
  TASK_STATUS,
  TASK_STATUSES,
  WORKFLOW_ACTION,
  WORKFLOW_CAPABILITIES,
  WORKFLOW_EVENT,
  WORKFLOW_EVENTS,
  WORKFLOW_ISOLATION_COMPANY_ID,
  WORKFLOW_ROLE,
  WORKFLOW_ROLES,
  WORKFLOW_STATUS,
  WORKFLOW_STATUSES,
} from './types.js'

export { WORKFLOW_ACTORS, DEFAULT_ACTOR_ID, getWorkflowActor, resolveWorkflowActor, actorsForCompany } from './actors.js'
export { getWorkflowStatusMeta, WORKFLOW_STATUS_LABELS } from './statuses.js'
export { WORKFLOW_TRANSITIONS, allowedTransitions, canTransitionStatus, assertTransition } from './transitions.js'
export {
  canApprove,
  canAssign,
  canComment,
  canCreateTask,
  canDeleteComment,
  canMarkReady,
  canRequestChanges,
  canTransition,
} from './permissions.js'
export { commentNavigation } from './navigation.js'
export { isTaskOverdue, overdueTasks, openTasks, findingTaskFields } from './tasks.js'
export { getApprovalBlockers, canBecomeApproved, pendingApprovals } from './approvals.js'
export { getWorkflowSummary } from './summary.js'
export { WORKFLOW_NOTIFICATION_EVENTS, emitWorkflowEvent } from './events.js'
export { resetWorkflowStore, allWorkflowRecords, configureWorkflowStore, replaceWorkflowRecords } from './store.js'
export { makeWorkflowRecord, makeWorkflowComment, makeWorkflowTask, makeWorkflowApproval } from './schema.js'

export {
  getWorkflow,
  listWorkflows,
  transitionWorkflow,
  assignOwner,
  assignReviewer,
  removeReviewer,
  assignSupporting,
  addComment,
  resolveComment,
  reopenComment,
  deleteComment,
  createTask,
  createTaskFromFinding,
  updateTask,
  approve,
  requestChanges,
  getActivity,
  getCompanyWorkflowOverview,
} from './repository.js'
