import { MOCK_BRAND_KIT } from '../data/mockBrandKit.js'
import { makeAssetRef, makeBrandKit } from '../models/brandKit.js'
import { findById as findAssetById } from './assetStore.js'

/**
 * In-memory backing store for the workspace Brand Kit.
 *
 * Single record rather than a collection. Resets on reload: no backend, no
 * localStorage. This is the only Brand Kit module a real API would replace.
 */

/** @type {import('../models/brandKit.js').BrandKit} */
let record = makeBrandKit(MOCK_BRAND_KIT)

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function hydrateRef(ref) {
  const next = makeAssetRef(ref)
  if (!next.assetId) return next

  const asset = findAssetById(next.assetId)
  return {
    assetId: next.assetId,
    url: asset?.url || next.url || '',
  }
}

function hydrate(kit) {
  const base = makeBrandKit(kit)

  return makeBrandKit({
    ...base,
    logos: {
      primary: hydrateRef(base.logos.primary),
      light: hydrateRef(base.logos.light),
      dark: hydrateRef(base.logos.dark),
      favicon: hydrateRef(base.logos.favicon),
      cover: hydrateRef(base.logos.cover),
    },
    signature: {
      ...base.signature,
      image: hydrateRef(base.signature.image),
    },
    teamMembers: base.teamMembers.map((member) => ({
      ...member,
      portrait: hydrateRef(member.portrait),
    })),
    testimonials: base.testimonials.map((item) => ({
      ...item,
      portrait: hydrateRef(item.portrait),
    })),
  })
}

export function get() {
  return hydrate(clone(record))
}

export function set(next) {
  record = clone(makeBrandKit(next))
  return hydrate(clone(record))
}

export function reset() {
  record = makeBrandKit(MOCK_BRAND_KIT)
}
