import { Link } from 'react-router'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import WorkflowStatusBadge from '../../components/Workflow/WorkflowStatusBadge.jsx'
import PortalStatusBadge from '../../components/ProposalPortal/PortalStatusBadge.jsx'
import { getDisplayStatus } from '../../models/proposal.js'
import { getViewCount } from '../../models/commercialQueues.js'
import { EMAIL_DELIVERY_STATUS_LABELS } from '../../models/emailDelivery.js'
import {
  handleCardClick,
  handleCardLinkKeyDown,
} from '../../utils/cardNavigation.js'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import { proposalPath } from '../../workspace/paths.js'
import { useWorkflowMap } from '../../hooks/useWorkflowMap.js'
import { usePortalMap } from '../../hooks/usePortalMap.js'
import styles from './RecentProposals.module.css'

const SKELETON_ROWS = 4

function RecentProposals({ proposals = [], loading, error, onRetry }) {
  const { statusOf } = useWorkflowMap(proposals.map((item) => item.id))
  const { statusOf: portalStatusOf } = usePortalMap(proposals.map((item) => item.id))
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
        <li
          key={proposal.id}
          className={styles.row}
          onClick={handleCardClick}
        >
          <Link
            to={proposalPath(proposal.id)}
            className={styles.cardLink}
            data-card-link
            aria-label={proposal.title}
            onKeyDown={handleCardLinkKeyDown}
          />
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
              {getViewCount(proposal)} views
              {proposal.lastEmail?.status
                ? ` · ${EMAIL_DELIVERY_STATUS_LABELS[proposal.lastEmail.status] ?? proposal.lastEmail.status}`
                : ''}
              {proposal.lastViewedAt
                ? ` · Viewed ${formatDateTime(proposal.lastViewedAt)}`
                : proposal.acceptedAt
                  ? ` · Accepted ${formatDateTime(proposal.acceptedAt)}`
                  : ` · ${formatDateTime(proposal.updatedAt)}`}
            </span>
          </div>

          <div className={styles.badges}>
            {portalStatusOf(proposal.id) ? (
              <PortalStatusBadge status={portalStatusOf(proposal.id)} compact />
            ) : null}
            <WorkflowStatusBadge status={statusOf(proposal.id)} compact />
            <StatusBadge status={getDisplayStatus(proposal)} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default RecentProposals
