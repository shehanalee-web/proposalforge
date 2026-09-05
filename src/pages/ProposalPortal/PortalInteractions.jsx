import { useState } from 'react'
import { usePortalInteractions } from '../../hooks/usePortalInteractions.js'
import { INTERACTION_STATUS, INTERACTION_TYPE } from '../../interactions/types.js'
import { INTERACTION_TYPE_LABELS } from '../../interactions/statuses.js'
import { formatDateTime } from '../../utils/format.js'
import styles from './ProposalPortal.module.css'

const FORM_TYPES = [
  INTERACTION_TYPE.COMMENT,
  INTERACTION_TYPE.CHANGE_REQUEST,
  INTERACTION_TYPE.QUESTION,
]

function PortalInteractions({ portalId }) {
  const flow = usePortalInteractions(portalId)
  const [type, setType] = useState(INTERACTION_TYPE.COMMENT)
  const [message, setMessage] = useState('')
  const [blockId, setBlockId] = useState('')
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
  const published = flow.portal?.status === 'published' || !flow.error

  return (
    <section className={styles.feedback} aria-label="Client feedback">
      <h2 className={styles.sectionTitle}>Feedback</h2>
      <p className={styles.body}>
        Share a comment, question, or change request. Approval is recorded as
        evidence and does not automatically change the studio workflow.
      </p>

      {flow.loading && !interactions.length ? (
        <p className={styles.body}>Loading previous feedback…</p>
      ) : null}
      {flow.error ? (
        <p className={styles.alert} role="alert">
          {flow.error.message || 'Could not load feedback.'}
        </p>
      ) : null}
      {formError ? (
        <p className={styles.alert} role="alert">
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {interactions.length ? (
        <ul className={styles.feedbackList}>
          {interactions.map((item) => (
            <li key={item.id} className={styles.feedbackItem}>
              <div className={styles.feedbackHead}>
                <strong>{INTERACTION_TYPE_LABELS[item.type] || item.type}</strong>
                <span>
                  {item.status === INTERACTION_STATUS.RESOLVED
                    ? 'Resolved'
                    : item.status === INTERACTION_STATUS.ACKNOWLEDGED
                      ? 'Acknowledged'
                      : 'Open'}
                </span>
              </div>
              <p className={styles.body}>{item.message}</p>
              {item.blockId ? (
                <p className={styles.metaLine}>
                  {item.blockUnavailable
                    ? 'Referenced section is no longer available'
                    : `Section: ${item.blockLabel || 'Section'}`}
                </p>
              ) : null}
              <p className={styles.metaLine}>
                {item.createdAt ? formatDateTime(item.createdAt) : ''}
                {item.acknowledgedAt ? ` · Acknowledged ${formatDateTime(item.acknowledgedAt)}` : ''}
                {item.resolvedAt ? ` · Resolved ${formatDateTime(item.resolvedAt)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.body}>No feedback submitted yet.</p>
      )}

      {published && !flow.error ? (
        <form className={styles.feedbackForm} onSubmit={onSubmit}>
          <label className={styles.field}>
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
            <label className={styles.field}>
              Section (optional)
              <select value={blockId} onChange={(event) => setBlockId(event.target.value)}>
                <option value="">Whole proposal</option>
                {flow.targets.map((target) => (
                  <option key={target.blockId} value={target.blockId}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.field}>
            Message
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              required
            />
          </label>
          <div className={styles.feedbackActions}>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? 'Sending…' : 'Submit feedback'}
            </button>
            <button
              type="button"
              className={styles.approve}
              disabled={busy}
              onClick={() => submit(INTERACTION_TYPE.APPROVAL, 'Approved.')}
            >
              Approve this proposal
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

export default PortalInteractions
