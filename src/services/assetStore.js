/**
 * In-memory backing store for uploaded files.
 *
 * Follows the same pattern as `proposalStore`: this is the only module that
 * holds blobs, and the only one a real storage backend would replace.
 * Object URLs are created once per asset so renderers can keep using a URL
 * string — the same contract as remote files.
 */

/** @typedef {import('../models/asset.js').Asset} Asset */

/**
 * @typedef {object} StoredAsset
 * @property {Asset} meta
 * @property {Blob} blob
 * @property {Blob | null} thumbnailBlob
 * @property {string} url
 * @property {string} thumbnailUrl
 */

/** @type {Map<string, StoredAsset>} */
const records = new Map()

function cloneMeta(meta, url, thumbnailUrl) {
  return {
    ...meta,
    url,
    thumbnailUrl: thumbnailUrl || url,
  }
}

/**
 * @param {Asset} meta
 * @param {Blob} blob
 * @param {Blob | null} thumbnailBlob
 * @returns {Asset}
 */
export function insert(meta, blob, thumbnailBlob = null) {
  const url = URL.createObjectURL(blob)
  const thumbnailUrl = thumbnailBlob
    ? URL.createObjectURL(thumbnailBlob)
    : url

  records.set(meta.id, {
    meta: { ...meta },
    blob,
    thumbnailBlob,
    url,
    thumbnailUrl,
  })

  return cloneMeta(meta, url, thumbnailUrl)
}

/**
 * @param {string} id
 * @returns {Asset | undefined}
 */
export function findById(id) {
  const found = records.get(id)
  return found
    ? cloneMeta(found.meta, found.url, found.thumbnailUrl)
    : undefined
}

/**
 * @returns {Asset[]}
 */
export function all() {
  return [...records.values()].map((entry) =>
    cloneMeta(entry.meta, entry.url, entry.thumbnailUrl),
  )
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function remove(id) {
  const found = records.get(id)

  if (!found) return false

  URL.revokeObjectURL(found.url)
  if (found.thumbnailUrl !== found.url) {
    URL.revokeObjectURL(found.thumbnailUrl)
  }

  records.delete(id)
  return true
}

export function reset() {
  for (const id of [...records.keys()]) {
    remove(id)
  }
}
