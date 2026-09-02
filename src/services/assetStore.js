/**
 * Client cache of Asset Library records.
 *
 * Files live on disk under `/uploads/<id>/…`. This module only holds metadata
 * returned by the local uploads API. `url` is always a public path, never a
 * browser object URL.
 */

import { makeAsset } from '../models/asset.js'

/** @type {Map<string, import('../models/asset.js').Asset>} */
const records = new Map()
let loaded = false
let pending = null

function remember(asset) {
  const next = makeAsset(asset)
  records.set(next.id, next)
  return next
}

export async function load() {
  if (loaded) return
  if (pending) return pending

  pending = (async () => {
    try {
      const response = await fetch('/api/assets')
      if (!response.ok) return
      const list = await response.json()
      if (!Array.isArray(list)) return
      records.clear()
      for (const entry of list) remember(entry)
      loaded = true
    } catch {
      loaded = true
    } finally {
      pending = null
    }
  })()

  return pending
}

export function upsert(asset) {
  return remember(asset)
}

export function findById(id) {
  return records.get(id)
}

export function all() {
  return [...records.values()].map((asset) => makeAsset(asset))
}

export function reset() {
  records.clear()
  loaded = false
  pending = null
}
