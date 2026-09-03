import { useState } from 'react'
import { useParams } from 'react-router'
import ProposalContent from '../../components/ProposalContent/ProposalContent.jsx'
import { useAcceptProposal } from '../../hooks/useAcceptProposal.js'
import { useClientProposal } from '../../hooks/useClientProposal.js'
import { useRequestProposalChanges } from '../../hooks/useRequestProposalChanges.js'
import { canClientRespond, PROPOSAL_STATUS } from '../../models/proposal.js'
import { getActiveProposal } from '../../utils/clientProposal.js'
import { getLayout } from '../../layouts/registry.js'
import { formatDateTime } from '../../utils/format.js'
import styles from './ClientPortal.module.css'

function ClientPortal() {
  const { token } = useParams()
  const { proposal, loading, error, notFound, refetch } = useClientProposal(token)
  const { accept, submitting: accepting, error: acceptError } = useAcceptProposal()
  const {
    requestChanges,
    submitting: requesting,
    error: changeError,
    fieldErrors,
    reset: resetChangeForm,
  } = useRequestProposalChanges()

  const [comment, setComment] = useState('')
  const [showChangeForm, setShowChangeForm] = useState(false)
  const [justAccepted, setJustAccepted] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [exportError, setExportError] = useState(null)

  const document = proposal ? getActiveProposal(proposal) : null
  const layout = getLayout(document?.layoutId)
  const busy = accepting || requesting || Boolean(exporting)
  const canRespond = proposal ? canClientRespond(proposal) : false

  async function handleAccept() {
    if (!token || busy) return

    const next = await accept(token)

    if (next) {
      setJustAccepted(true)
      setShowChangeForm(false)
      await refetch()
    }
  }

  async function handleRequestChanges(event) {
    event.preventDefault()
    if (!token || busy) return

    const next = await requestChanges(token, comment)

    if (next) {
      setShowChangeForm(false)
      setComment('')
      await refetch()
    }
  }

  async function runExport(action) {
    if (!document || exporting) return

    const pdfProposal = { ...document, notes: '' }

    setExportError(null)
    setExporting(action)

    try {
      const { downloadProposalPdf, printProposalPdf } = await import(
        '../../pdf/generateProposalPdf.js'
      )

      if (action === 'download') {
        await downloadProposalPdf(pdfProposal)
      } else {
        await printProposalPdf(pdfProposal)
      }
    } catch (caught) {
      setExportError(caught)
    } finally {
      setExporting(null)
    }
  }

  if (notFound) {
    return (
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.state}>
            <p className={styles.stateTitle}>Proposal not found</p>
            <p className={styles.stateText}>
              This client link is invalid, or the proposal is no longer
              available.
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.state}>
            <p className={styles.stateTitle}>Could not load this proposal</p>
            <p className={styles.stateText}>
              {error.message || 'Something went wrong while fetching the proposal.'}
            </p>
            <button type="button" className={styles.secondary} onClick={refetch}>
              Try again
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (loading || !proposal || !document) {
    return (
      <div className={styles.shell}>
        <main className={styles.main}>
          <p className={styles.loading}>Loading proposal…</p>
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        </main>
      </div>
    )
  }

  const accepted = proposal.status === PROPOSAL_STATUS.ACCEPTED
  const revisionRequested = proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED

  return (
    <div className={styles.shell}>
      <main
        className={styles.main}
        style={{ width: `min(${layout.screen.maxWidth}, 100%)` }}
      >
        <article className={styles.document}>
          {justAccepted || accepted ? (
            <section className={styles.confirmation} aria-live="polite">
              <p className={styles.confirmationTitle}>Proposal accepted</p>
              <p className={styles.confirmationText}>
                Thank you. This proposal was accepted
                {proposal.acceptedAt
                  ? ` on ${formatDateTime(proposal.acceptedAt)}`
                  : ''}
                .
              </p>
            </section>
          ) : null}

          {revisionRequested && proposal.clientFeedback ? (
            <section className={styles.feedback} aria-live="polite">
              <p className={styles.confirmationTitle}>Revision requested</p>
              <p className={styles.confirmationText}>{proposal.clientFeedback}</p>
            </section>
          ) : null}

          {acceptError ? (
            <p className={styles.alert} role="alert">
              {acceptError.message}
            </p>
          ) : null}

          {exportError ? (
            <p className={styles.alert} role="alert">
              {exportError.message ||
                'Could not generate the PDF. Please try again.'}
            </p>
          ) : null}

          <ProposalContent
            proposal={document}
            includeCover
            showNotes={false}
            showTags={false}
            showSignature
            status={proposal.status}
          />

          <section className={styles.actions}>
            {canRespond ? (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={handleAccept}
                  disabled={busy}
                >
                  {accepting ? 'Accepting…' : 'Accept proposal'}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    setShowChangeForm((open) => !open)
                    resetChangeForm()
                  }}
                  disabled={busy}
                >
                  Request changes
                </button>
              </>
            ) : null}

            <button
              type="button"
              className={styles.secondary}
              onClick={() => runExport('download')}
              disabled={busy}
            >
              {exporting === 'download' ? 'Preparing PDF…' : 'Download PDF'}
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => runExport('print')}
              disabled={busy}
            >
              {exporting === 'print' ? 'Preparing print…' : 'Print'}
            </button>
          </section>

          {canRespond && showChangeForm ? (
            <form className={styles.changeForm} onSubmit={handleRequestChanges}>
              <label className={styles.changeLabel} htmlFor="client-feedback">
                What would you like changed?
              </label>
              <textarea
                id="client-feedback"
                className={styles.comment}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={5}
                required
                disabled={busy}
              />
              {fieldErrors.clientFeedback ? (
                <p className={styles.alert} role="alert">
                  {fieldErrors.clientFeedback}
                </p>
              ) : null}
              {changeError && !fieldErrors.clientFeedback ? (
                <p className={styles.alert} role="alert">
                  {changeError.message}
                </p>
              ) : null}
              <div className={styles.changeActions}>
                <button type="submit" className={styles.primary} disabled={busy}>
                  {requesting ? 'Sending…' : 'Send request'}
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => setShowChangeForm(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </article>
      </main>
    </div>
  )
}

export default ClientPortal
