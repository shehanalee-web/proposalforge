import { Link } from 'react-router'
import { useProposals } from '../../hooks/useProposals.js'
import { useProposalSummary } from '../../hooks/useProposalSummary.js'
import SummaryCards from './SummaryCards.jsx'
import RecentProposals from './RecentProposals.jsx'
import styles from './Dashboard.module.css'

const RECENT_LIMIT = 5

function Dashboard() {
  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useProposalSummary()

  const {
    proposals,
    loading: listLoading,
    error: listError,
    refetch: refetchList,
  } = useProposals({ page: 1, pageSize: RECENT_LIMIT })

  const isFirstRun =
    !summaryLoading && !summaryError && summary.total === 0 && !listError

  if (isFirstRun) {
    return (
      <section className={styles.page}>
        <div className={styles.onboarding}>
          <h2 className={styles.onboardingTitle}>No proposals yet</h2>
          <p className={styles.onboardingText}>
            Once you create a proposal it will show up here, along with your
            pipeline value and win rate.
          </p>
          <Link to="/new" className={styles.primaryAction}>
            Create your first proposal
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <SummaryCards
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        onRetry={refetchSummary}
      />

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Recent proposals</h2>
          <Link to="/history" className={styles.panelLink}>
            View all
          </Link>
        </div>

        <RecentProposals
          proposals={proposals}
          loading={listLoading}
          error={listError}
          onRetry={refetchList}
        />
      </div>

      <div className={styles.callout}>
        <div>
          <h2 className={styles.calloutTitle}>Start a new proposal</h2>
          <p className={styles.calloutText}>
            Draft a proposal from scratch and send it to a client.
          </p>
        </div>

        <Link to="/new" className={styles.primaryAction}>
          New proposal
        </Link>
      </div>
    </section>
  )
}

export default Dashboard
