import {
  fontStackFor,
  makeBrandKit,
  validateBrandKit,
} from '../models/brandKit.js'
import { makeSettings } from '../models/settings.js'
import { ValidationError } from './errors.js'
import * as store from './brandKitStore.js'
import * as settingsStore from './settingsStore.js'

/**
 * Public data access layer for Company Identity.
 *
 * Async and returning plain data so a future Brand Kit API is a change inside
 * this file only. Saving identity also mirrors name, email and description
 * onto studio settings so existing surfaces stay in sync.
 */

const MOCK_LATENCY_MS = 200

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function withResolvedType(kit) {
  const stack = fontStackFor(kit.typography.fontFamily)

  return makeBrandKit({
    ...kit,
    contact: {
      ...kit.contact,
      legalName: kit.companyName.trim() || kit.contact.legalName,
    },
    typography: {
      ...kit.typography,
      headingFont: stack,
      bodyFont: stack,
    },
    socialLinks: kit.socialLinks.filter((link) => link.handle.trim()),
  })
}

function syncSettingsFromKit(kit) {
  const current = settingsStore.get()

  settingsStore.set(
    makeSettings({
      ...current,
      studioName: kit.companyName.trim() || current.studioName,
      contactEmail: kit.contact.email.trim() || current.contactEmail,
      about: kit.description.trim() || current.about,
      updatedAt: kit.updatedAt,
    }),
  )
}

/**
 * @returns {Promise<import('../models/brandKit.js').BrandKit>}
 */
export async function fetchBrandKit() {
  await store.ready()
  await delay()
  return store.get()
}

/**
 * @param {Partial<import('../models/brandKit.js').BrandKit>} changes
 * @returns {Promise<import('../models/brandKit.js').BrandKit>}
 * @throws {ValidationError}
 */
export async function updateBrandKit(changes = {}) {
  await store.ready()
  const updated = withResolvedType(
    makeBrandKit({
      ...store.get(),
      ...changes,
      updatedAt: new Date().toISOString(),
    }),
  )

  const errors = validateBrandKit(updated)

  if (errors.length > 0) {
    throw new ValidationError('Brand Kit is not valid.', errors)
  }

  await delay()

  const saved = await store.set(updated)
  syncSettingsFromKit(saved)
  return saved
}

export async function resetBrandKit() {
  await store.reset()
}
