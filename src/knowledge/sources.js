import {
  DEFAULT_TYPE_CATEGORY,
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_SOURCES,
  KNOWLEDGE_TRUST,
  KNOWLEDGE_TYPE,
} from './types.js'

const BLOCK_TYPE_TO_KNOWLEDGE = Object.freeze({
  'executive-summary': KNOWLEDGE_TYPE.APPROVED_SECTION,
  deliverables: KNOWLEDGE_TYPE.DELIVERABLE,
  terms: KNOWLEDGE_TYPE.TERMS,
  faq: KNOWLEDGE_TYPE.FAQ,
  testimonials: KNOWLEDGE_TYPE.TESTIMONIAL,
  cover: KNOWLEDGE_TYPE.PROPOSAL_BLOCK,
  'rich-text': KNOWLEDGE_TYPE.PROPOSAL_BLOCK,
  custom: KNOWLEDGE_TYPE.PROPOSAL_BLOCK,
})

/**
 * @param {unknown} source
 * @returns {string}
 */
export function normalizeSource(source) {
  const value = String(source ?? '').trim()
  if (KNOWLEDGE_SOURCES.includes(value)) return value
  return KNOWLEDGE_SOURCE.MANUAL
}

/**
 * Trust is metadata only — not a second scoring system.
 *
 * @param {{ source?: string, status?: string }} item
 * @returns {string}
 */
export function inferTrust(item = {}) {
  const source = normalizeSource(item.source)
  if (item.status === 'approved') return KNOWLEDGE_TRUST.COMPANY_APPROVED
  if (
    source === KNOWLEDGE_SOURCE.EXTRACTED_FROM_PROPOSAL ||
    source === KNOWLEDGE_SOURCE.COPIED_FROM_APPROVED_PROPOSAL
  ) {
    return KNOWLEDGE_TRUST.PROPOSAL_DERIVED
  }
  if (source === KNOWLEDGE_SOURCE.MANUAL) return KNOWLEDGE_TRUST.UNVERIFIED
  return KNOWLEDGE_TRUST.UNVERIFIED
}

/**
 * Walk common proposal-block data shapes into plain text.
 *
 * @param {unknown} data
 * @returns {string}
 */
export function extractBlockText(data) {
  if (data == null) return ''
  if (typeof data === 'string' || typeof data === 'number') return String(data).trim()
  if (Array.isArray(data)) {
    return data.map((entry) => extractBlockText(entry)).filter(Boolean).join('\n')
  }
  if (typeof data !== 'object') return ''

  const parts = []
  const record = /** @type {Record<string, unknown>} */ (data)
  const scalars = [
    'kicker',
    'heading',
    'subheading',
    'title',
    'body',
    'notes',
    'question',
    'answer',
    'quote',
    'description',
    'label',
    'value',
    'name',
    'role',
    'bio',
    'authorName',
    'authorRole',
    'company',
    'date',
  ]

  for (const key of scalars) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) parts.push(value.trim())
  }

  for (const key of ['items', 'rows', 'members', 'modules']) {
    if (record[key] != null) {
      const nested = extractBlockText(record[key])
      if (nested) parts.push(nested)
    }
  }

  return parts.join('\n\n').trim()
}

/**
 * @param {string} [blockType]
 * @returns {string}
 */
export function knowledgeTypeFromBlockType(blockType) {
  return BLOCK_TYPE_TO_KNOWLEDGE[blockType] ?? KNOWLEDGE_TYPE.PROPOSAL_BLOCK
}

/**
 * @param {string} [blockType]
 * @returns {string}
 */
export function knowledgeCategoryFromBlockType(blockType) {
  return DEFAULT_TYPE_CATEGORY[knowledgeTypeFromBlockType(blockType)]
}

/**
 * @param {{ type?: string, data?: unknown, id?: string }} block
 * @param {{ heading?: string }} [meta]
 * @returns {{ title: string, content: string, type: string, category: string }}
 */
export function draftFieldsFromProposalBlock(block, meta = {}) {
  const type = knowledgeTypeFromBlockType(block?.type)
  const content = extractBlockText(block?.data)
  const heading =
    String(meta.heading ?? '').trim() ||
    String(block?.data?.heading ?? '').trim() ||
    String(block?.data?.title ?? '').trim()

  return {
    title: heading || defaultTitleForType(type),
    content,
    type,
    category: DEFAULT_TYPE_CATEGORY[type],
  }
}

function defaultTitleForType(type) {
  if (type === KNOWLEDGE_TYPE.APPROVED_SECTION) return 'Approved wording'
  if (type === KNOWLEDGE_TYPE.DELIVERABLE) return 'Standard deliverables'
  if (type === KNOWLEDGE_TYPE.TERMS) return 'Standard terms'
  if (type === KNOWLEDGE_TYPE.FAQ) return 'Proposal FAQ'
  if (type === KNOWLEDGE_TYPE.TESTIMONIAL) return 'Client testimonial'
  return 'Reusable proposal block'
}
