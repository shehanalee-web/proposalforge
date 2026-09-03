import { MOCK_BRAND_KIT } from '../data/mockBrandKit.js'
import { makeAssetRef, makeBrandKit } from '../models/brandKit.js'
import { persistableUrl } from '../utils/publicUrl.js'
import { findById as findAssetById, load as loadAssets } from './assetStore.js'

/**
 * Brand Kit store. Persisted to `data/brand-kit.json`. Logo refs keep asset
 * ids; display URLs are resolved from the Asset Library on read.
 */

/** @type {import('../models/brandKit.js').BrandKit | null} */
let record = null
let pending = null

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function persistableRef(ref) {
  const next = makeAssetRef(ref)
  return {
    assetId: next.assetId,
    url: persistableUrl(next.url),
  }
}

function persistableKit(kit) {
  const base = makeBrandKit(kit)

  return makeBrandKit({
    ...base,
    logos: {
      primary: persistableRef(base.logos.primary),
      light: persistableRef(base.logos.light),
      dark: persistableRef(base.logos.dark),
      favicon: persistableRef(base.logos.favicon),
      cover: persistableRef(base.logos.cover),
    },
    signature: {
      ...base.signature,
      image: persistableRef(base.signature.image),
    },
    teamMembers: base.teamMembers.map((member) => ({
      ...member,
      portrait: persistableRef(member.portrait),
    })),
    testimonials: base.testimonials.map((item) => ({
      ...item,
      portrait: persistableRef(item.portrait),
    })),
  })
}

function hydrateRef(ref) {
  const next = makeAssetRef(ref)
  if (!next.assetId) {
    return { ...next, url: persistableUrl(next.url) }
  }

  const asset = findAssetById(next.assetId)
  return {
    assetId: next.assetId,
    url: asset?.url || persistableUrl(next.url),
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

async function persist() {
  if (!record) return

  const response = await fetch('/api/brand-kit', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(persistableKit(record)),
  })

  if (!response.ok) {
    throw new Error('Could not persist Brand Kit.')
  }
}

export async function ready() {
  await loadAssets()
  if (record) return
  if (pending) return pending

  pending = (async () => {
    try {
      const response = await fetch('/api/brand-kit')
      if (response.ok) {
        const payload = await response.json()
        if (payload?.record) {
          record = persistableKit(payload.record)
          pending = null
          return
        }
      }
    } catch {
      // Fall through to the seed kit.
    }

    record = makeBrandKit(MOCK_BRAND_KIT)
    pending = null
  })()

  return pending
}

export function get() {
  return hydrate(clone(record ?? makeBrandKit(MOCK_BRAND_KIT)))
}

export async function set(next) {
  record = persistableKit(next)
  await persist()
  return hydrate(clone(record))
}

export async function reset() {
  record = makeBrandKit(MOCK_BRAND_KIT)
  await persist()
}
