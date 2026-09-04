import { useState } from 'react'
import ViewerDialog from '../viewer/ViewerDialog.jsx'
import { useDeclineProposal } from '../hooks/useDeclineProposal.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalRequestChanges.module.css'

function PortalDecline({ onClose, onDeclined }) {
  const { token } = usePortal()
  const flow = useDeclineProposal()
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const saved = await flow.decline(token, { message })
    if (saved) {
      onDeclined?.(saved)
      onClose()
    }
  }

  return (
    <ViewerDialog
      open
      title="Decline proposal"
      description="This locks the proposal. You can optionally tell the studio why."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="portal-decline"
            className={styles.submit}
            disabled={flow.submitting}
          >
            {flow.submitting ? 'Declining…' : 'Decline proposal'}
          </button>
        </>
      }
    >
      <form id="portal-decline" className={styles.form} onSubmit={handleSubmit}>
        {flow.error ? (
          <p className={styles.banner} role="alert">
            {flow.error.message}
          </p>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>Reason (optional)</span>
          <textarea
            className={styles.textarea}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Let the studio know why this isn’t the right fit…"
            rows={4}
            disabled={flow.submitting}
          />
        </label>
      </form>
    </ViewerDialog>
  )
}

export default PortalDecline
