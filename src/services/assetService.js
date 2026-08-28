import { ASSET_KIND, makeAsset, validateAsset } from '../models/asset.js'
import { ValidationError } from './errors.js'
import { generateThumbnail, isImageFile } from '../utils/imageThumbnail.js'
import * as store from './assetStore.js'

/** Simulated network delay so upload progress is visible. */
export const MOCK_LATENCY_MS = 180

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml'

/**
 * @param {(value: number) => void} [onProgress]
 * @param {number} from
 * @param {number} to
 * @param {number} [ms]
 */
function animateProgress(onProgress, from, to, ms = MOCK_LATENCY_MS) {
  if (!onProgress) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  return new Promise((resolve) => {
    const started = performance.now()

    function tick(now) {
      const elapsed = now - started
      const ratio = Math.min(1, elapsed / ms)
      onProgress(Math.round(from + (to - from) * ratio))

      if (ratio < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(tick)
  })
}

function kindFromFile(file) {
  if (isImageFile(file)) return ASSET_KIND.IMAGE
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return ASSET_KIND.DOCUMENT
  }
  return ASSET_KIND.OTHER
}

/**
 * Upload a local file into the asset store.
 *
 * Returns a record whose `url` and `thumbnailUrl` can be stored on a proposal
 * the same way a remote URL would be. Existing http(s) values stay valid.
 *
 * @param {File} file
 * @param {{
 *   onProgress?: (value: number) => void,
 *   alt?: string,
 *   caption?: string,
 * }} [options]
 * @returns {Promise<import('../models/asset.js').Asset>}
 */
export async function uploadAsset(file, options = {}) {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new ValidationError('Choose a file to upload.', [
      { field: 'file', message: 'A file is required.' },
    ])
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError('That file is too large.', [
      {
        field: 'file',
        message: 'Images and documents must be 12 MB or smaller.',
      },
    ])
  }

  const { onProgress } = options
  onProgress?.(8)
  await animateProgress(onProgress, 8, 55)

  let thumbnailBlob = null

  try {
    thumbnailBlob = await generateThumbnail(file)
  } catch {
    thumbnailBlob = isImageFile(file) ? file : null
  }
  await animateProgress(onProgress, 55, 88)

  const asset = makeAsset({
    name: file.name?.trim() || 'Untitled',
    kind: kindFromFile(file),
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    alt: options.alt ?? '',
    caption: options.caption ?? '',
  })

  const errors = validateAsset(asset)

  if (errors.length > 0) {
    throw new ValidationError('Asset is not valid.', errors)
  }

  const stored = store.insert(asset, file, thumbnailBlob)
  onProgress?.(100)
  return stored
}

/**
 * @param {string} id
 * @returns {Promise<import('../models/asset.js').Asset>}
 */
export async function fetchAssetById(id) {
  const asset = store.findById(id)

  if (!asset) {
    throw new ValidationError(`No asset found with id "${id}".`, [
      { field: 'id', message: 'Asset not found.' },
    ])
  }

  return asset
}

export function listAssets() {
  return store.all()
}

export const IMAGE_FILE_ACCEPT = IMAGE_ACCEPT
