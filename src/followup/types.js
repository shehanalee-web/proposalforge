/**
 * Horizon 13 Proposal Follow-up identifiers.
 *
 * Operational layer above Proposal, Workflow, Portal, and Interactions.
 * Does not own those state machines or proposal content.
 */

export const FOLLOWUP_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed',
})

export const FOLLOWUP_STATUSES = Object.freeze(Object.values(FOLLOWUP_STATUS))

export const FOLLOWUP_REASON = Object.freeze({
  NEVER_OPENED: 'never_opened',
  AWAITING_RESPONSE: 'awaiting_response',
  CLIENT_INTERACTION: 'client_interaction',
  CHANGES_REQUESTED: 'changes_requested',
  EXPIRING: 'expiring',
  ACCEPTED_NEXT_STEP: 'accepted_next_step',
  OVERDUE_TASK: 'overdue_task',
  MANUAL: 'manual',
})

export const FOLLOWUP_REASONS = Object.freeze(Object.values(FOLLOWUP_REASON))

export const FOLLOWUP_SOURCE = Object.freeze({
  PROPOSAL: 'proposal',
  WORKFLOW: 'workflow',
  PORTAL: 'portal',
  INTERACTION: 'interaction',
  EXPIRY: 'expiry',
  MANUAL: 'manual',
})

export const FOLLOWUP_SOURCES = Object.freeze(Object.values(FOLLOWUP_SOURCE))

export const FOLLOWUP_PRIORITY = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
})

export const FOLLOWUP_PRIORITIES = Object.freeze(Object.values(FOLLOWUP_PRIORITY))

export const FOLLOWUP_EVENT = Object.freeze({
  CREATED: 'followup.created',
  STARTED: 'followup.started',
  COMPLETED: 'followup.completed',
  DISMISSED: 'followup.dismissed',
  ASSIGNED: 'followup.assigned',
  SCHEDULED: 'followup.scheduled',
  DUE: 'followup.due',
  SIGNAL_RESOLVED: 'followup.signal_resolved',
})

export const FOLLOWUP_EVENTS = Object.freeze(Object.values(FOLLOWUP_EVENT))

/**
 * Local scheduling infrastructure only. No delivery, workers, or vendors.
 * `automatedReminders` means follow-up reminders can be represented and scheduled.
 */
export const FOLLOWUP_CAPABILITIES = Object.freeze({
  automatedReminders: true,
  emailDelivery: false,
  whatsapp: false,
  crm: false,
  llm: false,
  backgroundWorkers: false,
  thirdPartyIntegrations: false,
  digitalSignature: false,
  paymentProcessing: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export { WORKFLOW_ISOLATION_COMPANY_ID as FOLLOWUP_ISOLATION_COMPANY_ID } from '../workflow/types.js'
