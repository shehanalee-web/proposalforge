import { formatCurrency } from '../../utils/format.js'
import { getPricingRows, sumAmounts } from '../../utils/proposalPricing.js'
import styles from './blocks.module.css'

function PricingTable({ proposal }) {
  const rows = getPricingRows(proposal)
  const total = sumAmounts(rows)

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Investment</h3>
      <table className={styles.items}>
        <thead>
          <tr>
            <th scope="col">Description</th>
            <th scope="col" className={styles.itemAmount}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.description || '—'}</td>
              <td className={styles.itemAmount}>
                {formatCurrency(row.amount, proposal.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={styles.totals}>
        <div className={styles.totalRow}>
          <dt>Subtotal</dt>
          <dd>{formatCurrency(total, proposal.currency)}</dd>
        </div>
        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
          <dt>Total</dt>
          <dd>{formatCurrency(total, proposal.currency)}</dd>
        </div>
      </dl>
    </section>
  )
}

export default PricingTable
