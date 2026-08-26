import styles from './blocks.module.css'

function TermsBlock({ proposal }) {
  const hasTerms = Boolean(proposal.terms?.trim())

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Terms & conditions</h3>
      {hasTerms ? (
        <p className={`${styles.body} ${styles.prewrap}`}>{proposal.terms}</p>
      ) : (
        <p className={styles.empty}>No terms specified.</p>
      )}
    </section>
  )
}

export default TermsBlock
