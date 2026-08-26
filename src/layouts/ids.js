/**
 * Layout identifiers.
 *
 * Stored on proposals and templates as a string. Adding a layout later means
 * registering a new id here and a definition in `registry.js` — the proposal
 * model does not change.
 */
export const LAYOUT_ID = Object.freeze({
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
})

export const DEFAULT_LAYOUT_ID = LAYOUT_ID.PORTRAIT

export const LAYOUT_IDS = Object.freeze(Object.values(LAYOUT_ID))
