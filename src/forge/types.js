/**
 * H14 Phase 14.7 — Studio Forge action contracts.
 *
 * Forge is a studio intelligence / action layer over living + H12 + H13.
 * It is not a client chatbot, not a second editor, and not an H15 vendor close.
 */

export const FORGE_ACTION = Object.freeze({
  SUMMARIZE_LIVING_STATE: 'summarize_living_state',
  SUGGEST_NEXT_ACTION: 'suggest_next_action',
  CREATE_FOLLOWUP: 'create_followup',
  UPDATE_FOLLOWUP: 'update_followup',
  DRAFT_FOLLOWUP_MESSAGE: 'draft_followup_message',
})

export const FORGE_ACTIONS = Object.freeze(Object.values(FORGE_ACTION))

/**
 * Honest capability surface for Phase 14.7.
 * proposalDrafts stays false — this phase does not auto-apply proposal edits.
 * llm stays false — summaries and suggestions are deterministic.
 */
export const FORGE_CAPABILITIES = Object.freeze({
  studioActions: true,
  livingSummary: true,
  followupActions: true,
  draftFollowupMessage: true,
  proposalDrafts: false,
  clientForge: false,
  rive: false,
  llm: false,
  emailDelivery: false,
  whatsapp: false,
  crm: false,
  digitalSignature: false,
  paymentProcessing: false,
  thirdPartyIntegrations: false,
})

export { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
export { WORKFLOW_ISOLATION_COMPANY_ID as FORGE_ISOLATION_COMPANY_ID } from '../workflow/types.js'
