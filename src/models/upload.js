import { createRecordId } from './ids.js'
import { STORAGE_PROVIDER } from '../storage/providers.js'

/**
 * Proposal-scoped uploads. Files never enter the global Asset Library.
 */

export const UPLOAD_KIND = Object.freeze({
  IMAGE: 'image',
  PDF: 'pdf',
  DOCUMENT: 'document',
  SPREADSHEET: 'spreadsheet',
  ARCHIVE: 'archive',
  DESIGN: 'design',
  CAD: 'cad',
  VIDEO: 'video',
  OTHER: 'other',
})

export const UPLOAD_KINDS = Object.freeze(Object.values(UPLOAD_KIND))

export const UPLOAD_ACTOR = Object.freeze({
  CLIENT: 'client',
  STUDIO: 'studio',
})

export const PROPOSAL_UPLOAD_MAX_BYTES = 48 * 1024 * 1024

export const PROPOSAL_UPLOAD_EXTENSIONS = Object.freeze([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'zip',
  'ai',
  'eps',
  'psd',
  'dwg',
  'dxf',
  'step',
  'stp',
  'stl',
  'obj',
  'fbx',
  'mp4',
  'mov',
])

export const PROPOSAL_UPLOAD_ACCEPT = PROPOSAL_UPLOAD_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(',')

const KIND_BY_EXT = {
  jpg: UPLOAD_KIND.IMAGE,
  jpeg: UPLOAD_KIND.IMAGE,
  png: UPLOAD_KIND.IMAGE,
  gif: UPLOAD_KIND.IMAGE,
  webp: UPLOAD_KIND.IMAGE,
  svg: UPLOAD_KIND.IMAGE,
  pdf: UPLOAD_KIND.PDF,
  doc: UPLOAD_KIND.DOCUMENT,
  docx: UPLOAD_KIND.DOCUMENT,
  xls: UPLOAD_KIND.SPREADSHEET,
  xlsx: UPLOAD_KIND.SPREADSHEET,
  zip: UPLOAD_KIND.ARCHIVE,
  ai: UPLOAD_KIND.DESIGN,
  eps: UPLOAD_KIND.DESIGN,
  psd: UPLOAD_KIND.DESIGN,
  dwg: UPLOAD_KIND.CAD,
  dxf: UPLOAD_KIND.CAD,
  step: UPLOAD_KIND.CAD,
  stp: UPLOAD_KIND.CAD,
  stl: UPLOAD_KIND.CAD,
  obj: UPLOAD_KIND.CAD,
  fbx: UPLOAD_KIND.CAD,
  mp4: UPLOAD_KIND.VIDEO,
  mov: UPLOAD_KIND.VIDEO,
}

/**
 * @param {string} name
 * @returns {string}
 */
export function fileExtension(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : ''
}

/**
 * @param {string} name
 * @param {string} [mimeType]
 */
export function uploadKindFromFile(name, mimeType = '') {
  const ext = fileExtension(name)
  if (KIND_BY_EXT[ext]) return KIND_BY_EXT[ext]
  if (String(mimeType).startsWith('image/')) return UPLOAD_KIND.IMAGE
  if (String(mimeType).startsWith('video/')) return UPLOAD_KIND.VIDEO
  return UPLOAD_KIND.OTHER
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isAllowedProposalUpload(name) {
  return PROPOSAL_UPLOAD_EXTENSIONS.includes(fileExtension(name))
}

export function isPreviewableUpload(upload) {
  const kind = upload?.kind
  return kind === UPLOAD_KIND.IMAGE || kind === UPLOAD_KIND.PDF
}

export function uploadIconName(kind) {
  switch (kind) {
    case UPLOAD_KIND.IMAGE:
      return 'fileImage'
    case UPLOAD_KIND.PDF:
    case UPLOAD_KIND.DOCUMENT:
    case UPLOAD_KIND.SPREADSHEET:
      return 'filePdf'
    case UPLOAD_KIND.VIDEO:
      return 'fileVideo'
    case UPLOAD_KIND.ARCHIVE:
      return 'fileZip'
    case UPLOAD_KIND.CAD:
    case UPLOAD_KIND.DESIGN:
      return 'fileCad'
    default:
      return 'upload'
  }
}

/**
 * Architecture-only version row. Replacing a file appends one of these.
 *
 * @typedef {object} UploadVersion
 * @property {string} id
 * @property {number} number
 * @property {string} storageKey
 * @property {string} url
 * @property {number} sizeBytes
 * @property {string} createdAt
 */

export function makeUploadVersion(input = {}) {
  return {
    id: input.id ?? createRecordId('upv'),
    number: Number(input.number ?? 1),
    storageKey: input.storageKey ?? '',
    url: input.url ?? '',
    sizeBytes: Number(input.sizeBytes ?? 0),
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

/**
 * Future folder grouping. Every proposal starts with a root folder.
 *
 * @typedef {object} UploadFolder
 * @property {string} id
 * @property {string} proposalId
 * @property {string} name
 * @property {string | null} parentId
 */

export function makeUploadFolder(input = {}) {
  return {
    id: input.id ?? createRecordId('fld'),
    proposalId: input.proposalId ?? '',
    name: input.name ?? 'Files',
    parentId: input.parentId ?? null,
  }
}

/**
 * @typedef {object} ProposalUpload
 * @property {string} id
 * @property {string} proposalId
 * @property {string} folderId
 * @property {string} name
 * @property {string} mimeType
 * @property {number} sizeBytes
 * @property {string} extension
 * @property {string} kind
 * @property {string} storageProvider
 * @property {string} storageKey
 * @property {string} url
 * @property {number} currentVersion
 * @property {UploadVersion[]} versions
 * @property {'client' | 'studio'} uploadedBy
 * @property {string} uploadedByName
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string | null} replacedAt
 */

export function makeProposalUpload(input = {}) {
  const name = String(input.name ?? '').trim() || 'file'
  const now = input.createdAt ?? new Date().toISOString()
  const version = makeUploadVersion({
    ...(input.versions?.[0] ?? {}),
    number: 1,
    storageKey: input.storageKey,
    url: input.url,
    sizeBytes: input.sizeBytes,
    createdAt: now,
  })
  const versions = Array.isArray(input.versions) && input.versions.length
    ? input.versions.map(makeUploadVersion)
    : [version]

  return {
    id: input.id ?? createRecordId('upl'),
    proposalId: input.proposalId ?? '',
    folderId: input.folderId ?? null,
    name,
    mimeType: input.mimeType ?? '',
    sizeBytes: Number(input.sizeBytes ?? 0),
    extension: input.extension ?? fileExtension(name),
    kind: UPLOAD_KINDS.includes(input.kind)
      ? input.kind
      : uploadKindFromFile(name, input.mimeType),
    storageProvider: input.storageProvider ?? STORAGE_PROVIDER.LOCAL,
    storageKey: input.storageKey ?? '',
    url: input.url ?? '',
    currentVersion: Number(input.currentVersion ?? versions.length),
    versions,
    uploadedBy: input.uploadedBy === UPLOAD_ACTOR.STUDIO
      ? UPLOAD_ACTOR.STUDIO
      : UPLOAD_ACTOR.CLIENT,
    uploadedByName: String(input.uploadedByName ?? '').trim() || 'Client',
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
    replacedAt: input.replacedAt ?? null,
  }
}

export function listActiveUploads(uploads = []) {
  return (uploads ?? []).map(makeProposalUpload)
}

export function formatUploadSize(bytes) {
  const size = Number(bytes ?? 0)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}
