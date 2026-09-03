import { resolvePaymentTerms, resolveTermsBody } from '../../blocks/brand.js'
import styles from './blocks.module.css'

function TermsBlock({ proposal, brand }) {
  const body = resolveTermsBody(null, proposal, brand)
  const payment = resolvePaymentTerms(null, proposal, brand)

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
    </section>
  )
}

export default TermsBlock
