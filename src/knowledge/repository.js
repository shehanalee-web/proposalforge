import { ValidationError, NotFoundError } from '../services/errors.js'
import { applyApprove, applyArchive, applyDraft, applyRestore, isApprovedForContext } from './approvals.js'
import { normalizeText, tokenJaccard } from './normalize.js'
import { assertNoSecrets, assertValidKnowledgeItem, makeKnowledgeItem, publicKnowledgeRecord } from './schema.js'
import { filterKnowledgeItems, searchKnowledgeItems } from './search.js'
import { draftFieldsFromProposalBlock } from './sources.js'
import {
  allKnowledgeRecords,
  findKnowledgeRecord,
  insertKnowledgeRecord,
  removeKnowledgeRecord,
  replaceKnowledgeRecord,
} from './store.js'
import {
  KNOWLEDGE_MAX_PROPOSAL_REFS,
  KNOWLEDGE_SEARCH_LIMIT,
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_STATUS,
} from './types.js'

const DUPLICATE_CONTENT_THRESHOLD = 0.88

export function requireCompanyId(companyId) {
  const id = String(companyId ?? '').trim()
  if (!id) {
    throw new ValidationError('companyId is required.', [
      { field: 'companyId', message: 'companyId is required.' },
    ])
  }
  return id
}

function scopedAll(companyId) {
  const scoped = requireCompanyId(companyId)
  return allKnowledgeRecords().filter((item) => item.companyId === scoped)
}

function getOwned(companyId, id) {
  const scoped = requireCompanyId(companyId)
  const record = findKnowledgeRecord(id)
  if (!record || record.companyId !== scoped) {
    throw new NotFoundError(`No knowledge item found with id "${id}".`)
  }
  return record
}

function withDuplicateFlag(companyId, item) {
  const duplicates = findPossibleDuplicates({
    companyId,
    title: item.title,
    content: item.content,
    excludeId: item.id,
  })
  return {
    ...item,
    metadata: {
      ...item.metadata,
      possibleDuplicate: duplicates.length > 0,
    },
  }
}

/**
 * Lightweight duplicate detection. Never merges or deletes.
 *
 * @param {{ companyId: string, title?: string, content?: string, excludeId?: string }} input
 */
export function findPossibleDuplicates(input) {
  const companyId = requireCompanyId(input.companyId)
  const title = normalizeText(input.title)
  const content = normalizeText(input.content)
  const matches = []

  for (const item of scopedAll(companyId)) {
    if (input.excludeId && item.id === input.excludeId) continue
    const sameTitle = title && normalizeText(item.title) === title
    const sameContent = content && normalizeText(item.content) === content
    const similar = content && tokenJaccard(content, item.content) >= DUPLICATE_CONTENT_THRESHOLD
    if (sameTitle || sameContent || similar) {
      matches.push(publicKnowledgeRecord(item))
    }
  }

  return matches
}

export function listCompanyKnowledge({
  companyId,
  query,
  categories,
  status,
  includeArchived,
  limit,
} = {}) {
  const items = scopedAll(companyId)
  if (query && String(query).trim()) {
    return searchKnowledgeItems(items, query, { categories, status, includeArchived, limit }).map(
      (row) => ({
        ...publicKnowledgeRecord(row.item),
        relevance: { score: row.score, match: row.match },
      }),
    )
  }

  const filtered = filterKnowledgeItems(items, { categories, status, includeArchived })
  const sorted = [...filtered].sort((a, b) => {
    const updated = String(b.updatedAt).localeCompare(String(a.updatedAt))
    if (updated !== 0) return updated
    return String(a.title).localeCompare(String(b.title))
  })
  const cap = Number(limit)
  const sliced = Number.isFinite(cap) && cap > 0 ? sorted.slice(0, Math.floor(cap)) : sorted
  return sliced.map((item) => publicKnowledgeRecord(item))
}

export function getCompanyKnowledgeItem({ companyId, id }) {
  return publicKnowledgeRecord(getOwned(companyId, id))
}

export function searchCompanyKnowledge({
  companyId,
  query,
  categories,
  status,
  includeArchived = false,
  limit = KNOWLEDGE_SEARCH_LIMIT,
} = {}) {
  const rows = searchKnowledgeItems(scopedAll(companyId), query, {
    categories,
    status,
    includeArchived,
    limit,
  })
  return rows.map((row) => ({
    ...publicKnowledgeRecord(row.item),
    relevance: { score: row.score, match: row.match },
  }))
}

export function createKnowledgeItem(input = {}) {
  const companyId = requireCompanyId(input.companyId)
  assertNoSecrets(input)
  const draft = makeKnowledgeItem({
    ...input,
    companyId,
    status: KNOWLEDGE_STATUS.DRAFT,
    approvedBy: '',
    approvedAt: null,
    source: input.source ?? KNOWLEDGE_SOURCE.MANUAL,
  })
  const flagged = withDuplicateFlag(companyId, draft)
  assertValidKnowledgeItem(flagged)
  return publicKnowledgeRecord(insertKnowledgeRecord(flagged))
}

export function updateKnowledgeItem({ companyId, id, changes = {} } = {}) {
  const existing = getOwned(companyId, id)
  assertNoSecrets({
    title: changes.title ?? existing.title,
    content: changes.content ?? existing.content,
    tags: changes.tags ?? existing.tags,
    metadata: changes.metadata ?? existing.metadata,
  })
  const requestedStatus = changes.status
  const status =
    requestedStatus === KNOWLEDGE_STATUS.APPROVED
      ? existing.status
      : requestedStatus ?? existing.status
  const next = makeKnowledgeItem({
    ...existing,
    ...changes,
    id: existing.id,
    companyId: existing.companyId,
    createdAt: existing.createdAt,
    status,
    approvedBy: status === KNOWLEDGE_STATUS.APPROVED ? existing.approvedBy : '',
    approvedAt: status === KNOWLEDGE_STATUS.APPROVED ? existing.approvedAt : null,
    usageCount: changes.usageCount ?? existing.usageCount,
    lastUsedAt: changes.lastUsedAt ?? existing.lastUsedAt,
    updatedAt: new Date().toISOString(),
  })
  const flagged = withDuplicateFlag(companyId, next)
  assertValidKnowledgeItem(flagged)
  return publicKnowledgeRecord(replaceKnowledgeRecord(id, flagged))
}

export function approveKnowledgeItem({ companyId, id, approvedBy } = {}) {
  const existing = getOwned(companyId, id)
  const next = applyApprove(existing, { approvedBy })
  assertValidKnowledgeItem(next)
  return publicKnowledgeRecord(replaceKnowledgeRecord(id, next))
}

export function archiveKnowledgeItem({ companyId, id } = {}) {
  const existing = getOwned(companyId, id)
  const next = applyArchive(existing)
  return publicKnowledgeRecord(replaceKnowledgeRecord(id, next))
}

export function restoreKnowledgeItem({ companyId, id } = {}) {
  const existing = getOwned(companyId, id)
  const next = applyRestore(existing)
  assertValidKnowledgeItem(next)
  return publicKnowledgeRecord(replaceKnowledgeRecord(id, next))
}

export function saveKnowledgeDraft({ companyId, id } = {}) {
  const existing = getOwned(companyId, id)
  const next = applyDraft(existing)
  assertValidKnowledgeItem(next)
  return publicKnowledgeRecord(replaceKnowledgeRecord(id, next))
}

export function deleteKnowledgeItem({ companyId, id } = {}) {
  getOwned(companyId, id)
  removeKnowledgeRecord(id)
  return { id }
}

/**
 * Explicit proposal → knowledge path. Always creates a DRAFT.
 * Never auto-approves. Never ingests a whole proposal.
 */
export function saveProposalContentAsKnowledge({
  companyId,
  proposalId,
  block,
  title,
  type,
  category,
  tags,
  content,
} = {}) {
  const scoped = requireCompanyId(companyId)
  const extracted = block ? draftFieldsFromProposalBlock(block) : { title: '', content: '', type, category }
  const created = createKnowledgeItem({
    companyId: scoped,
    title: title || extracted.title,
    content: content || extracted.content,
    type: type || extracted.type,
    category: category || extracted.category,
    tags,
    status: KNOWLEDGE_STATUS.DRAFT,
    source: KNOWLEDGE_SOURCE.EXTRACTED_FROM_PROPOSAL,
    sourceId: String(proposalId || block?.id || '').trim(),
    metadata: {
      demo: false,
      trust: 'proposal-derived',
      proposalRefs: proposalId ? [String(proposalId)] : [],
      blockId: block?.id ?? '',
      blockType: block?.type ?? '',
    },
  })
  return created
}

export function recordKnowledgeUsage({ companyId, id, proposalId, now } = {}) {
  const existing = getOwned(companyId, id)
  if (!isApprovedForContext(existing) && existing.status !== KNOWLEDGE_STATUS.DRAFT) {
    return publicKnowledgeRecord(existing)
  }

  const stamp = now ?? new Date().toISOString()
  const refs = Array.isArray(existing.metadata?.proposalRefs)
    ? [...existing.metadata.proposalRefs]
    : []
  const proposalRef = String(proposalId ?? '').trim()
  if (proposalRef && !refs.includes(proposalRef)) refs.unshift(proposalRef)

  const next = makeKnowledgeItem({
    ...existing,
    usageCount: existing.usageCount + 1,
    lastUsedAt: stamp,
    updatedAt: existing.updatedAt,
    metadata: {
      ...existing.metadata,
      proposalRefs: refs.slice(0, KNOWLEDGE_MAX_PROPOSAL_REFS),
    },
  })
  next.updatedAt = existing.updatedAt
  return publicKnowledgeRecord(replaceKnowledgeRecord(id, next))
}
