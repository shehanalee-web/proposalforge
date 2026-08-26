import styles from './blocks.module.css'

function SummaryBlock({ proposal }) {
  if (!proposal.summary) return null

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Project summary</h3>
      <p className={styles.body}>{proposal.summary}</p>
    </section>
  )
}

export default SummaryBlock
