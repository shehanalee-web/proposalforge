import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useFollowupOverview } from '../../hooks/useFollowupOverview.js'
import FollowupStatusBadge from '../../components/Followup/FollowupStatusBadge.jsx'
import { FOLLOWUP_REASON, FOLLOWUP_STATUS } from '../../followup/types.js'
import { FOLLOWUP_REASON_LABELS } from '../../followup/statuses.js'
import { formatDate } from '../../utils/format.js'
import { proposalEditPath } from '../../workspace/paths.js'
import styles from './Followups.module.css'

function Followups() {
  const { overview, loading, error, refetch } = useFollowupOverview()
  const [statusFilter, setStatusFilter] = useState('open')
  const [reasonFilter, setReasonFilter] = useState('all')

  const filtered = useMemo(() => {
    const list = overview?.followups ?? []
    return list.filter((item) => {
      if (statusFilter === 'open') {
        if (item.status !== FOLLOWUP_STATUS.OPEN && item.status !== FOLLOWUP_STATUS.IN_PROGRESS) {
          return false
        }
      } else if (statusFilter === 'overdue') {
        if (!item.overdue) return false
      } else if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      if (reasonFilter !== 'all' && item.reason !== reasonFilter) return false
      return true
    })
  }, [overview, statusFilter, reasonFilter])

  return (
    <section className={`studio-page ${styles.page}`}>
      <div className={styles.heading}>
        <p className={styles.kicker}>Studio</p>
        <h1 className={styles.title}>Follow-up</h1>
        <p className={styles.lead}>
          Actionable next steps from proposal, workflow, portal, and client
          interactions. Nothing is sent automatically.
        </p>
      </div>

      {error ? (
        <div className={`studio-panel ${styles.state}`}>
          <p className={styles.stateTitle}>Could not load follow-ups</p>
          <button type="button" className={styles.action} onClick={refetch}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <ul className={styles.stats}>
            {[
              { label: 'Due today', value: overview.dueToday },
              { label: 'Overdue', value: overview.overdue },
              { label: 'Waiting for client', value: overview.waitingForClient },
              { label: 'Expiring', value: overview.expiring },
              { label: 'Client feedback', value: overview.clientFeedback },
            ].map((card) => (
              <li key={card.label} className={`studio-panel ${styles.stat}`}>
                <span className={styles.statLabel}>{card.label}</span>
                <span className={styles.statValue}>{loading ? '—' : String(card.value ?? 0)}</span>
              </li>
            ))}
          </ul>

          <div className={`studio-panel ${styles.panel}`}>
            <div className={styles.filters}>
              <label className={styles.field}>
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="overdue">Overdue</option>
                  <option value={FOLLOWUP_STATUS.COMPLETED}>Completed</option>
                  <option value={FOLLOWUP_STATUS.DISMISSED}>Dismissed</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className={styles.field}>
                Reason
                <select
                  value={reasonFilter}
                  onChange={(event) => setReasonFilter(event.target.value)}
                >
                  <option value="all">All reasons</option>
                  {Object.values(FOLLOWUP_REASON).map((reason) => (
                    <option key={reason} value={reason}>
                      {FOLLOWUP_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading && !overview.followups?.length ? (
              <p className={styles.empty}>Loading follow-ups…</p>
            ) : filtered.length === 0 ? (
              <p className={styles.empty}>No follow-ups in this filter.</p>
            ) : (
              <ul className={styles.list}>
                {filtered.map((item) => (
                  <li key={item.id}>
                    <Link to={proposalEditPath(item.proposalId)} className={styles.row}>
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle}>
                          {item.proposalTitle || item.title}
                        </span>
                        <span className={styles.rowMeta}>
                          {item.title}
                          {item.ownerName ? ` · ${item.ownerName}` : ''}
                          {item.dueAt ? ` · Due ${formatDate(item.dueAt)}` : ''}
                        </span>
                      </span>
                      <span className={styles.rowSide}>
                        <FollowupStatusBadge status={item.status} compact />
                        <span className={styles.stamp}>
                          {FOLLOWUP_REASON_LABELS[item.reason] || item.reason}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default Followups
