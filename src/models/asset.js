import { createRecordId } from './ids.js'

/**
 * Asset Library model.
 *
 * Files live here. Proposals, services, Brand Kit and content blocks store
 * asset ids — never embedded binaries. Layouts decide crop and size.
 */

export const ASSET_KIND = Object.freeze({
  IMAGE: 'image',
  RENDER: 'render',
  VIDEO: 'video',
  DOCUMENT: 'document',
  CERTIFICATE: 'certificate',
  OTHER: 'other',
})

export const ASSET_KINDS = Object.freeze(Object.values(ASSET_KIND))

/**
 * @typedef {object} Asset
 * @property {string} id
 * @property {string} name
 * @property {string} kind
 * @property {string} mimeType
 * @property {string} url
 * @property {string} alt
 * @property {string} caption
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<Asset>} [input]
 * @returns {Asset}
 */
export function makeAsset(input = {}) {
  const timestamp = new Date().toISOString()

  return {
    id: input.id ?? createRecordId('asset'),
    name: input.name ?? '',
    kind: input.kind ?? ASSET_KIND.IMAGE,
    mimeType: input.mimeType ?? '',
    url: input.url ?? '',
    alt: input.alt ?? '',
    caption: input.caption ?? '',
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

/**
 * @param {Partial<Asset>} asset
 * @returns {{ field: string, message: string }[]}
 */
export function validateAsset(asset) {
  const errors = []

  if (!asset.name || !asset.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' })
  }

  if (asset.kind && !ASSET_KINDS.includes(asset.kind)) {
    errors.push({
      field: 'kind',
      message: `Kind must be one of: ${ASSET_KINDS.join(', ')}.`,
    })
  }

  return errors
}
