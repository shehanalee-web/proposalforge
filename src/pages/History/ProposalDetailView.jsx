import { Link } from 'react-router'
import { formatCurrency, formatDate } from '../../utils/format.js'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
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
  exporting,
  exportError,
}) {
  const hasSections = proposal.sections.length > 0
  const hasTags = proposal.tags.length > 0
  const busy = Boolean(exporting)

  return (
    <article className={styles.document}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.projectType}>{proposal.projectType}</p>
          <h2 className={styles.title}>{proposal.title}</h2>
        </div>

        <div className={styles.actions}>
          <StatusBadge status={proposal.status} />
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
          <Link to={`/history/${proposal.id}/edit`} className={styles.edit}>
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
      </dl>

      {proposal.summary ? (
        <section className={styles.block}>
          <h3 className={styles.blockTitle}>Summary</h3>
          <p className={styles.body}>{proposal.summary}</p>
        </section>
      ) : null}

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Proposal body</h3>
        {hasSections ? (
          <ol className={styles.sections}>
            {proposal.sections.map((section) => (
              <li key={section.id} className={styles.section}>
                <h4 className={styles.sectionHeading}>{section.heading}</h4>
                <p className={styles.body}>{section.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No sections on this proposal yet.</p>
        )}
      </section>

      {hasTags ? (
        <ul className={styles.tags}>
          {proposal.tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <Link to="/history" className={styles.back}>
        Back to history
      </Link>
    </article>
  )
}

export default ProposalDetailView
