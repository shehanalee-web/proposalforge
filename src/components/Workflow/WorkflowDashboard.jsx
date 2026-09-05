import styles from './WorkflowDashboard.module.css'

function Cell({ label, value }) {
  return (
    <li className={styles.cell}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </li>
  )
}

function WorkflowDashboard({ overview, loading, error, onRetry }) {
  if (error) {
    return (
      <div className={`studio-panel ${styles.panel}`}>
        <p className={styles.errorTitle}>Could not load workflow</p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  const data = overview ?? {}
  const value = (n) => (loading ? '—' : String(n ?? 0))

  return (
    <div className={`studio-panel ${styles.panel}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>Proposal workflow</h2>
      </div>
      <ul className={styles.grid}>
        <Cell label="Awaiting Review" value={value(data.awaitingReview)} />
        <Cell label="Changes Requested" value={value(data.changesRequested)} />
        <Cell label="Ready to Send" value={value(data.readyToSend)} />
        <Cell label="Sent" value={value(data.sent)} />
        <Cell label="Accepted" value={value(data.accepted)} />
        <Cell label="Rejected" value={value(data.rejected)} />
        <Cell label="Overdue Tasks" value={value(data.overdueTasks)} />
      </ul>
    </div>
  )
}

export default WorkflowDashboard
