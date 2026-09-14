import { ASSET_KIND } from '../../models/asset.js'
import { normalizeIdList } from '../../models/ids.js'
import { isImageMime } from '../../utils/imageThumbnail.js'

/**
 * Existing ImageUpload consumer contract: pass the public URL and the
 * library record. Does not upload, clone, or mutate the asset.
 *
 * @param {(url: string, asset: import('../../models/asset.js').Asset) => void} onChange
 * @param {import('../../models/asset.js').Asset} asset
 */
export function selectLibraryAsset(onChange, asset) {
  onChange(asset.url, asset)
}

/**
 * Toggle a library id in a service.assetIds-style list. First-seen order is
 * kept; duplicates are not added.
 *
 * @param {string[]} [ids]
 * @param {string} id
 * @returns {string[]}
 */
export function toggleAssetId(ids, id) {
  const current = normalizeIdList(ids)
  const nextId = String(id ?? '').trim()
  if (!nextId) return current
  if (current.includes(nextId)) {
    return current.filter((item) => item !== nextId)
  }
  return normalizeIdList([...current, nextId])
}

/**
 * Image fields show images/renders. File fields (attachments, service defaults)
 * include PDFs and every other library kind.
 *
 * @param {import('../../models/asset.js').Asset} [asset]
 * @param {'image' | 'file'} [variant]
 */
export function assetMatchesVariant(asset, variant = 'image') {
  if (!asset) return false
  if (variant === 'file') return true
  return (
    asset.kind === ASSET_KIND.IMAGE ||
    asset.kind === ASSET_KIND.RENDER ||
    isImageMime(asset.mimeType)
  )
}

/**
 * @param {import('../../models/asset.js').Asset[]} [assets]
 * @param {{ variant?: 'image' | 'file', query?: string }} [options]
 */
export function filterLibraryAssets(assets = [], options = {}) {
  const variant = options.variant ?? 'image'
  const query = String(options.query ?? '').trim().toLowerCase()

  return assets.filter((asset) => {
    if (!assetMatchesVariant(asset, variant)) return false
    if (!query) return true
    return `${asset.name} ${asset.kind} ${asset.id}`.toLowerCase().includes(query)
  })
}
