import { useState } from 'react'
import Icon from '../components/Icon/Icon.jsx'
import ActivityTimeline from '../components/ActivityTimeline/ActivityTimeline.jsx'
import CommentThread, {
  CommentComposer,
} from '../components/Collaboration/CommentThread.jsx'
import { groupCommentThreads } from '../collaboration/threads.js'
import {
  ACTIVITY_AUDIENCE,
  buildProposalTimeline,
} from '../models/clientActivity.js'
import { COMMENT_AUTHOR } from '../models/comment.js'
import { canClientRespond } from '../models/proposal.js'
import { usePortalComments } from '../hooks/usePortalComments.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalComments.module.css'

function PortalComments({ onClose, onProposalChange }) {
  const { proposal, token } = usePortal()
  const flow = usePortalComments({ token, onProposalChange })
  const [tab, setTab] = useState('discussion')
  const canPost = canClientRespond(proposal)
  const threads = groupCommentThreads(proposal.comments)
  const events = buildProposalTimeline(proposal, {
    audience: ACTIVITY_AUDIENCE.CLIENT,
  })

  async function handleAsk(message) {
    const saved = await flow.addComment(message)
    return saved ? true : false
  }

  async function handleReply(threadId, message) {
    const saved = await flow.addComment(message, threadId)
    return saved ? true : false
  }

  async function handleEdit(commentId, message) {
    const saved = await flow.editComment(commentId, message)
    return saved ? true : false
  }

  return (
    <div className={styles.layer}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close comments"
        onClick={onClose}
      />
      <aside className={styles.drawer} aria-labelledby="portal-comments-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Collaboration</p>
            <h2 id="portal-comments-title" className={styles.title}>
              Comments
            </h2>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Comments and activity">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'discussion'}
            className={`${styles.tab} ${tab === 'discussion' ? styles.tabOn : ''}`}
            onClick={() => setTab('discussion')}
          >
            Discussion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'activity'}
            className={`${styles.tab} ${tab === 'activity' ? styles.tabOn : ''}`}
            onClick={() => setTab('activity')}
          >
            Activity
          </button>
        </div>

        <div className={styles.body}>
          {flow.error ? (
            <p className={styles.banner} role="alert">
              {flow.error.message}
            </p>
          ) : null}

          {tab === 'activity' ? (
            <ActivityTimeline
              events={events}
              clientLabel="You"
              studioLabel="Studio"
            />
          ) : (
            <>
              {canPost ? (
                <CommentComposer
                  placeholder="Ask a question about this proposal…"
                  submitLabel="Post"
                  disabled={flow.busy}
                  onSubmit={handleAsk}
                />
              ) : (
                <p className={styles.note}>
                  This proposal is closed. You can still read the discussion.
                </p>
              )}

              {threads.length === 0 ? (
                <p className={styles.note}>
                  No comments yet. Ask a question and the studio will see it here.
                </p>
              ) : (
                threads.map((thread) => (
                  <CommentThread
                    key={thread.id}
                    thread={thread}
                    actorType={COMMENT_AUTHOR.CLIENT}
                    canReply={canPost && !thread.resolved}
                    canResolve={!thread.resolved}
                    disabled={flow.busy}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onResolve={(id) => flow.resolveThread(id)}
                  />
                ))
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

export default PortalComments
