import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { formatCurrency, formatDate } from '../../utils/format.js'
import styles from './RecentProposals.module.css'

const SKELETON_ROWS = 4

function RecentProposals({ proposals, loading, error, onRetry }) {
  if (error) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>Could not load proposals</p>
        <p className={styles.stateText}>
          {error.message || 'Something went wrong while fetching proposals.'}
        </p>
        <button type="button" className={styles.action} onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  if (loading && proposals.length === 0) {
    return (
      <div className={styles.skeleton} aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className={styles.skeletonRow} />
        ))}
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className={styles.state}>
        <p className={styles.stateText}>No proposals to show yet.</p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {proposals.map((proposal) => (
        <li key={proposal.id} className={styles.row}>
          <div className={styles.main}>
            <span className={styles.title}>{proposal.title}</span>
            <span className={styles.client}>
              {proposal.clientName}
              {proposal.company ? ` · ${proposal.company}` : ''}
            </span>
          </div>

          <div className={styles.side}>
            <span className={styles.amount}>
              {formatCurrency(proposal.amount, proposal.currency)}
            </span>
            <span className={styles.date}>
              {formatDate(proposal.updatedAt)}
            </span>
          </div>

          <StatusBadge status={proposal.status} />
        </li>
      ))}
    </ul>
  )
}

export default RecentProposals
