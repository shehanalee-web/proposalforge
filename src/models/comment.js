import { createRecordId } from './ids.js'

/**
 * Proposal comments.
 *
 * Threads are one level deep: replies attach to a root. `resolved` on the
 * root closes the conversation. Clients never receive `visibility: internal`.
 */

export const COMMENT_AUTHOR = Object.freeze({
  CLIENT: 'client',
  INTERNAL: 'internal',
})

export const COMMENT_AUTHORS = Object.freeze(Object.values(COMMENT_AUTHOR))

export const COMMENT_VISIBILITY = Object.freeze({
  CLIENT: 'client',
  INTERNAL: 'internal',
})

export const COMMENT_VISIBILITIES = Object.freeze(
  Object.values(COMMENT_VISIBILITY),
)

export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000

export const STUDIO_AUTHOR_NAME = 'Studio'

const MESSAGE_MAX = 4000
const MENTION_PATTERN = /@([A-Za-z][\w.-]*)/g

/**
 * @param {string} message
 * @returns {string[]}
 */
export function parseMentions(message) {
  const found = String(message ?? '').matchAll(MENTION_PATTERN)
  return [...new Set([...found].map((match) => match[1]))]
}

/**
 * @typedef {object} ProposalComment
 * @property {string} id
 * @property {string} proposalId
 * @property {string | null} parentId
 * @property {'client' | 'internal'} authorType
 * @property {string} authorName
 * @property {string} message
 * @property {string} createdAt
 * @property {string | null} editedAt
 * @property {boolean} resolved
 * @property {boolean} pinned
 * @property {string[]} mentions
 * @property {'client' | 'internal'} visibility
 * @property {string | null} sectionId
 * @property {string} sectionTitle
 */

/**
 * @param {Partial<ProposalComment>} [input]
 * @returns {ProposalComment}
 */
export function makeComment(input = {}) {
  const authorType = COMMENT_AUTHORS.includes(input.authorType)
    ? input.authorType
    : COMMENT_AUTHOR.CLIENT
  const requested = COMMENT_VISIBILITIES.includes(input.visibility)
    ? input.visibility
    : COMMENT_VISIBILITY.CLIENT
  const visibility =
    authorType === COMMENT_AUTHOR.CLIENT
      ? COMMENT_VISIBILITY.CLIENT
      : requested

  return {
    id: input.id ?? createRecordId('cmt'),
    proposalId: input.proposalId ?? '',
    parentId: input.parentId ?? null,
    authorType,
    authorName:
      String(input.authorName ?? '').trim() ||
      (authorType === COMMENT_AUTHOR.CLIENT ? 'Client' : STUDIO_AUTHOR_NAME),
    message: String(input.message ?? '').trim(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    editedAt: input.editedAt ?? null,
    resolved: Boolean(input.resolved),
    pinned: Boolean(input.pinned),
    mentions: Array.isArray(input.mentions)
      ? input.mentions.map((item) => String(item).trim()).filter(Boolean)
      : parseMentions(input.message),
    visibility,
    sectionId: input.sectionId ?? null,
    sectionTitle: String(input.sectionTitle ?? '').trim(),
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCommentMessage(value) {
  return String(value ?? '').trim()
}

/**
 * @param {string} message
 * @returns {string | null}
 */
export function commentMessageError(message) {
  const text = normalizeCommentMessage(message)
  if (!text) return 'Please write a message.'
  if (text.length > MESSAGE_MAX) return `Keep the message under ${MESSAGE_MAX} characters.`
  return null
}

/**
 * Clients may edit their own comments within a short window of creation.
 *
 * @param {ProposalComment | null | undefined} comment
 * @param {{ authorType: string, now?: number }} actor
 * @returns {boolean}
 */
export function canEditComment(comment, actor = {}) {
  if (!comment) return false
  if (comment.authorType !== COMMENT_AUTHOR.CLIENT) return false
  if (actor.authorType !== COMMENT_AUTHOR.CLIENT) return false
  const created = Date.parse(comment.createdAt)
  if (!Number.isFinite(created)) return false
  const now = actor.now ?? Date.now()
  return now - created <= COMMENT_EDIT_WINDOW_MS
}

/**
 * @param {ProposalComment | null | undefined} comment
 * @returns {boolean}
 */
export function isClientVisibleComment(comment) {
  return comment?.visibility === COMMENT_VISIBILITY.CLIENT
}
