import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProposal } from '../../hooks/useProposal.js'
import { toDuplicateDraft } from '../../utils/duplicateDraft.js'
import ProposalDetailView from './ProposalDetailView.jsx'
import styles from './ProposalDetail.module.css'

const SKELETON_ROWS = 5

function ProposalDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { proposal, loading, error, notFound, refetch } = useProposal(id)
  const [exporting, setExporting] = useState(null)
  const [exportError, setExportError] = useState(null)

  function handleDuplicate() {
    if (!proposal) return

    navigate('/new', { state: { draft: toDuplicateDraft(proposal) } })
  }

  async function runExport(action) {
    if (!proposal || exporting) return

    setExportError(null)
    setExporting(action)

    try {
      const { downloadProposalPdf, printProposalPdf } = await import(
        '../../pdf/generateProposalPdf.js'
      )

      if (action === 'download') {
        await downloadProposalPdf(proposal)
      } else {
        await printProposalPdf(proposal)
      }
    } catch (caught) {
      setExportError(caught)
    } finally {
      setExporting(null)
    }
  }

  if (notFound) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Proposal not found</p>
          <p className={styles.stateText}>
            This proposal does not exist, or it was lost when the app reloaded.
          </p>
          <Link to="/history" className={styles.action}>
            Back to history
          </Link>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className={styles.page}>
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load this proposal</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching the proposal.'}
          </p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  if (loading || !proposal) {
    return (
      <section className={styles.page}>
        <p className={styles.intro}>Loading proposal…</p>
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className={styles.skeletonRow} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <ProposalDetailView
        proposal={proposal}
        onDuplicate={handleDuplicate}
        onDownloadPdf={() => runExport('download')}
        onPrint={() => runExport('print')}
        exporting={exporting}
        exportError={exportError}
      />
    </section>
  )
}

export default ProposalDetail
