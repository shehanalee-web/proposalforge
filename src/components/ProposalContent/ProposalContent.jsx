import { formatCurrency } from '../../utils/format.js'
import { getPricingRows, sumAmounts } from '../../utils/proposalPricing.js'
import styles from './ProposalContent.module.css'

function ProposalContent({ proposal, showNotes = true, showTags = true }) {
  const rows = getPricingRows(proposal)
  const total = sumAmounts(rows)
  const hasSections = proposal.sections.length > 0
  const hasTerms = Boolean(proposal.terms?.trim())
  const hasNotes = showNotes && Boolean(proposal.notes?.trim())
  const hasTags = showTags && proposal.tags.length > 0

  return (
    <div className={styles.content}>
      {proposal.summary ? (
        <section className={styles.block}>
          <h3 className={styles.blockTitle}>Project summary</h3>
          <p className={styles.body}>{proposal.summary}</p>
        </section>
      ) : null}

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Proposal</h3>
        {hasSections ? (
          <ol className={styles.sections}>
            {proposal.sections.map((section) => (
              <li key={section.id} className={styles.section}>
                <h4 className={styles.sectionHeading}>{section.heading}</h4>
                <p className={styles.body}>{section.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No sections on this proposal yet.</p>
        )}
      </section>

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

      <section className={styles.block}>
        <h3 className={styles.blockTitle}>Terms & conditions</h3>
        {hasTerms ? (
          <p className={`${styles.body} ${styles.prewrap}`}>{proposal.terms}</p>
        ) : (
          <p className={styles.empty}>No terms specified.</p>
        )}
      </section>

      {hasNotes ? (
        <section className={styles.block}>
          <h3 className={styles.blockTitle}>Notes</h3>
          <p className={`${styles.body} ${styles.prewrap}`}>{proposal.notes}</p>
        </section>
      ) : null}

      {hasTags ? (
        <ul className={styles.tags}>
          {proposal.tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default ProposalContent
