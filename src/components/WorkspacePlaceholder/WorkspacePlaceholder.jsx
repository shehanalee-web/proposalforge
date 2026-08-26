import { getWorkspaceModule } from '../../workspace/registry.js'
import styles from './WorkspacePlaceholder.module.css'

function WorkspacePlaceholder({ moduleId, children }) {
  const module = getWorkspaceModule(moduleId)

  if (!module) return null

  return (
    <section className={styles.page}>
      <p className={styles.intro}>{module.summary}</p>

      <div className={styles.panel}>
        <p className={styles.kicker}>Foundation in place · editing later</p>
        <h2 className={styles.title}>{module.label}</h2>
        <p className={styles.description}>{module.description}</p>

        {module.capabilities.length > 0 ? (
          <ul className={styles.list}>
            {module.capabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        {children}
      </div>
    </section>
  )
}

export default WorkspacePlaceholder
