import { useState } from 'react'
import ViewerDialog from '../viewer/ViewerDialog.jsx'
import { listViewerSections } from '../viewer/sectionMeta.js'
import { usePortalComments } from '../hooks/usePortalComments.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalRequestChanges.module.css'

function PortalRequestChanges({ onClose, onProposalChange, onSubmitted }) {
  const { proposal, token } = usePortal()
  const flow = usePortalComments({ token, onProposalChange })
  const [message, setMessage] = useState('')
  const [sectionId, setSectionId] = useState('')
  const sections = listViewerSections(proposal.blocks, proposal)

  async function handleSubmit(event) {
    event.preventDefault()
    const section = sections.find((item) => item.id === sectionId)
    const saved = await flow.requestChanges({
      message,
      sectionId: section?.id ?? null,
      sectionTitle: section?.title ?? '',
    })
    if (saved) {
      onSubmitted?.()
      onClose()
    }
  }

  return (
    <ViewerDialog
      open
      title="Request changes"
      description="Tell the studio what needs to change. The proposal will move to Needs revision."
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
            disabled={flow.busy || !message.trim()}
          >
            {flow.busy ? 'Sending…' : 'Request changes'}
          </button>
        </>
      }
    >
      <form id="portal-request-changes" className={styles.form} onSubmit={handleSubmit}>
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
            disabled={flow.busy}
          />
        </label>
        {sections.length > 0 ? (
          <label className={styles.field}>
            <span className={styles.label}>Section (optional)</span>
            <select
              className={styles.select}
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              disabled={flow.busy}
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
