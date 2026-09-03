import { formatCurrency } from '../../utils/format.js'
import styles from './SummaryCards.module.css'

const PLACEHOLDER = '—'

function formatRate(rate) {
  if (rate === null || rate === undefined) return PLACEHOLDER

  return `${Math.round(rate * 100)}%`
}

function buildCards(summary) {
  const counts = summary.statusCounts ?? {}
  const accepted = counts.accepted ?? 0
  const declined = counts.declined ?? 0
  const decided = accepted + declined

  return [
    {
      key: 'total',
      label: 'Total proposals',
      value: String(summary.total),
      meta: `${counts.draft ?? 0} still in draft`,
    },
    {
      key: 'pipeline',
      label: 'Pipeline value',
      value: formatCurrency(summary.pipelineValue, summary.currency),
      meta: `${(counts.sent ?? 0) + (counts.revision_requested ?? 0)} awaiting a decision`,
    },
    {
      key: 'won',
      label: 'Won value',
      value: formatCurrency(summary.wonValue, summary.currency),
      meta: `${accepted} accepted`,
    },
    {
      key: 'rate',
      label: 'Acceptance rate',
      value: formatRate(summary.acceptanceRate),
      meta: decided > 0 ? `${accepted} of ${decided} decided` : 'Nothing decided yet',
    },
    {
      key: 'versions',
      label: 'Version count',
      value: String(summary.versionCount ?? 0),
      meta: 'Saved snapshots across all proposals',
    },
  ]
}

function SummaryCards({ summary, loading, error, onRetry }) {
  if (error) {
    return (
      <div className={`studio-panel ${styles.error}`}>
        <p className={styles.errorTitle}>Could not load summary</p>
        <p className={styles.errorText}>
          {error.message || 'Something went wrong while fetching figures.'}
        </p>
        <button type="button" className={`studio-btn-secondary ${styles.action}`} onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <ul className={styles.grid}>
      {buildCards(summary).map((card) => (
        <li key={card.key} className={`studio-panel ${styles.card}`}>
          <span className={styles.label}>{card.label}</span>
          <span className={styles.value}>
            {loading ? PLACEHOLDER : card.value}
          </span>
          <span className={styles.meta}>{loading ? '' : card.meta}</span>
        </li>
      ))}
    </ul>
  )
}

export default SummaryCards
