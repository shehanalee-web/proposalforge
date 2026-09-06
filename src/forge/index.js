/**
 * H14 Phase 14.7 — Studio Forge actions public API.
 *
 * Studio-only intelligence layer over living, interactions, and follow-ups.
 * Does not own proposal content or client living UI.
 */

export {
  DEFAULT_COMPANY_ID,
  FORGE_ACTION,
  FORGE_ACTIONS,
  FORGE_CAPABILITIES,
  FORGE_ISOLATION_COMPANY_ID,
} from './types.js'

export { buildForgeLivingSummary } from './summary.js'
export { draftFollowupMessage, suggestForgeNextAction } from './suggest.js'

export {
  clientForgeApiDenied,
  collectForgeContext,
  getForgeProposalView,
  runForgeAction,
} from './repository.js'
