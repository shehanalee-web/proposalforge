import { useState } from 'react'
import { useProposals } from '../../hooks/useProposals.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import HistoryToolbar from './HistoryToolbar.jsx'
import ProposalList from './ProposalList.jsx'
import styles from './History.module.css'

const SKELETON_ROWS = 5

function History() {
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')

  // The input stays instant; only the debounced copy reaches the data layer.
  const search = useDebouncedValue(searchInput, 250)

  const { proposals, total, loading, error, refetch } = useProposals({
    status,
    search,
  })

  const isFiltered = Boolean(status) || search.trim().length > 0
  const isInitialLoad = loading && proposals.length === 0

  function clearFilters() {
    setSearchInput('')
    setStatus('')
  }

  function renderSummary() {
    if (error) return null

    if (isInitialLoad) return 'Loading proposals…'

    const noun = total === 1 ? 'proposal' : 'proposals'
    const suffix = loading ? ' · updating…' : ''

    return `${total} ${noun}${isFiltered ? ' matching' : ''}${suffix}`
  }

  function renderContent() {
    if (error) {
      return (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Could not load proposals</p>
          <p className={styles.stateText}>
            {error.message || 'Something went wrong while fetching proposals.'}
          </p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      )
    }

    if (isInitialLoad) {
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
          <p className={styles.stateTitle}>
            {isFiltered ? 'No matching proposals' : 'No proposals yet'}
          </p>
          <p className={styles.stateText}>
            {isFiltered
              ? 'Try a different search term, or clear the filters to see everything.'
              : 'Proposals you create will appear here.'}
          </p>
          {isFiltered && (
            <button
              type="button"
              className={styles.action}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      )
    }

    return <ProposalList proposals={proposals} />
  }

  return (
    <section className={styles.page}>
      <HistoryToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={setStatus}
      />

      <p className={styles.summary} role="status">
        {renderSummary()}
      </p>

      <div className={styles.panel}>{renderContent()}</div>
    </section>
  )
}

export default History
