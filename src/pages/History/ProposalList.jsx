import { Link } from 'react-router'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { getDisplayStatus } from '../../models/proposal.js'
import styles from './ProposalList.module.css'

function ProposalList({ proposals }) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>Proposal history</caption>
        <thead>
          <tr>
            <th scope="col">Proposal</th>
            <th scope="col">Client</th>
            <th scope="col" className={styles.numeric}>
              Value
            </th>
            <th scope="col">Last viewed</th>
            <th scope="col">Accepted</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal) => (
            <tr key={proposal.id}>
              <td data-label="Proposal">
                <span className={styles.stack}>
                  <Link
                    to={`/history/${proposal.id}`}
                    className={styles.primary}
                  >
                    {proposal.title}
                  </Link>
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
              <td data-label="Value" className={styles.numeric}>
                {formatCurrency(proposal.amount, proposal.currency)}
              </td>
              <td data-label="Last viewed">
                {formatDateTime(proposal.lastViewedAt)}
              </td>
              <td data-label="Accepted">
                {formatDateTime(proposal.acceptedAt)}
              </td>
              <td data-label="Status">
                <StatusBadge status={getDisplayStatus(proposal)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ProposalList
