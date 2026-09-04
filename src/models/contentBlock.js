import { createRecordId } from './ids.js'

/**
 * Content Library — reusable proposal blocks.
 *
 * Proposals store instances that may reference a library id. Editing a
 * library record never rewrites documents already sent; insert copies data
 * and keeps `libraryId` for provenance.
 */

export const CONTENT_BLOCK_TYPE = Object.freeze({
  COVER: 'cover',
  EXECUTIVE_SUMMARY: 'executive-summary',
  RICH_TEXT: 'rich-text',
  GALLERY: 'gallery',
  VIDEO: 'video',
  BEFORE_AFTER: 'before-after',
  PRICING: 'pricing',
  OPTIONAL_PRICING: 'optional-pricing',
  ALTERNATIVES: 'alternatives',
  TABLE: 'table',
  SPECIFICATIONS: 'specifications',
  TECHNICAL_DRAWINGS: 'technical-drawings',
  DOWNLOADS: 'downloads',
  ATTACHMENTS: 'attachments',
  TIMELINE: 'timeline',
  MILESTONES: 'milestones',
  DELIVERABLES: 'deliverables',
  TEAM: 'team',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  WARRANTY: 'warranty',
  TERMS: 'terms',
  SIGNATURE: 'signature',
  APPENDICES: 'appendices',
  COMPANY_PROFILE: 'company-profile',
  MAPS: 'maps',
  QR_CODES: 'qr-codes',
  CUSTOM: 'custom',
})

export const CONTENT_BLOCK_TYPES = Object.freeze(Object.values(CONTENT_BLOCK_TYPE))

export const CONTENT_BLOCK_TYPE_LABELS = Object.freeze({
  [CONTENT_BLOCK_TYPE.COVER]: 'Cover / Hero',
  [CONTENT_BLOCK_TYPE.EXECUTIVE_SUMMARY]: 'Executive summary',
  [CONTENT_BLOCK_TYPE.RICH_TEXT]: 'Rich text',
  [CONTENT_BLOCK_TYPE.GALLERY]: 'Image gallery',
  [CONTENT_BLOCK_TYPE.VIDEO]: 'Video',
  [CONTENT_BLOCK_TYPE.BEFORE_AFTER]: 'Before / after',
  [CONTENT_BLOCK_TYPE.PRICING]: 'Commercials',
  [CONTENT_BLOCK_TYPE.OPTIONAL_PRICING]: 'Optional pricing',
  [CONTENT_BLOCK_TYPE.ALTERNATIVES]: 'Alternatives',
  [CONTENT_BLOCK_TYPE.TABLE]: 'Table',
  [CONTENT_BLOCK_TYPE.SPECIFICATIONS]: 'Specifications',
  [CONTENT_BLOCK_TYPE.TECHNICAL_DRAWINGS]: 'Technical drawings',
  [CONTENT_BLOCK_TYPE.DOWNLOADS]: 'Downloads',
  [CONTENT_BLOCK_TYPE.ATTACHMENTS]: 'Attachments',
  [CONTENT_BLOCK_TYPE.TIMELINE]: 'Timeline',
  [CONTENT_BLOCK_TYPE.MILESTONES]: 'Milestones',
  [CONTENT_BLOCK_TYPE.DELIVERABLES]: 'Deliverables',
  [CONTENT_BLOCK_TYPE.TEAM]: 'Team',
  [CONTENT_BLOCK_TYPE.TESTIMONIALS]: 'Testimonials',
  [CONTENT_BLOCK_TYPE.FAQ]: 'FAQs',
  [CONTENT_BLOCK_TYPE.WARRANTY]: 'Warranty',
  [CONTENT_BLOCK_TYPE.TERMS]: 'Terms & conditions',
  [CONTENT_BLOCK_TYPE.SIGNATURE]: 'Signature',
  [CONTENT_BLOCK_TYPE.APPENDICES]: 'Appendices',
  [CONTENT_BLOCK_TYPE.COMPANY_PROFILE]: 'Company profile',
  [CONTENT_BLOCK_TYPE.MAPS]: 'Maps',
  [CONTENT_BLOCK_TYPE.QR_CODES]: 'QR codes',
  [CONTENT_BLOCK_TYPE.CUSTOM]: 'Custom block',
})

export const BLOCK_CATEGORY = Object.freeze({
  TEXT: 'text',
  MEDIA: 'media',
  COMMERCIAL: 'commercial',
  LAYOUT: 'layout',
  INTERACTIVE: 'interactive',
  LEGAL: 'legal',
  CUSTOM: 'custom',
})

export const BLOCK_CATEGORIES = Object.freeze(Object.values(BLOCK_CATEGORY))

export const BLOCK_CATEGORY_LABELS = Object.freeze({
  [BLOCK_CATEGORY.TEXT]: 'Text',
  [BLOCK_CATEGORY.MEDIA]: 'Media',
  [BLOCK_CATEGORY.COMMERCIAL]: 'Commercial',
  [BLOCK_CATEGORY.LAYOUT]: 'Layout',
  [BLOCK_CATEGORY.INTERACTIVE]: 'Interactive',
  [BLOCK_CATEGORY.LEGAL]: 'Legal',
  [BLOCK_CATEGORY.CUSTOM]: 'Custom',
})

export const LIBRARY_BLOCK_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
})

export const LIBRARY_BLOCK_STATUSES = Object.freeze(
  Object.values(LIBRARY_BLOCK_STATUS),
)

export const LIBRARY_BLOCK_STATUS_LABELS = Object.freeze({
  [LIBRARY_BLOCK_STATUS.DRAFT]: 'Draft',
  [LIBRARY_BLOCK_STATUS.PUBLISHED]: 'Published',
  [LIBRARY_BLOCK_STATUS.ARCHIVED]: 'Archived',
})

const CATEGORY_BY_TYPE = Object.freeze({
  [CONTENT_BLOCK_TYPE.COVER]: BLOCK_CATEGORY.LAYOUT,
  [CONTENT_BLOCK_TYPE.EXECUTIVE_SUMMARY]: BLOCK_CATEGORY.TEXT,
  [CONTENT_BLOCK_TYPE.RICH_TEXT]: BLOCK_CATEGORY.TEXT,
  [CONTENT_BLOCK_TYPE.GALLERY]: BLOCK_CATEGORY.MEDIA,
  [CONTENT_BLOCK_TYPE.VIDEO]: BLOCK_CATEGORY.MEDIA,
  [CONTENT_BLOCK_TYPE.BEFORE_AFTER]: BLOCK_CATEGORY.MEDIA,
  [CONTENT_BLOCK_TYPE.PRICING]: BLOCK_CATEGORY.COMMERCIAL,
  [CONTENT_BLOCK_TYPE.OPTIONAL_PRICING]: BLOCK_CATEGORY.COMMERCIAL,
  [CONTENT_BLOCK_TYPE.ALTERNATIVES]: BLOCK_CATEGORY.COMMERCIAL,
  [CONTENT_BLOCK_TYPE.TABLE]: BLOCK_CATEGORY.COMMERCIAL,
  [CONTENT_BLOCK_TYPE.SPECIFICATIONS]: BLOCK_CATEGORY.TEXT,
  [CONTENT_BLOCK_TYPE.TECHNICAL_DRAWINGS]: BLOCK_CATEGORY.MEDIA,
  [CONTENT_BLOCK_TYPE.DOWNLOADS]: BLOCK_CATEGORY.MEDIA,
  [CONTENT_BLOCK_TYPE.ATTACHMENTS]: BLOCK_CATEGORY.MEDIA,
  [CONTENT_BLOCK_TYPE.TIMELINE]: BLOCK_CATEGORY.LAYOUT,
  [CONTENT_BLOCK_TYPE.MILESTONES]: BLOCK_CATEGORY.LAYOUT,
  [CONTENT_BLOCK_TYPE.DELIVERABLES]: BLOCK_CATEGORY.COMMERCIAL,
  [CONTENT_BLOCK_TYPE.TEAM]: BLOCK_CATEGORY.TEXT,
  [CONTENT_BLOCK_TYPE.TESTIMONIALS]: BLOCK_CATEGORY.TEXT,
  [CONTENT_BLOCK_TYPE.FAQ]: BLOCK_CATEGORY.INTERACTIVE,
  [CONTENT_BLOCK_TYPE.WARRANTY]: BLOCK_CATEGORY.LEGAL,
  [CONTENT_BLOCK_TYPE.TERMS]: BLOCK_CATEGORY.LEGAL,
  [CONTENT_BLOCK_TYPE.SIGNATURE]: BLOCK_CATEGORY.LEGAL,
  [CONTENT_BLOCK_TYPE.APPENDICES]: BLOCK_CATEGORY.LEGAL,
  [CONTENT_BLOCK_TYPE.COMPANY_PROFILE]: BLOCK_CATEGORY.TEXT,
  [CONTENT_BLOCK_TYPE.MAPS]: BLOCK_CATEGORY.INTERACTIVE,
  [CONTENT_BLOCK_TYPE.QR_CODES]: BLOCK_CATEGORY.INTERACTIVE,
  [CONTENT_BLOCK_TYPE.CUSTOM]: BLOCK_CATEGORY.CUSTOM,
})

export function categoryForType(type) {
  return CATEGORY_BY_TYPE[type] ?? BLOCK_CATEGORY.CUSTOM
}

export const BLOCK_VARIABLES = Object.freeze([
  { id: 'client_name', label: 'Client name' },
  { id: 'company', label: 'Company' },
  { id: 'date', label: 'Issue date' },
  { id: 'proposal_number', label: 'Proposal number' },
  { id: 'project_value', label: 'Project value' },
  { id: 'prepared_by', label: 'Prepared by' },
  { id: 'prepared_for', label: 'Prepared for' },
  { id: 'website', label: 'Website' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'brand_primary', label: 'Brand primary' },
  { id: 'brand_secondary', label: 'Brand secondary' },
  { id: 'brand_logo', label: 'Brand logo' },
  { id: 'valid_until', label: 'Valid until' },
  { id: 'project_type', label: 'Project type' },
  { id: 'title', label: 'Proposal title' },
])

export function defaultBlockSettings(input = {}) {
  return {
    background: input.background ?? '',
    color: input.color ?? '',
    padding: input.padding ?? null,
    radius: input.radius ?? null,
    border: input.border !== false,
    letterSpacing: input.letterSpacing ?? null,
    lineHeight: input.lineHeight ?? null,
    animation: input.animation ?? 'normal',
    hideWhenEmpty: input.hideWhenEmpty !== false,
    visible: input.visible !== false,
    condition: input.condition ?? 'always',
  }
}

export function defaultAiMetadata(input = {}, type = CONTENT_BLOCK_TYPE.CUSTOM) {
  const label = CONTENT_BLOCK_TYPE_LABELS[type] ?? 'Block'
  return {
    description: input.description ?? '',
    purpose: input.purpose ?? `Reusable ${label.toLowerCase()} for proposals.`,
    expectedInputs: [...(input.expectedInputs ?? ['client_name', 'company'])],
    expectedOutputs: [...(input.expectedOutputs ?? [type])],
    tokens: [...(input.tokens ?? [])],
    category: input.category ?? categoryForType(type),
    keywords: [...(input.keywords ?? [label.toLowerCase()])],
  }
}

function makeVersion(input = {}, block) {
  return {
    versionId: input.versionId ?? createRecordId('ver'),
    versionNumber: input.versionNumber ?? 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    label: input.label ?? 'Initial',
    snapshot: input.snapshot ?? {
      name: block?.name ?? '',
      data: block?.data ?? {},
      settings: block?.settings ?? defaultBlockSettings(),
    },
  }
}

/**
 * @typedef {object} ContentBlock
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {string} description
 * @property {string} category
 * @property {string} status
 * @property {string[]} tags
 * @property {boolean} favorite
 * @property {number} version
 * @property {object[]} versions
 * @property {object} data
 * @property {object} settings
 * @property {object} ai
 * @property {number} useCount
 * @property {string | null} lastUsedAt
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<ContentBlock>} [input]
 * @returns {ContentBlock}
 */
export function makeContentBlock(input = {}) {
  const timestamp = new Date().toISOString()
  const type = CONTENT_BLOCK_TYPES.includes(input.type)
    ? input.type
    : CONTENT_BLOCK_TYPE.CUSTOM
  const name = input.name ?? input.title ?? ''
  const data = input.data && typeof input.data === 'object' ? { ...input.data } : {}
  const settings = defaultBlockSettings(input.settings ?? {})
  const version = Number(input.version ?? 1)
  const draft = {
    name,
    data,
    settings,
  }

  return {
    id: input.id ?? createRecordId('block'),
    type,
    name,
    title: name,
    description: input.description ?? input.body ?? '',
    body: input.body ?? input.description ?? '',
    category: BLOCK_CATEGORIES.includes(input.category)
      ? input.category
      : categoryForType(type),
    status: LIBRARY_BLOCK_STATUSES.includes(input.status)
      ? input.status
      : LIBRARY_BLOCK_STATUS.PUBLISHED,
    tags: [...(input.tags ?? [])],
    favorite: Boolean(input.favorite),
    version,
    versions: Array.isArray(input.versions) && input.versions.length > 0
      ? input.versions.map((entry) => makeVersion(entry, draft))
      : [makeVersion({ versionNumber: version, createdAt: input.createdAt ?? timestamp }, draft)],
    data,
    settings,
    ai: defaultAiMetadata(input.ai ?? {}, type),
    assetIds: [...(input.assetIds ?? [])],
    useCount: Number(input.useCount ?? 0),
    lastUsedAt: input.lastUsedAt ?? null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  }
}

export const makeLibraryBlock = makeContentBlock

export function listContentBlockTypes() {
  return CONTENT_BLOCK_TYPES.map((type) => ({
    type,
    label: CONTENT_BLOCK_TYPE_LABELS[type],
    category: categoryForType(type),
  }))
}

export function listRuntimeBlockTypes(runtimeTypes) {
  const types = runtimeTypes ?? CONTENT_BLOCK_TYPES
  return types.map((type) => ({
    type,
    label: CONTENT_BLOCK_TYPE_LABELS[type],
    category: categoryForType(type),
  }))
}

export function snapshotLibraryBlock(block, label = 'Saved') {
  const versionNumber = Number(block.version ?? 0) + 1
  const version = makeVersion(
    {
      versionNumber,
      label,
      snapshot: {
        name: block.name,
        data: block.data,
        settings: block.settings,
      },
    },
    block,
  )

  return {
    ...block,
    version: versionNumber,
    versions: [...(block.versions ?? []), version],
  }
}

export function restoreLibraryBlock(block, versionId) {
  const entry = (block.versions ?? []).find((item) => item.versionId === versionId)
  if (!entry) return block
  return makeContentBlock({
    ...block,
    name: entry.snapshot.name ?? block.name,
    data: entry.snapshot.data ?? block.data,
    settings: entry.snapshot.settings ?? block.settings,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * @param {Partial<ContentBlock>} block
 * @returns {{ field: string, message: string }[]}
 */
export function validateContentBlock(block) {
  const errors = []

  if (!block.name?.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' })
  }

  if (block.type && !CONTENT_BLOCK_TYPES.includes(block.type)) {
    errors.push({
      field: 'type',
      message: `Type must be one of: ${CONTENT_BLOCK_TYPES.join(', ')}.`,
    })
  }

  if (block.category && !BLOCK_CATEGORIES.includes(block.category)) {
    errors.push({
      field: 'category',
      message: `Category must be one of: ${BLOCK_CATEGORIES.join(', ')}.`,
    })
  }

  return errors
}
