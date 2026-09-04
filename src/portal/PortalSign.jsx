import { useState } from 'react'
import ViewerDialog from '../viewer/ViewerDialog.jsx'
import { useSignProposal } from '../hooks/useSignProposal.js'
import { SIGNATURE_STATUS } from '../models/signature.js'
import { usePortal } from './PortalContext.jsx'
import styles from './PortalRequestChanges.module.css'

function PortalSign({ onClose, onSigned }) {
  const { token, proposal } = usePortal()
  const flow = useSignProposal()
  const [signerName, setSignerName] = useState(
    proposal?.signature?.signer || proposal?.clientName || '',
  )
  const [agreed, setAgreed] = useState(false)
  const alreadySigned = proposal?.signature?.status === SIGNATURE_STATUS.SIGNED

  async function handleSubmit(event) {
    event.preventDefault()
    const saved = await flow.sign(token, { signerName, agreed })
    if (saved) {
      onSigned?.(saved)
      onClose()
    }
  }

  return (
    <ViewerDialog
      open
      title="Sign proposal"
      description="This records your name, browser, device, and the time of signing. Signing also approves the proposal."
      onClose={onClose}
      footer={
        alreadySigned ? (
          <button type="button" className={styles.submit} onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="portal-sign"
              className={styles.submit}
              disabled={flow.submitting || !agreed}
            >
              {flow.submitting ? 'Signing…' : 'Sign and approve'}
            </button>
          </>
        )
      }
    >
      {alreadySigned ? (
        <p className={styles.note}>
          Signed by {proposal.signature.signer || 'the client'}
          {proposal.signature.signedAt ? `.` : '.'}
        </p>
      ) : (
        <form id="portal-sign" className={styles.form} onSubmit={handleSubmit}>
          {flow.error ? (
            <p className={styles.banner} role="alert">
              {flow.error.message}
            </p>
          ) : null}
          <label className={styles.field}>
            <span className={styles.label}>
              Full name <span className={styles.required}>Required</span>
            </span>
            <input
              className={styles.input}
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              autoComplete="name"
              disabled={flow.submitting}
              required
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              disabled={flow.submitting}
            />
            <span>
              I agree to the terms in this proposal and intend this as my
              signature.
            </span>
          </label>
        </form>
      )}
    </ViewerDialog>
  )
}

export default PortalSign
