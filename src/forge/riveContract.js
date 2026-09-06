/**
 * H14 Phase 14.8 — Forge Rive presentation contract.
 *
 * Documents the studio assistant state-machine mapping and resolves whether
 * the UI should use an optional .riv runtime or the non-Rive fallback shell.
 *
 * Forge Rive is studio chrome only. It is not a client living chatbot,
 * not Forge Creation, and not a new persistence domain.
 * A .riv asset is optional and never required for Forge actions to work.
 */

import { FORGE_CAPABILITIES } from './types.js'

/**
 * Product-facing assistant states (H14 §17).
 * These map 1:1 to Rive state-machine inputs when a .riv asset is present.
 */
export const FORGE_RIVE_STATE = Object.freeze({
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  WORKING: 'working',
  SUCCESS: 'success',
  WARNING: 'warning',
  PRESENTING: 'presenting',
})

export const FORGE_RIVE_STATES = Object.freeze(Object.values(FORGE_RIVE_STATE))

export const FORGE_RIVE_STATE_LABEL = Object.freeze({
  [FORGE_RIVE_STATE.IDLE]: 'Ready',
  [FORGE_RIVE_STATE.LISTENING]: 'Listening',
  [FORGE_RIVE_STATE.THINKING]: 'Thinking',
  [FORGE_RIVE_STATE.WORKING]: 'Working',
  [FORGE_RIVE_STATE.SUCCESS]: 'Done',
  [FORGE_RIVE_STATE.WARNING]: 'Needs attention',
  [FORGE_RIVE_STATE.PRESENTING]: 'Presenting',
})

/**
 * Documented public path for a future Forge assistant .riv file.
 * H14.8 does not ship the asset; resolveForgeRiveAsset returns null unless
 * an integrator confirms the file exists.
 */
export const FORGE_RIVE_ASSET_PATH = '/assets/forge/assistant.riv'

/**
 * Map a product status string to Rive state-machine boolean/number inputs.
 * Safe to call without a Rive runtime — used by the fallback shell and by a
 * future Rive player.
 */
export function mapForgeStatusToRiveInputs(state) {
  const normalized = FORGE_RIVE_STATES.includes(state)
    ? state
    : FORGE_RIVE_STATE.IDLE

  return Object.freeze({
    state: normalized,
    isIdle: normalized === FORGE_RIVE_STATE.IDLE,
    isListening: normalized === FORGE_RIVE_STATE.LISTENING,
    isThinking: normalized === FORGE_RIVE_STATE.THINKING,
    isWorking: normalized === FORGE_RIVE_STATE.WORKING,
    isSuccess: normalized === FORGE_RIVE_STATE.SUCCESS,
    isWarning: normalized === FORGE_RIVE_STATE.WARNING,
    isPresenting: normalized === FORGE_RIVE_STATE.PRESENTING,
  })
}

/**
 * Optional asset resolution. Never throws. Never invents a binary.
 * @param {{ exists?: boolean, path?: string }} [options]
 * @returns {string | null}
 */
export function resolveForgeRiveAsset(options = {}) {
  if (!options.exists) return null
  const path = String(options.path ?? FORGE_RIVE_ASSET_PATH).trim()
  return path || null
}

/**
 * Whether the Rive player may be used. Requires capability + asset + motion OK.
 */
export function shouldUseForgeRive({
  assetUrl = null,
  reducedMotion = false,
  capabilities = FORGE_CAPABILITIES,
} = {}) {
  return Boolean(
    capabilities?.rive === true &&
      assetUrl &&
      !reducedMotion,
  )
}

/**
 * Derive the studio presentation state from Forge action UI signals.
 * Deterministic — no LLM, no persistence.
 */
export function resolveForgePresentationState({
  busy = false,
  error = null,
  resultMessage = '',
  hasSummary = false,
  hasSuggestion = false,
  listening = false,
} = {}) {
  if (error) return FORGE_RIVE_STATE.WARNING
  if (busy) return FORGE_RIVE_STATE.WORKING
  if (listening) return FORGE_RIVE_STATE.LISTENING
  if (resultMessage) return FORGE_RIVE_STATE.SUCCESS
  if (hasSuggestion || hasSummary) return FORGE_RIVE_STATE.PRESENTING
  return FORGE_RIVE_STATE.IDLE
}

/**
 * Full presentation resolution for the studio Forge shell.
 * Always returns a usable fallback plan when Rive is unavailable.
 */
export function resolveForgePresentation({
  busy = false,
  error = null,
  resultMessage = '',
  hasSummary = false,
  hasSuggestion = false,
  listening = false,
  reducedMotion = false,
  assetExists = false,
  assetPath = FORGE_RIVE_ASSET_PATH,
  capabilities = FORGE_CAPABILITIES,
} = {}) {
  const state = resolveForgePresentationState({
    busy,
    error,
    resultMessage,
    hasSummary,
    hasSuggestion,
    listening,
  })
  const assetUrl = resolveForgeRiveAsset({ exists: assetExists, path: assetPath })
  const useRive = shouldUseForgeRive({
    assetUrl,
    reducedMotion,
    capabilities,
  })

  return Object.freeze({
    state,
    label: FORGE_RIVE_STATE_LABEL[state] || FORGE_RIVE_STATE_LABEL[FORGE_RIVE_STATE.IDLE],
    mode: useRive ? 'rive' : 'fallback',
    reducedMotion: Boolean(reducedMotion),
    assetUrl: useRive ? assetUrl : null,
    riveInputs: mapForgeStatusToRiveInputs(state),
    animate: !reducedMotion && state !== FORGE_RIVE_STATE.IDLE,
  })
}
