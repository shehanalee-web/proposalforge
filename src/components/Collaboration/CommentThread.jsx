import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import {
  canEditComment,
  COMMENT_AUTHOR,
  COMMENT_VISIBILITY,
} from '../../models/comment.js'
import { formatDateTime } from '../../utils/format.js'
import styles from './CommentThread.module.css'

function Composer({
  placeholder,
  submitLabel,
  disabled,
  onSubmit,
  extra = null,
  compact = false,
}) {
  const [value, setValue] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const message = value.trim()
    if (!message || disabled) return
    const saved = await onSubmit(message)
    if (saved !== false) setValue('')
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <textarea
        className={`${styles.textarea} ${compact ? styles.textareaCompact : ''}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={compact ? 3 : 4}
      />
      <div className={styles.composerRow}>
        {extra}
        <button
          type="submit"
          className={styles.submit}
          disabled={disabled || !value.trim()}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

function CommentBody({
  comment,
  canEdit,
  disabled,
  onEdit,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.message)

  async function handleSave(event) {
    event.preventDefault()
    const saved = await onEdit?.(comment.id, draft)
    if (saved !== false) setEditing(false)
  }

  if (editing) {
    return (
      <form className={styles.editForm} onSubmit={handleSave}>
        <textarea
          className={`${styles.textarea} ${styles.textareaCompact}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          rows={3}
        />
        <div className={styles.composerRow}>
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => {
              setDraft(comment.message)
              setEditing(false)
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submit}
            disabled={disabled || !draft.trim()}
          >
            Save
          </button>
        </div>
      </form>
    )
  }

  return (
    <>
      <p className={styles.message}>{comment.message}</p>
      {canEdit ? (
        <button
          type="button"
          className={styles.textBtn}
          onClick={() => setEditing(true)}
          disabled={disabled}
        >
          Edit
        </button>
      ) : null}
    </>
  )
}

function CommentMeta({ comment, studio }) {
  const internal = comment.visibility === COMMENT_VISIBILITY.INTERNAL
  const name =
    comment.authorType === COMMENT_AUTHOR.CLIENT
      ? comment.authorName
      : comment.authorName || 'Studio'

  return (
    <p className={styles.meta}>
      <span className={styles.author}>{name}</span>
      {studio && internal ? (
        <span className={styles.badge}>
          <Icon name="lock" size={10} />
          Internal
        </span>
      ) : null}
      <span>
        {formatDateTime(comment.createdAt)}
        {comment.editedAt ? ' · Edited' : ''}
      </span>
    </p>
  )
}

export function CommentComposer(props) {
  return <Composer {...props} />
}

function CommentThread({
  thread,
  studio = false,
  canReply = false,
  canResolve = false,
  canReopen = false,
  disabled = false,
  onReply,
  onEdit,
  onResolve,
  onReopen,
  actorType = COMMENT_AUTHOR.CLIENT,
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [internalReply, setInternalReply] = useState(false)

  async function handleReply(message) {
    const saved = await onReply?.(thread.id, message, {
      visibility: internalReply
        ? COMMENT_VISIBILITY.INTERNAL
        : COMMENT_VISIBILITY.CLIENT,
    })
    if (saved !== false) {
      setReplyOpen(false)
      setInternalReply(false)
    }
    return saved
  }

  return (
    <article
      className={`${styles.thread} ${thread.resolved ? styles.resolved : ''}`}
    >
      <header className={styles.head}>
        <CommentMeta comment={thread.root} studio={studio} />
        {thread.root.sectionTitle ? (
          <p className={styles.section}>On: {thread.root.sectionTitle}</p>
        ) : null}
      </header>

      <CommentBody
        comment={thread.root}
        canEdit={canEditComment(thread.root, { authorType: actorType })}
        disabled={disabled}
        onEdit={onEdit}
      />

      {thread.replies.map((reply) => (
        <div key={reply.id} className={styles.reply}>
          <CommentMeta comment={reply} studio={studio} />
          <CommentBody
            comment={reply}
            canEdit={canEditComment(reply, { authorType: actorType })}
            disabled={disabled}
            onEdit={onEdit}
          />
        </div>
      ))}

      <div className={styles.actions}>
        {canReply && !thread.resolved ? (
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => setReplyOpen((open) => !open)}
            disabled={disabled}
          >
            {replyOpen ? 'Cancel reply' : 'Reply'}
          </button>
        ) : null}
        {canResolve && !thread.resolved ? (
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => onResolve?.(thread.id)}
            disabled={disabled}
          >
            Resolve
          </button>
        ) : null}
        {canReopen && thread.resolved ? (
          <button
            type="button"
            className={styles.textBtn}
            onClick={() => onReopen?.(thread.id)}
            disabled={disabled}
          >
            Reopen
          </button>
        ) : null}
        {thread.resolved ? <span className={styles.resolvedLabel}>Resolved</span> : null}
      </div>

      {replyOpen ? (
        <Composer
          compact
          placeholder="Write a reply…"
          submitLabel="Reply"
          disabled={disabled}
          onSubmit={handleReply}
          extra={
            studio ? (
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={internalReply}
                  onChange={(event) => setInternalReply(event.target.checked)}
                />
                Internal note
              </label>
            ) : null
          }
        />
      ) : null}
    </article>
  )
}

export default CommentThread
