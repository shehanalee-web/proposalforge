import { Link } from 'react-router'
import { PATH, proposalEditPath } from '../../workspace/paths.js'
import styles from './FollowupDashboard.module.css'

function Cell({ label, value }) {
  return (
    <li className={styles.cell}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </li>
  )
}

function FollowupDashboard({ overview, loading, error, onRetry }) {
  if (error) {
    return (
      <div className={`studio-panel ${styles.panel}`}>
        <p className={styles.errorTitle}>Could not load follow-up</p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  const data = overview ?? {}
  const value = (n) => (loading ? '—' : String(n ?? 0))
  const next = data.nextAction

  return (
    <div className={`studio-panel ${styles.panel}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>Follow-up queue</h2>
        <Link to={PATH.FOLLOWUPS} className={styles.link}>
          View all
        </Link>
      </div>
      <ul className={styles.grid}>
        <Cell label="Due today" value={value(data.dueToday)} />
        <Cell label="Overdue" value={value(data.overdue)} />
        <Cell label="Waiting for client" value={value(data.waitingForClient)} />
        <Cell label="Expiring" value={value(data.expiring)} />
        <Cell label="Client feedback" value={value(data.clientFeedback)} />
      </ul>
      {next ? (
        <p className={styles.next}>
          Next action:{' '}
          <Link to={proposalEditPath(next.proposalId)}>{next.title}</Link>
          {next.ownerName ? ` · ${next.ownerName}` : ''}
        </p>
      ) : (
        <p className={styles.next}>No follow-up needed right now.</p>
      )}
    </div>
  )
}

export default FollowupDashboard
