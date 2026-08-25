import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
} from '../../models/proposal.js'
import styles from './HistoryToolbar.module.css'

const ALL_FILTER = ''

function HistoryToolbar({ search, onSearchChange, status, onStatusChange }) {
  const filters = [ALL_FILTER, ...PROPOSAL_STATUSES]

  return (
    <div className={styles.toolbar}>
      <input
        type="search"
        className={styles.search}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by title, client or company"
        aria-label="Search proposals"
      />

      <div className={styles.filters} role="group" aria-label="Filter by status">
        {filters.map((value) => {
          const isActive = status === value
          const label = value ? PROPOSAL_STATUS_LABELS[value] : 'All'

          return (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={isActive}
              className={isActive ? `${styles.filter} ${styles.filterActive}` : styles.filter}
              onClick={() => onStatusChange(value)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default HistoryToolbar
