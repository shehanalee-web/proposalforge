import { useState } from 'react'
import { useParams } from 'react-router'
import { useAcceptProposal } from '../../hooks/useAcceptProposal.js'
import { useClientProposal } from '../../hooks/useClientProposal.js'
import { useExportProposalPdf, PDF_AUDIENCE } from '../../hooks/useExportProposalPdf.js'
import { PROPOSAL_STATUS } from '../../models/proposal.js'
import { getActiveProposal } from '../../utils/clientProposal.js'
import { formatDateTime } from '../../utils/format.js'
import { ProposalThemeProvider } from '../../theme/ProposalThemeContext.jsx'
import { PortalProvider } from '../../portal/PortalContext.jsx'
import PortalApp from '../../portal/PortalApp.jsx'
import styles from './ClientPortal.module.css'

function ClientPortal() {
  const { token } = useParams()
  const { proposal, loading, error, notFound, refetch, setProposal } = useClientProposal(token)
  const { accept, submitting: accepting, error: acceptError } = useAcceptProposal()
  const { runExport, exporting, error: exportError } = useExportProposalPdf()
  const [justAccepted, setJustAccepted] = useState(false)
  const [justDeclined, setJustDeclined] = useState(false)

  const document = proposal ? getActiveProposal(proposal) : null
  const busy = accepting || Boolean(exporting)

  async function handleAccept() {
    if (!token || busy) return
    const next = await accept(token)
    if (next) {
      setJustAccepted(true)
      setProposal(next)
    }
  }

  function handleDeclined(next) {
    setJustDeclined(true)
    if (next) setProposal(next)
  }

  async function handleExport(action) {
    if (!document) return
    await runExport(document, action, { audience: PDF_AUDIENCE.CLIENT })
  }

  if (notFound) {
    return (
      <div className={styles.shell} data-surface="client-portal">
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
      <div className={styles.shell} data-surface="client-portal">
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
      <div className={styles.shell} data-surface="client-portal">
        <main className={styles.main}>
          <p className={styles.loading}>Loading proposal…</p>
          <div className={styles.skeletonLayout} aria-hidden="true">
            <div className={styles.skeletonDoc}>
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
              <div className={styles.skeletonRow} />
            </div>
            <div className={styles.skeletonAside}>
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
            </div>
          </div>
        </main>
      </div>
    )
  }

  const accepted = proposal.status === PROPOSAL_STATUS.ACCEPTED
  const declined = proposal.status === PROPOSAL_STATUS.DECLINED
  const revisionRequested = proposal.status === PROPOSAL_STATUS.REVISION_REQUESTED
  const notices = []

  if (justAccepted || accepted) {
    notices.push({
      id: 'accepted',
      tone: 'banner',
      title: 'Proposal approved',
      body: proposal.acceptedAt
        ? `Thank you. This proposal was approved on ${formatDateTime(proposal.acceptedAt)}.`
        : 'Thank you. This proposal is approved and locked.',
    })
  }

  if (justDeclined || declined) {
    notices.push({
      id: 'declined',
      tone: 'dangerBanner',
      title: 'Proposal declined',
      body: proposal.clientFeedback || 'This proposal has been declined and locked.',
    })
  }

  if (revisionRequested && proposal.clientFeedback) {
    notices.push({
      id: 'revision',
      tone: 'warning',
      title: 'Needs revision',
      body: proposal.clientFeedback,
    })
  }

  if (acceptError) {
    notices.push({
      id: 'accept-error',
      tone: 'dangerBanner',
      title: acceptError.message,
    })
  }

  if (exportError) {
    notices.push({
      id: 'export-error',
      tone: 'dangerBanner',
      title: exportError.message || 'Could not generate the PDF. Please try again.',
    })
  }

  return (
    <ProposalThemeProvider proposalId={proposal.id} proposal={document}>
      <PortalProvider proposal={document} token={token}>
        <PortalApp
          notices={notices}
          busy={busy}
          onAccept={handleAccept}
          onDownload={() => handleExport('download')}
          onPrint={() => handleExport('print')}
          onProposalChange={setProposal}
          onDeclined={handleDeclined}
        />
      </PortalProvider>
    </ProposalThemeProvider>
  )
}

export default ClientPortal
