import styles from './blocks.module.css'

function SectionRenderer({ proposal }) {
  const sections = proposal.sections ?? []

  return (
    <section className={styles.block}>
      <h3 className={styles.blockTitle}>Proposal</h3>
      {sections.length > 0 ? (
        <ol className={styles.sections}>
          {sections.map((section) => (
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
  )
}

export default SectionRenderer
