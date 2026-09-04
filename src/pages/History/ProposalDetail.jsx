import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useProposal } from '../../hooks/useProposal.js'
import { useRestoreProposalVersion } from '../../hooks/useRestoreProposalVersion.js'
import { useSaveProposalVersion } from '../../hooks/useSaveProposalVersion.js'
import { useDeleteProposalVersion } from '../../hooks/useDeleteProposalVersion.js'
import { useUpdateProposal } from '../../hooks/useUpdateProposal.js'
import { useExportProposalPdf } from '../../hooks/useExportProposalPdf.js'
import { useLatestEmailMessage } from '../../hooks/useLatestEmailMessage.js'
import { makeEmailDeliverySummary } from '../../models/emailDelivery.js'
import { toDuplicateDraft } from '../../utils/duplicateDraft.js'
import { useCreateProposalDialog } from '../../hooks/useCreateProposalDialog.js'
import { PATH } from '../../workspace/paths.js'
import { archiveProposal, recordProposalDownload } from '../../services/proposalService.js'
import { PROPOSAL_STATUS } from '../../models/proposal.js'
import SendProposalDialog from '../../components/SendProposal/SendProposalDialog.jsx'
import ProposalDetailView from './ProposalDetailView.jsx'
import VersionHistoryPanel from './VersionHistoryPanel.jsx'
import ActivityPanel from './ActivityPanel.jsx'
import styles from './ProposalDetail.module.css'

const SKELETON_ROWS = 5

function ProposalDetail() {
  const { id } = useParams()
  const { openCreate } = useCreateProposalDialog()
  const { proposal, loading, error, notFound, refetch, setProposal } = useProposal(id)
  const {
    restore,
    submitting: restoring,
    error: restoreError,
  } = useRestoreProposalVersion()
  const {
    saveVersion,
    submitting: savingVersion,
    error: saveVersionError,
  } = useSaveProposalVersion()
  const {
    removeVersion,
    submitting: deletingVersion,
    error: deleteVersionError,
  } = useDeleteProposalVersion()
  const { update, submitting: layoutSaving } = useUpdateProposal()
  const { runExport, exporting, error: exportError } = useExportProposalPdf()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const latestEmail = useLatestEmailMessage(proposal?.id, Boolean(proposal))

  function handleDuplicate() {
    if (!proposal) return

    openCreate({
      draft: toDuplicateDraft(proposal),
      source: 'duplicate',
    })
  }

  async function handleLayoutChange(layoutId) {
    if (!proposal || layoutId === proposal.layoutId || layoutSaving) return

    const updated = await update(proposal.id, { layoutId })

    if (updated) {
      await refetch()
    }
  }

  async function handleRestore(versionId) {
    if (!id) return null

    const restored = await restore(id, versionId)

    if (restored) {
      await refetch()
    }

    return restored
  }

  async function handleSaveVersion() {
    if (!id) return null
    const next = await saveVersion(id)
    if (next) await refetch()
    return next
  }

  async function handleDeleteVersion(versionId) {
    if (!id) return
    const next = await removeVersion(id, versionId)
    if (next) await refetch()
  }

  async function handleExport(action) {
    if (!proposal) return
    await runExport(proposal, action)
    try {
      const next = await recordProposalDownload(proposal.id)
      if (next) setProposal(next)
    } catch {
      /* download event is best-effort */
    }
  }

  async function handleArchive() {
    if (!id || archiving) return
    setArchiving(true)
    try {
      const next = await archiveProposal(id)
      setProposal(next)
    } finally {
      setArchiving(false)
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
          <Link to={PATH.PROPOSALS} className={styles.action}>
            Back to proposals
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

  const viewProposal = latestEmail
    ? { ...proposal, lastEmail: makeEmailDeliverySummary(latestEmail) }
    : proposal

  return (
    <section className={styles.page}>
      <ProposalDetailView
        proposal={viewProposal}
        onDuplicate={handleDuplicate}
        onDownloadPdf={() => handleExport('download')}
        onPrint={() => handleExport('print')}
        onSend={() => setSendOpen(true)}
        onArchive={
          proposal.status === PROPOSAL_STATUS.ARCHIVED ? undefined : handleArchive
        }
        archiving={archiving}
        onProposalChange={setProposal}
        onOpenHistory={() => {
          setActivityOpen(false)
          setHistoryOpen(true)
        }}
        onOpenActivity={() => {
          setHistoryOpen(false)
          setActivityOpen(true)
        }}
        onLayoutChange={handleLayoutChange}
        layoutSaving={layoutSaving}
        exporting={exporting}
        exportError={exportError}
      />

      <SendProposalDialog
        proposal={proposal}
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onSent={async () => {
          setSendOpen(false)
          await refetch()
        }}
      />

      {historyOpen ? (
        <VersionHistoryPanel
          proposal={proposal}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestore}
          restoring={restoring}
          restoreError={restoreError}
          onSaveVersion={handleSaveVersion}
          savingVersion={savingVersion}
          saveVersionError={saveVersionError}
          onDeleteVersion={handleDeleteVersion}
          deleting={deletingVersion}
          deleteError={deleteVersionError}
        />
      ) : null}

      {activityOpen ? (
        <ActivityPanel
          proposal={proposal}
          onClose={() => setActivityOpen(false)}
        />
      ) : null}
    </section>
  )
}

export default ProposalDetail
