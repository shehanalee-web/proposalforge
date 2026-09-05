import { Link } from 'react-router'
import { formatCurrency, formatDateTime, formatRelativeTime } from '../../utils/format.js'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import WorkflowStatusBadge from '../../components/Workflow/WorkflowStatusBadge.jsx'
import { getDisplayStatus } from '../../models/proposal.js'
import { getLastActivityAt, getViewCount } from '../../models/commercialQueues.js'
import { EMAIL_DELIVERY_STATUS_LABELS } from '../../models/emailDelivery.js'
import {
  handleCardClick,
  handleCardLinkKeyDown,
} from '../../utils/cardNavigation.js'
import { proposalPath } from '../../workspace/paths.js'
import { useWorkflowMap } from '../../hooks/useWorkflowMap.js'
import styles from './ProposalList.module.css'

function ProposalList({ proposals }) {
  const { statusOf } = useWorkflowMap(proposals.map((item) => item.id))
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>Proposals</caption>
        <thead>
          <tr>
            <th scope="col">Proposal</th>
            <th scope="col">Client</th>
            <th scope="col">Owner</th>
            <th scope="col" className={styles.numeric}>
              Value
            </th>
            <th scope="col" className={styles.numeric}>
              Views
            </th>
            <th scope="col">Email</th>
            <th scope="col">Last activity</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal) => {
            const emailStatus = proposal.lastEmail?.status
            return (
            <tr key={proposal.id} className={styles.row} onClick={handleCardClick}>
              <td data-label="Proposal">
                <Link
                  to={proposalPath(proposal.id)}
                  className={styles.cardLink}
                  data-card-link
                  aria-label={proposal.title}
                  onKeyDown={handleCardLinkKeyDown}
                />
                <span className={styles.stack}>
                  <span className={styles.primary}>{proposal.title}</span>
                  <span className={styles.secondary}>
                    {proposal.projectType}
                  </span>
                </span>
              </td>
              <td data-label="Client">
                <span className={styles.stack}>
                  <span className={styles.primary}>{proposal.clientName}</span>
                  <span className={styles.secondary}>{proposal.company}</span>
                </span>
              </td>
              <td data-label="Owner">{proposal.ownerName || 'Studio'}</td>
              <td data-label="Value" className={styles.numeric}>
                {formatCurrency(proposal.amount, proposal.currency)}
              </td>
              <td data-label="Views" className={styles.numeric}>
                {getViewCount(proposal)}
              </td>
              <td data-label="Email">
                {emailStatus ? (
                  <StatusBadge
                    status={emailStatus}
                    label={EMAIL_DELIVERY_STATUS_LABELS[emailStatus] ?? emailStatus}
                    compact
                  />
                ) : (
                  '—'
                )}
              </td>
              <td data-label="Last activity">
                <span className={styles.stack}>
                  <span className={styles.primary}>
                    {formatRelativeTime(getLastActivityAt(proposal))}
                  </span>
                  <span className={styles.secondary}>
                    Created {formatDateTime(proposal.createdAt)}
                    {' · '}
                    Updated {formatDateTime(proposal.updatedAt)}
                  </span>
                </span>
              </td>
              <td data-label="Status">
                <span className={styles.statusPair}>
                  <WorkflowStatusBadge status={statusOf(proposal.id)} compact />
                  <StatusBadge status={getDisplayStatus(proposal)} />
                </span>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ProposalList
