import { MOCK_SETTINGS } from '../data/mockSettings.js'
import { makeSettings } from '../models/settings.js'

/**
 * In-memory backing store for studio settings.
 *
 * Single record rather than a collection. Resets on reload: no backend, no
 * localStorage. This is the only settings module that a real API would replace.
 */

/** @type {import('../models/settings.js').Settings} */
let record = makeSettings(MOCK_SETTINGS)

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

export function get() {
  return clone(record)
}

export function set(next) {
  record = clone(next)
  return clone(record)
}

export function reset() {
  record = makeSettings(MOCK_SETTINGS)
}
