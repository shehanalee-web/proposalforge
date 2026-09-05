import { LIVING_EVENTS } from './types.js'

const listeners = new Set()

/**
 * Living event extension point.
 *
 * Phase 1 does not persist, process, or forward events to follow-up.
 * Later H14 phases subscribe here and write into the existing activity /
 * analytics pipeline — not a second analytics product.
 *
 * @param {(event: object) => void} listener
 * @returns {() => void}
 */
export function onLivingEvent(listener) {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetLivingEventListeners() {
  listeners.clear()
}

/**
 * @param {string} type
 * @param {object} [payload]
 */
export function emitLivingEvent(type, payload = {}) {
  if (!LIVING_EVENTS.includes(type)) return null

  const event = {
    type,
    at: new Date().toISOString(),
    proposalId: payload.proposalId ?? null,
    shareToken: payload.shareToken ?? null,
    blockId: payload.blockId ?? null,
    payload,
  }

  for (const listener of listeners) {
    listener(event)
  }

  return event
}
