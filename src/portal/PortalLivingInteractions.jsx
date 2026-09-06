import { useState } from 'react'
import Icon from '../components/Icon/Icon.jsx'
import { useLivingInteractions } from '../hooks/useLivingInteractions.js'
import { INTERACTION_STATUS, INTERACTION_TYPE } from '../interactions/types.js'
import { INTERACTION_TYPE_LABELS } from '../interactions/statuses.js'
import { formatDateTime } from '../utils/format.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalComments.module.css'
import formStyles from '../pages/ProposalPortal/ProposalPortal.module.css'

const FORM_TYPES = [
  INTERACTION_TYPE.COMMENT,
  INTERACTION_TYPE.CHANGE_REQUEST,
  INTERACTION_TYPE.QUESTION,
]

/**
 * Living H12 feedback drawer. Replaces legacy proposal.comments on /p/:token.
 */
function PortalLivingInteractions({ onClose, initialBlockId = '' }) {
  const { proposal } = usePortal()
  const shareToken = proposal?.shareToken
  const flow = useLivingInteractions(shareToken)
  const [type, setType] = useState(INTERACTION_TYPE.COMMENT)
  const [message, setMessage] = useState('')
  const [blockId, setBlockId] = useState(initialBlockId || '')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(nextType, nextMessage) {
    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      await flow.submit({
        type: nextType,
        message: nextMessage,
        blockId,
      })
      if (nextType !== INTERACTION_TYPE.APPROVAL) setMessage('')
      setNotice(
        nextType === INTERACTION_TYPE.APPROVAL
          ? 'Approval recorded. The studio can review it from this proposal.'
          : 'Feedback submitted.',
      )
    } catch (caught) {
      setFormError(caught.message || 'Could not submit this interaction.')
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event) {
    event.preventDefault()
    submit(type, message)
  }

  const interactions = flow.interactions
  const canSubmit = flow.enabled && !flow.error

  return (
    <div className={styles.layer} data-living-interactions="true">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close feedback"
        onClick={onClose}
      />
      <aside className={styles.drawer} aria-labelledby="living-interactions-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Feedback</p>
            <h2 id="living-interactions-title" className={styles.title}>
              Comments & requests
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

        <div className={styles.body}>
          <p className={styles.note}>
            Share a comment, question, or change request. Approval is recorded as
            evidence and does not automatically change the proposal.
          </p>

          {flow.loading && !interactions.length ? (
            <p className={styles.note}>Loading previous feedback…</p>
          ) : null}
          {flow.error ? (
            <p className={styles.banner} role="alert">
              {flow.error.message || 'Could not load feedback.'}
            </p>
          ) : null}
          {formError ? (
            <p className={styles.banner} role="alert">
              {formError}
            </p>
          ) : null}
          {notice ? (
            <p className={formStyles.notice} role="status">
              {notice}
            </p>
          ) : null}

          {interactions.length ? (
            <ul className={formStyles.feedbackList}>
              {interactions.map((item) => (
                <li key={item.id} className={formStyles.feedbackItem}>
                  <div className={formStyles.feedbackHead}>
                    <strong>{INTERACTION_TYPE_LABELS[item.type] || item.type}</strong>
                    <span>
                      {item.status === INTERACTION_STATUS.RESOLVED
                        ? 'Resolved'
                        : item.status === INTERACTION_STATUS.ACKNOWLEDGED
                          ? 'Acknowledged'
                          : 'Open'}
                    </span>
                  </div>
                  <p className={styles.note}>{item.message}</p>
                  {item.blockId ? (
                    <p className={formStyles.metaLine}>
                      {item.blockUnavailable
                        ? 'Referenced section is no longer available'
                        : `Section: ${item.blockLabel || 'Section'}`}
                    </p>
                  ) : null}
                  <p className={formStyles.metaLine}>
                    {item.createdAt ? formatDateTime(item.createdAt) : ''}
                    {item.acknowledgedAt
                      ? ` · Acknowledged ${formatDateTime(item.acknowledgedAt)}`
                      : ''}
                    {item.resolvedAt ? ` · Resolved ${formatDateTime(item.resolvedAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>No feedback submitted yet.</p>
          )}

          {canSubmit ? (
            <form className={formStyles.feedbackForm} onSubmit={onSubmit}>
              <label className={formStyles.field}>
                Type
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  {FORM_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {INTERACTION_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              {flow.targets.length ? (
                <label className={formStyles.field}>
                  Section (optional)
                  <select
                    value={blockId}
                    onChange={(event) => setBlockId(event.target.value)}
                  >
                    <option value="">Whole proposal</option>
                    {flow.targets.map((target) => (
                      <option key={target.blockId} value={target.blockId}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={formStyles.field}>
                Message
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  required
                />
              </label>
              <div className={formStyles.feedbackActions}>
                <button type="submit" className={formStyles.submit} disabled={busy}>
                  {busy ? 'Sending…' : 'Submit feedback'}
                </button>
                <button
                  type="button"
                  className={formStyles.approve}
                  disabled={busy}
                  onClick={() => submit(INTERACTION_TYPE.APPROVAL, 'Approved.')}
                >
                  Approve this proposal
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

export default PortalLivingInteractions
