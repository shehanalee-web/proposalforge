import { Link } from 'react-router'
import ProposalContent from '../../components/ProposalContent/ProposalContent.jsx'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { getDisplayStatus } from '../../models/proposal.js'
import { getClientPortalPath } from '../../utils/clientProposal.js'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format.js'
import { getLayout } from '../../layouts/registry.js'
import LayoutPicker from '../../layouts/screen/LayoutPicker.jsx'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import styles from './ProposalDetailView.module.css'

function MetaItem({ label, children }) {
  return (
    <div className={styles.metaItem}>
      <dt className={styles.metaLabel}>{label}</dt>
      <dd className={styles.metaValue}>{children}</dd>
    </div>
  )
}

function ProposalDetailView({
  proposal,
  onDuplicate,
  onDownloadPdf,
  onPrint,
  onCopyLink,
  onLayoutChange,
  layoutSaving,
  linkCopied,
  exporting,
  exportError,
}) {
  const busy = Boolean(exporting) || Boolean(layoutSaving)
  const clientPath = getClientPortalPath(proposal.shareToken)
  const hasFeedback = Boolean(proposal.clientFeedback?.trim())
  const layout = getLayout(proposal.layoutId)

  return (
    <article className={styles.document}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.projectType}>{proposal.projectType}</p>
          <h2 className={styles.title}>{proposal.title}</h2>
        </div>

        <div className={styles.actions}>
          <StatusBadge status={getDisplayStatus(proposal)} />
          <button
            type="button"
            className={styles.download}
            onClick={onDownloadPdf}
            disabled={busy}
          >
            {exporting === 'download' ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <button
            type="button"
            className={styles.print}
            onClick={onPrint}
            disabled={busy}
          >
            {exporting === 'print' ? 'Preparing print…' : 'Print proposal'}
          </button>
          <Link to={proposalEditPath(proposal.id)} className={styles.edit}>
            Edit proposal
          </Link>
          <button
            type="button"
            className={styles.duplicate}
            onClick={onDuplicate}
            disabled={busy}
          >
            Duplicate proposal
          </button>
        </div>
      </header>

      {exportError ? (
        <p className={styles.exportError} role="alert">
          {exportError.message || 'Could not generate the PDF. Please try again.'}
        </p>
      ) : null}

      <dl className={styles.meta}>
        <MetaItem label="Client">{proposal.clientName || '—'}</MetaItem>
        <MetaItem label="Company">{proposal.company || '—'}</MetaItem>
        <MetaItem label="Email">{proposal.clientEmail || '—'}</MetaItem>
        <MetaItem label="Value">
          {formatCurrency(proposal.amount, proposal.currency)}
        </MetaItem>
        <MetaItem label="Valid until">{formatDate(proposal.validUntil)}</MetaItem>
        <MetaItem label="Updated">{formatDate(proposal.updatedAt)}</MetaItem>
        <MetaItem label="Last viewed">
          {formatDateTime(proposal.lastViewedAt)}
        </MetaItem>
        <MetaItem label="Accepted">
          {formatDateTime(proposal.acceptedAt)}
        </MetaItem>
        <MetaItem label="Layout">{layout.label}</MetaItem>
      </dl>

      <section className={styles.share}>
        <div className={styles.shareCopy}>
          <p className={styles.shareLabel}>Client portal</p>
          <p className={styles.shareUrl}>{clientPath}</p>
        </div>
        <div className={styles.shareActions}>
          <button
            type="button"
            className={styles.print}
            onClick={onCopyLink}
            disabled={busy}
          >
            {linkCopied ? 'Link copied' : 'Copy client link'}
          </button>
          <Link to={clientPath} className={styles.edit}>
            Open client page
          </Link>
        </div>
      </section>

      {hasFeedback ? (
        <section className={styles.feedback}>
          <h3 className={styles.feedbackTitle}>Client feedback</h3>
          <p className={styles.feedbackBody}>{proposal.clientFeedback}</p>
        </section>
      ) : null}

      <LayoutPicker
        value={proposal.layoutId}
        onChange={onLayoutChange}
        disabled={busy}
      />

      <ProposalContent proposal={proposal} showSignature />

      <Link to={PATH.PROPOSALS} className={styles.back}>
        Back to proposals
      </Link>
    </article>
  )
}

export default ProposalDetailView
