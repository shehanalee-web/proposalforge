import { useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import ActivityTimeline from '../ActivityTimeline/ActivityTimeline.jsx'
import CommentThread, {
  CommentComposer,
} from './CommentThread.jsx'
import {
  filterCommentThreads,
  groupCommentThreads,
  THREAD_FILTER,
} from '../../collaboration/threads.js'
import {
  ACTIVITY_AUDIENCE,
  buildProposalTimeline,
} from '../../models/clientActivity.js'
import { COMMENT_AUTHOR, COMMENT_VISIBILITY } from '../../models/comment.js'
import { useProposalCollaboration } from '../../hooks/useProposalCollaboration.js'
import styles from './CollaborationPanel.module.css'

const FILTERS = [
  { id: THREAD_FILTER.ALL, label: 'All' },
  { id: THREAD_FILTER.CLIENT, label: 'Client' },
  { id: THREAD_FILTER.INTERNAL, label: 'Internal' },
  { id: THREAD_FILTER.OPEN, label: 'Open' },
  { id: THREAD_FILTER.RESOLVED, label: 'Resolved' },
  { id: THREAD_FILTER.PINNED, label: 'Pinned' },
]

function CollaborationPanel({ proposal, open, onClose, onProposalChange }) {
  const flow = useProposalCollaboration({
    proposalId: proposal?.id,
    onProposalChange,
  })
  const [filter, setFilter] = useState(THREAD_FILTER.ALL)
  const [internalNote, setInternalNote] = useState(false)

  if (!open) return null

  const threads = filterCommentThreads(
    groupCommentThreads(proposal?.comments),
    filter,
  )
  const events = buildProposalTimeline(proposal, {
    audience: ACTIVITY_AUDIENCE.STUDIO,
  })

  async function handleNew(message) {
    const saved = await flow.addComment({
      message,
      visibility: internalNote
        ? COMMENT_VISIBILITY.INTERNAL
        : COMMENT_VISIBILITY.CLIENT,
    })
    return saved ? true : false
  }

  async function handleReply(threadId, message, options = {}) {
    const saved = await flow.addComment({
      message,
      parentId: threadId,
      visibility: options.visibility,
    })
    return saved ? true : false
  }

  return (
    <aside className={styles.panel} aria-label="Collaboration">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Studio</p>
          <h2 className={styles.title}>Collaboration</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close collaboration"
        >
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.scroll}>
        {flow.error ? (
          <p className={styles.banner} role="alert">
            {flow.error.message}
          </p>
        ) : null}

        <div className={styles.filters} role="tablist" aria-label="Filter conversations">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`${styles.filter} ${filter === item.id ? styles.filterOn : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <CommentComposer
          placeholder={
            internalNote
              ? 'Internal note. Use @name to mention. The client will not see this.'
              : 'Reply to the client or start a conversation. Use @name to mention…'
          }
          submitLabel={internalNote ? 'Add note' : 'Post'}
          disabled={flow.busy}
          onSubmit={handleNew}
          extra={
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={internalNote}
                onChange={(event) => setInternalNote(event.target.checked)}
              />
              Internal note
            </label>
          }
        />

        {threads.length === 0 ? (
          <p className={styles.note}>
            No conversations in this filter. Client questions and internal notes
            will appear here.
          </p>
        ) : (
          threads.map((thread) => (
            <CommentThread
              key={thread.id}
              thread={thread}
              studio
              actorType={COMMENT_AUTHOR.INTERNAL}
              canReply
              canResolve={!thread.resolved}
              canReopen={thread.resolved}
              canPin
              disabled={flow.busy}
              onReply={handleReply}
              onResolve={(id) => flow.setResolved(id, true)}
              onReopen={(id) => flow.setResolved(id, false)}
              onPin={(id, pinned) => flow.setPinned(id, pinned)}
            />
          ))
        )}

        <section className={styles.activity} aria-labelledby="studio-activity-heading">
          <p className={styles.activityTitle} id="studio-activity-heading">
            Activity
          </p>
          <ActivityTimeline
            events={events}
            clientLabel={proposal?.clientName || 'Client'}
            studioLabel="Studio"
          />
        </section>
      </div>
    </aside>
  )
}

export default CollaborationPanel
