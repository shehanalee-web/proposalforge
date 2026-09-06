import { useState } from 'react'
import ViewerDialog from '../viewer/ViewerDialog.jsx'
import { listViewerSections } from '../viewer/sectionMeta.js'
import { useLivingInteractions } from '../hooks/useLivingInteractions.js'
import { INTERACTION_TYPE } from '../interactions/types.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalRequestChanges.module.css'

/**
 * Living change-request dialog — writes H12 change_request, not proposal.comments.
 */
function PortalRequestChanges({ onClose, onSubmitted }) {
  const { proposal } = usePortal()
  const flow = useLivingInteractions(proposal?.shareToken)
  const [message, setMessage] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const sections = listViewerSections(proposal.blocks, proposal)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await flow.submit({
        type: INTERACTION_TYPE.CHANGE_REQUEST,
        message,
        blockId: sectionId || '',
      })
      onSubmitted?.()
      onClose()
    } catch (caught) {
      setError(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ViewerDialog
      open
      title="Request changes"
      description="Tell the studio what needs to change. This is recorded as feedback and does not rewrite the proposal."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="portal-request-changes"
            className={styles.submit}
            disabled={busy || flow.loading || !message.trim()}
          >
            {busy ? 'Sending…' : 'Request changes'}
          </button>
        </>
      }
    >
      <form id="portal-request-changes" className={styles.form} onSubmit={handleSubmit}>
        {error ? (
          <p className={styles.banner} role="alert">
            {error.message}
          </p>
        ) : null}
        {flow.error ? (
          <p className={styles.banner} role="alert">
            {flow.error.message}
          </p>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>
            What should change? <span className={styles.required}>Required</span>
          </span>
          <textarea
            className={styles.textarea}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe the revision you need…"
            required
            rows={5}
            disabled={busy}
          />
        </label>
        {sections.length > 0 ? (
          <label className={styles.field}>
            <span className={styles.label}>Section (optional)</span>
            <select
              className={styles.select}
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              disabled={busy}
            >
              <option value="">Entire proposal</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </form>
    </ViewerDialog>
  )
}

export default PortalRequestChanges
