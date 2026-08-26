import { makeSettings, validateSettings } from '../models/settings.js'
import { ValidationError } from './errors.js'
import * as store from './settingsStore.js'

/**
 * Public data access layer for studio settings.
 *
 * Async and returning plain data so a future account API is a change inside
 * this file only.
 */

const MOCK_LATENCY_MS = 200

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * @returns {Promise<import('../models/settings.js').Settings>}
 */
export async function fetchSettings() {
  await delay()
  return store.get()
}

/**
 * Apply a partial update to the studio profile.
 *
 * Currency is always reset by `makeSettings`, so callers cannot change it.
 *
 * @param {Partial<import('../models/settings.js').Settings>} changes
 * @returns {Promise<import('../models/settings.js').Settings>}
 * @throws {ValidationError}
 */
export async function updateSettings(changes = {}) {
  const updated = makeSettings({
    ...store.get(),
    ...changes,
    updatedAt: new Date().toISOString(),
  })

  const errors = validateSettings(updated)

  if (errors.length > 0) {
    throw new ValidationError('Settings are not valid.', errors)
  }

  await delay()

  return store.set(updated)
}

export function resetSettings() {
  store.reset()
}
