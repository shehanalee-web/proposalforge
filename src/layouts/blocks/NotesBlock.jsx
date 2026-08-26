import styles from './blocks.module.css'

function NotesBlock({ proposal }) {
  if (!proposal.notes?.trim()) return null

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Notes</h3>
      <p className={`${styles.body} ${styles.prewrap}`}>{proposal.notes}</p>
    </section>
  )
}

export default NotesBlock
