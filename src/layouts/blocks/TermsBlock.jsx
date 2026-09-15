import {
  resolveBankDetails,
  resolvePaymentTerms,
  resolveTermsBody,
} from '../../blocks/brand.js'
import styles from './blocks.module.css'

function TermsBlock({ proposal, brand }) {
  const body = resolveTermsBody(null, proposal, brand)
  const payment = resolvePaymentTerms(null, proposal, brand)
  const bank = resolveBankDetails(brand)

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Terms & conditions</h3>
      {body ? (
        <p className={`${styles.body} ${styles.prewrap}`}>{body}</p>
      ) : (
        <p className={styles.empty}>No terms specified.</p>
      )}
      {payment ? (
        <>
          <h3 className={styles.blockTitle}>Payment terms</h3>
          <p className={`${styles.body} ${styles.prewrap}`}>{payment}</p>
        </>
      ) : null}
      {bank.length > 0 ? (
        <>
          <h3 className={styles.blockTitle}>Payment details</h3>
          {bank.map((row) => (
            <p key={row.id} className={styles.body}>
              {row.label}: {row.value}
            </p>
          ))}
        </>
      ) : null}
    </section>
  )
}

export default TermsBlock
