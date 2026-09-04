/**
 * Improvement-action vocab. Providers register by id so OpenAI, Anthropic,
 * Gemini or a local model can replace the deterministic generator without
 * touching the sidebar UI.
 */

export const IMPROVE_PROVIDER = Object.freeze({
  DETERMINISTIC: 'deterministic',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  LOCAL: 'local',
})

export const IMPROVE_PROVIDERS = Object.freeze(Object.values(IMPROVE_PROVIDER))

export const IMPROVE_PATCH = Object.freeze({
  FILL_BLOCK: 'fill-block',
  APPEND_BODY: 'append-body',
  MOVE_AFTER: 'move-after',
})

export const IMPROVE_PATCHES = Object.freeze(Object.values(IMPROVE_PATCH))
