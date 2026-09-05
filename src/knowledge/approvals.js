import { KNOWLEDGE_STATUS } from './types.js'

/**
 * Only approved knowledge may enter automatic AI context.
 *
 * @param {import('./schema.js').KnowledgeItem | null | undefined} item
 * @returns {boolean}
 */
export function isApprovedForContext(item) {
  return Boolean(item) && item.status === KNOWLEDGE_STATUS.APPROVED
}

export function isDraft(item) {
  return item?.status === KNOWLEDGE_STATUS.DRAFT
}

export function isArchived(item) {
  return item?.status === KNOWLEDGE_STATUS.ARCHIVED
}

/**
 * @param {import('./schema.js').KnowledgeItem} item
 * @param {{ approvedBy?: string, now?: string }} [options]
 */
export function applyApprove(item, options = {}) {
  const now = options.now ?? new Date().toISOString()
  return {
    ...item,
    status: KNOWLEDGE_STATUS.APPROVED,
    approvedBy: String(options.approvedBy ?? item.approvedBy ?? 'company').trim() || 'company',
    approvedAt: now,
    updatedAt: now,
    metadata: {
      ...item.metadata,
      trust: 'company-approved',
      previousStatus: item.status,
    },
  }
}

/**
 * @param {import('./schema.js').KnowledgeItem} item
 * @param {{ now?: string }} [options]
 */
export function applyArchive(item, options = {}) {
  const now = options.now ?? new Date().toISOString()
  return {
    ...item,
    status: KNOWLEDGE_STATUS.ARCHIVED,
    updatedAt: now,
    metadata: {
      ...item.metadata,
      previousStatus: item.status,
    },
  }
}

/**
 * Restore archived knowledge to draft so it cannot silently re-enter AI context.
 *
 * @param {import('./schema.js').KnowledgeItem} item
 * @param {{ now?: string }} [options]
 */
export function applyRestore(item, options = {}) {
  const now = options.now ?? new Date().toISOString()
  return {
    ...item,
    status: KNOWLEDGE_STATUS.DRAFT,
    approvedBy: '',
    approvedAt: null,
    updatedAt: now,
    metadata: {
      ...item.metadata,
      previousStatus: item.status,
      trust: 'unverified',
    },
  }
}

/**
 * @param {import('./schema.js').KnowledgeItem} item
 * @param {{ now?: string }} [options]
 */
export function applyDraft(item, options = {}) {
  const now = options.now ?? new Date().toISOString()
  return {
    ...item,
    status: KNOWLEDGE_STATUS.DRAFT,
    approvedBy: '',
    approvedAt: null,
    updatedAt: now,
    metadata: {
      ...item.metadata,
      previousStatus: item.status,
      trust: item.metadata?.trust === 'company-approved' ? 'unverified' : item.metadata?.trust,
    },
  }
}
