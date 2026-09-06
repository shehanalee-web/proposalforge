/**
 * H14 Phase 14.7–14.8 — Studio Forge actions + Rive presentation contract.
 *
 * Studio-only intelligence layer over living, interactions, and follow-ups.
 * Does not own proposal content or client living UI.
 * Rive artwork is optional; the fallback shell always works.
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
  FORGE_RIVE_ASSET_PATH,
  FORGE_RIVE_STATE,
  FORGE_RIVE_STATES,
  FORGE_RIVE_STATE_LABEL,
  mapForgeStatusToRiveInputs,
  resolveForgePresentation,
  resolveForgePresentationState,
  resolveForgeRiveAsset,
  shouldUseForgeRive,
} from './riveContract.js'

export {
  clientForgeApiDenied,
  collectForgeContext,
  getForgeProposalView,
  runForgeAction,
} from './repository.js'
