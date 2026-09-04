import {
  COMMENT_VISIBILITY,
  isClientVisibleComment,
  makeComment,
} from '../models/comment.js'

export const THREAD_FILTER = Object.freeze({
  ALL: 'all',
  CLIENT: 'client',
  INTERNAL: 'internal',
  OPEN: 'open',
  RESOLVED: 'resolved',
  PINNED: 'pinned',
})

/**
 * @typedef {object} CommentThread
 * @property {string} id
 * @property {import('../models/comment.js').ProposalComment} root
 * @property {import('../models/comment.js').ProposalComment[]} replies
 * @property {import('../models/comment.js').ProposalComment[]} comments
 * @property {boolean} resolved
 * @property {'client' | 'internal'} visibility
 */

/**
 * @param {import('../models/comment.js').ProposalComment[]} comments
 * @param {string | null | undefined} commentId
 * @returns {import('../models/comment.js').ProposalComment | null}
 */
export function findComment(comments = [], commentId) {
  if (!commentId) return null
  return comments.find((item) => item.id === commentId) ?? null
}

/**
 * Walk replies up to the conversation root.
 *
 * @param {import('../models/comment.js').ProposalComment[]} comments
 * @param {string | null | undefined} commentId
 * @returns {import('../models/comment.js').ProposalComment | null}
 */
export function findThreadRoot(comments = [], commentId) {
  const byId = new Map(comments.map((item) => [item.id, item]))
  let current = byId.get(commentId)
  if (!current) return null

  const seen = new Set()
  while (current.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id)
    current = byId.get(current.parentId)
  }

  return current ?? null
}

/**
 * Replies always hang off the root so conversations stay one level deep.
 *
 * @param {import('../models/comment.js').ProposalComment[]} comments
 * @param {string | null | undefined} parentId
 * @returns {string | null}
 */
export function resolveReplyParentId(comments = [], parentId) {
  if (!parentId) return null
  const root = findThreadRoot(comments, parentId)
  return root?.id ?? null
}

/**
 * @param {import('../models/comment.js').ProposalComment[] | undefined} comments
 * @returns {import('../models/comment.js').ProposalComment[]}
 */
export function listClientVisibleComments(comments = []) {
  const list = (comments ?? []).map((item) => makeComment(item))
  const visible = new Set(
    list.filter(isClientVisibleComment).map((item) => item.id),
  )

  return list.filter((comment) => {
    if (!visible.has(comment.id)) return false
    if (!comment.parentId) return true
    const root = findThreadRoot(list, comment.id)
    return root ? visible.has(root.id) : false
  })
}

/**
 * @param {import('../models/comment.js').ProposalComment[] | undefined} comments
 * @returns {CommentThread[]}
 */
export function groupCommentThreads(comments = []) {
  const list = (comments ?? [])
    .map((item) => makeComment(item))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  const byId = new Map(list.map((item) => [item.id, item]))
  const replies = new Map()
  const roots = []

  for (const comment of list) {
    if (!comment.parentId || !byId.has(comment.parentId)) {
      roots.push(comment)
      continue
    }

    let current = comment
    const seen = new Set()
    while (
      current.parentId &&
      byId.has(current.parentId) &&
      !seen.has(current.id)
    ) {
      seen.add(current.id)
      current = byId.get(current.parentId)
    }

    const bucket = replies.get(current.id) ?? []
    bucket.push(comment)
    replies.set(current.id, bucket)
  }

  return roots
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((root) => {
      const threadReplies = (replies.get(root.id) ?? []).sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
      )
      return {
        id: root.id,
        root,
        replies: threadReplies,
        comments: [root, ...threadReplies],
        resolved: Boolean(root.resolved),
        pinned: Boolean(root.pinned),
        visibility: root.visibility,
      }
    })
}

/**
 * @param {CommentThread[]} threads
 * @param {string} filter
 * @returns {CommentThread[]}
 */
export function filterCommentThreads(threads, filter) {
  switch (filter) {
    case THREAD_FILTER.CLIENT:
      return threads.filter(
        (thread) =>
          thread.visibility === COMMENT_VISIBILITY.CLIENT ||
          thread.comments.some(isClientVisibleComment),
      )
    case THREAD_FILTER.INTERNAL:
      return threads.filter((thread) =>
        thread.comments.some(
          (comment) => comment.visibility === COMMENT_VISIBILITY.INTERNAL,
        ),
      )
    case THREAD_FILTER.OPEN:
      return threads.filter((thread) => !thread.resolved)
    case THREAD_FILTER.RESOLVED:
      return threads.filter((thread) => thread.resolved)
    case THREAD_FILTER.PINNED:
      return threads.filter((thread) => thread.pinned || thread.root?.pinned)
    default:
      return threads
  }
}

/**
 * @param {import('../models/comment.js').ProposalComment[] | undefined} comments
 * @param {{ clientVisibleOnly?: boolean }} [options]
 * @returns {number}
 */
export function countOpenThreads(comments = [], options = {}) {
  const list = options.clientVisibleOnly
    ? listClientVisibleComments(comments)
    : comments
  return groupCommentThreads(list).filter((thread) => !thread.resolved).length
}
