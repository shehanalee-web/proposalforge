import { createRecordId } from '../models/ids.js'
import { ValidationError } from '../services/errors.js'
import { normalizeTags } from './normalize.js'
import { inferTrust, normalizeSource } from './sources.js'
import {
  DEFAULT_TYPE_CATEGORY,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUSES,
  KNOWLEDGE_TRUSTS,
  KNOWLEDGE_TYPE,
  KNOWLEDGE_TYPES,
} from './types.js'

const SECRET_PATTERN =
  /(sk-[a-zA-Z0-9]{16,}|api[_-]?key\s*[:=]|secret[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9\-._~+/]+=*|-----BEGIN (?:RSA )?PRIVATE KEY-----)/i

/**
 * @typedef {object} KnowledgeItem
 * @property {string} id
 * @property {string} companyId
 * @property {string} type
 * @property {string} title
 * @property {string} content
 * @property {string} category
 * @property {string[]} tags
 * @property {string} status
 * @property {string} source
 * @property {string} sourceId
 * @property {string} approvedBy
 * @property {string | null} approvedAt
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} usageCount
 * @property {string | null} lastUsedAt
 * @property {object} metadata
 */

function asString(value) {
  return value == null ? '' : String(value)
}

function asIso(value, fallback) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function asCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export function looksLikeSecret(value) {
  return SECRET_PATTERN.test(String(value ?? ''))
}

const SECRET_WALK_LIMIT = 40

/**
 * Walk strings (and object keys) without JSON.stringify, so field names such as
 * `api_key` do not become false positives from `"api_key":"…"`.
 *
 * @param {unknown} value
 * @param {WeakSet<object>} seen
 * @param {number} depth
 * @returns {boolean}
 */
function valueContainsSecret(value, seen, depth) {
  if (value == null || depth > SECRET_WALK_LIMIT) return false
  if (typeof value === 'string') return looksLikeSecret(value)
  if (typeof value === 'number' || typeof value === 'boolean') return false
  if (typeof value !== 'object') return looksLikeSecret(String(value))
  if (seen.has(value)) return false
  seen.add(value)

  if (Array.isArray(value)) {
    return value.some((entry) => valueContainsSecret(entry, seen, depth + 1))
  }

  return Object.entries(value).some(
    ([key, nested]) => looksLikeSecret(key) || valueContainsSecret(nested, seen, depth + 1),
  )
}

function tagsContainSecret(tags) {
  if (tags == null) return false
  if (typeof tags === 'string') return looksLikeSecret(tags)
  if (!Array.isArray(tags)) return looksLikeSecret(String(tags))
  return tags.some((tag) => looksLikeSecret(String(tag ?? '')))
}

/**
 * @param {Partial<KnowledgeItem> & { tags?: unknown, metadata?: unknown }} item
 * @returns {string[]} field names that contain secret-like material
 */
export function secretFieldsInKnowledge(item) {
  const fields = []
  if (looksLikeSecret(item?.title)) fields.push('title')
  if (looksLikeSecret(item?.content)) fields.push('content')
  if (tagsContainSecret(item?.tags)) fields.push('tags')
  if (valueContainsSecret(item?.metadata, new WeakSet(), 0)) fields.push('metadata')
  return fields
}

/**
 * @param {Partial<KnowledgeItem>} [input]
 * @returns {KnowledgeItem}
 */
export function makeKnowledgeItem(input = {}) {
  const now = asIso(input.updatedAt, new Date().toISOString())
  const createdAt = asIso(input.createdAt, now)
  const type = KNOWLEDGE_TYPES.includes(input.type) ? input.type : KNOWLEDGE_TYPE.PROPOSAL_BLOCK
  const status = KNOWLEDGE_STATUSES.includes(input.status)
    ? input.status
    : KNOWLEDGE_STATUS.DRAFT
  const category = KNOWLEDGE_CATEGORIES.includes(input.category)
    ? input.category
    : DEFAULT_TYPE_CATEGORY[type]
  const source = normalizeSource(input.source)
  const metadata = {
    demo: false,
    trust: KNOWLEDGE_TRUSTS.includes(input.metadata?.trust)
      ? input.metadata.trust
      : inferTrust({ source, status }),
    proposalRefs: Array.isArray(input.metadata?.proposalRefs)
      ? input.metadata.proposalRefs.map(String).filter(Boolean)
      : [],
    possibleDuplicate: Boolean(input.metadata?.possibleDuplicate),
    ...((input.metadata && typeof input.metadata === 'object') ? input.metadata : {}),
  }

  return {
    id: asString(input.id).trim() || createRecordId('know'),
    companyId: asString(input.companyId).trim(),
    type,
    title: asString(input.title).trim(),
    content: asString(input.content),
    category,
    tags: normalizeTags(input.tags),
    status,
    source,
    sourceId: asString(input.sourceId).trim(),
    approvedBy: asString(input.approvedBy).trim(),
    approvedAt: status === KNOWLEDGE_STATUS.APPROVED ? asIso(input.approvedAt, now) : null,
    createdAt,
    updatedAt: now,
    usageCount: asCount(input.usageCount),
    lastUsedAt: input.lastUsedAt ? asIso(input.lastUsedAt, null) : null,
    metadata,
  }
}

/**
 * @param {Partial<KnowledgeItem>} item
 * @returns {{ field: string, message: string }[]}
 */
export function validateKnowledgeItem(item) {
  const errors = []

  if (!item?.companyId || !String(item.companyId).trim()) {
    errors.push({ field: 'companyId', message: 'companyId is required.' })
  }

  if (!item?.title || !String(item.title).trim()) {
    errors.push({ field: 'title', message: 'Title is required.' })
  }

  if (!item?.content || !String(item.content).trim()) {
    errors.push({ field: 'content', message: 'Content is required.' })
  }

  if (item?.type && !KNOWLEDGE_TYPES.includes(item.type)) {
    errors.push({ field: 'type', message: 'Unknown knowledge type.' })
  }

  if (item?.status && !KNOWLEDGE_STATUSES.includes(item.status)) {
    errors.push({ field: 'status', message: 'Unknown knowledge status.' })
  }

  if (item?.category && !KNOWLEDGE_CATEGORIES.includes(item.category)) {
    errors.push({ field: 'category', message: 'Unknown knowledge category.' })
  }

  for (const field of secretFieldsInKnowledge(item)) {
    errors.push({
      field,
      message: 'Secrets and API keys cannot be stored in company knowledge.',
    })
  }

  return errors
}

export function assertValidKnowledgeItem(item) {
  const errors = validateKnowledgeItem(item)
  if (errors.length > 0) {
    throw new ValidationError('Knowledge item is not valid.', errors)
  }
  return item
}

/** Scan a raw payload (before tag normalization) so hyphenated keys are not stripped first. */
export function assertNoSecrets(payload) {
  const fields = secretFieldsInKnowledge(payload)
  if (fields.length === 0) return payload
  throw new ValidationError(
    'Knowledge item is not valid.',
    fields.map((field) => ({
      field,
      message: 'Secrets and API keys cannot be stored in company knowledge.',
    })),
  )
}

export function cloneKnowledge(item) {
  if (typeof structuredClone === 'function') return structuredClone(item)
  return JSON.parse(JSON.stringify(item))
}

/** Strip fields that must never leave the repository unscoped. */
export function publicKnowledgeRecord(item) {
  const record = cloneKnowledge(item)
  return {
    id: record.id,
    companyId: record.companyId,
    type: record.type,
    title: record.title,
    content: record.content,
    category: record.category,
    tags: record.tags,
    status: record.status,
    source: record.source,
    sourceId: record.sourceId,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    usageCount: record.usageCount,
    lastUsedAt: record.lastUsedAt,
    metadata: {
      demo: Boolean(record.metadata?.demo),
      trust: record.metadata?.trust ?? inferTrust(record),
      possibleDuplicate: Boolean(record.metadata?.possibleDuplicate),
      proposalRefs: Array.isArray(record.metadata?.proposalRefs)
        ? record.metadata.proposalRefs
        : [],
    },
  }
}

export { KNOWLEDGE_SOURCE }
