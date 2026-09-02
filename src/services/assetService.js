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

async function postBytes(path, file, extraHeaders = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...extraHeaders,
    },
    body: file,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ValidationError(payload.message || 'Could not store that file.', [
      { field: 'file', message: payload.message || 'Upload failed.' },
    ])
  }

  return payload
}

/**
 * Upload a local file into persistent storage (`public/uploads`).
 *
 * Returns a library record whose `url` is a stable public path. Proposals
 * store `asset.id`; renderers resolve that id back to `url` on load.
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

  const created = await postBytes('/api/assets', file, {
    'X-File-Name': encodeURIComponent(file.name?.trim() || 'Untitled'),
  })

  let stored = makeAsset({
    ...created,
    kind: created.kind || kindFromFile(file),
    alt: options.alt ?? '',
    caption: options.caption ?? '',
  })

  if (thumbnailBlob && thumbnailBlob !== file) {
    stored = makeAsset(
      await postBytes(`/api/assets/${stored.id}/thumbnail`, thumbnailBlob),
    )
  }

  const errors = validateAsset(stored)

  if (errors.length > 0) {
    throw new ValidationError('Asset is not valid.', errors)
  }

  store.upsert(stored)
  onProgress?.(100)
  return stored
}

/**
 * @param {string} id
 * @returns {Promise<import('../models/asset.js').Asset>}
 */
export async function fetchAssetById(id) {
  await store.load()
  const asset = store.findById(id)

  if (!asset) {
    throw new ValidationError(`No asset found with id "${id}".`, [
      { field: 'id', message: 'Asset not found.' },
    ])
  }

  return asset
}

export async function listAssets() {
  await store.load()
  return store.all()
}

export const IMAGE_FILE_ACCEPT = IMAGE_ACCEPT
