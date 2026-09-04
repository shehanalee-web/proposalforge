import { Link } from 'react-router'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { ACTIVITY_TITLES } from '../../models/activityEvent.js'
import { getDisplayStatus } from '../../models/proposal.js'
import { formatRelativeTime } from '../../utils/format.js'
import { proposalPath } from '../../workspace/paths.js'
import styles from './OperationalQueues.module.css'

function Queue({ title, items, empty, stamp }) {
  return (
    <div className={`studio-panel ${styles.panel}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((proposal) => (
            <li key={proposal.id}>
              <Link to={proposalPath(proposal.id)} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{proposal.title}</span>
                  <span className={styles.rowMeta}>
                    {proposal.clientName}
                    {proposal.company ? ` · ${proposal.company}` : ''}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <StatusBadge status={getDisplayStatus(proposal)} compact />
                  <span className={styles.stamp}>{stamp(proposal)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OperationalQueues({ overview, loading }) {
  const queues = overview?.queues ?? {}
  const stats = overview?.stats ?? {}
  const activity = overview?.recentActivity ?? []

  return (
    <div className={styles.wrap}>
      <ul className={styles.stats}>
        {[
          { key: 'followUp', label: 'Needs follow-up', value: stats.followUp },
          { key: 'expiring', label: 'Expiring soon', value: stats.expiring },
          { key: 'signature', label: 'Awaiting signature', value: stats.awaitingSignature },
          { key: 'payment', label: 'Awaiting payment', value: stats.awaitingPayment },
          { key: 'viewed', label: 'Client viewed', value: stats.viewed },
        ].map((card) => (
          <li key={card.key} className={`studio-panel ${styles.stat}`}>
            <span className={styles.statLabel}>{card.label}</span>
            <span className={styles.statValue}>{loading ? '—' : String(card.value ?? 0)}</span>
          </li>
        ))}
      </ul>

      <div className={styles.grid}>
        <Queue
          title="Needs follow-up"
          items={queues.needsFollowUp ?? []}
          empty="Nothing waiting on a follow-up."
          stamp={(item) =>
            item.lastViewedAt
              ? `Viewed ${formatRelativeTime(item.lastViewedAt)}`
              : 'Not opened yet'
          }
        />
        <Queue
          title="Expiring soon"
          items={queues.expiringSoon ?? []}
          empty="No proposals expire this week."
          stamp={(item) => `Valid until ${item.validUntil}`}
        />
        <Queue
          title="Awaiting signature"
          items={queues.awaitingSignature ?? []}
          empty="No signatures outstanding."
          stamp={(item) => item.signature?.signer || item.clientName}
        />
        <Queue
          title="Awaiting payment"
          items={queues.awaitingPayment ?? []}
          empty="No payments outstanding."
          stamp={(item) => item.payment?.status?.replace('_', ' ') || 'Due'}
        />
        <Queue
          title="Recently viewed"
          items={queues.recentlyViewed ?? []}
          empty="Clients have not opened a proposal yet."
          stamp={(item) => formatRelativeTime(item.lastViewedAt)}
        />

        <div className={`studio-panel ${styles.panel}`}>
          <div className={styles.head}>
            <h2 className={styles.title}>Recent activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className={styles.empty}>Activity will appear as proposals move.</p>
          ) : (
            <ul className={styles.list}>
              {activity.map((event) => (
                <li key={event.id}>
                  <Link
                    to={event.proposal_id ? proposalPath(event.proposal_id) : '#'}
                    className={styles.row}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>
                        {event.event_title || ACTIVITY_TITLES[event.event_type] || event.event_type}
                      </span>
                      <span className={styles.rowMeta}>
                        {event.metadata?.description || event.metadata?.detail || ''}
                      </span>
                    </span>
                    <span className={styles.stamp}>{formatRelativeTime(event.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default OperationalQueues
