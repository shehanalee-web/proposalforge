import { formatCurrency, formatDate } from '../../utils/format.js'
import StatusBadge from './StatusBadge.jsx'
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
            <th scope="col">Updated</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal) => (
            <tr key={proposal.id}>
              <td data-label="Proposal">
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
              <td data-label="Value" className={styles.numeric}>
                {formatCurrency(proposal.amount, proposal.currency)}
              </td>
              <td data-label="Updated">{formatDate(proposal.updatedAt)}</td>
              <td data-label="Status">
                <StatusBadge status={proposal.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ProposalList
