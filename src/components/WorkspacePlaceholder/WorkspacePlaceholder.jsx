import { getWorkspaceModule } from '../../workspace/registry.js'
import styles from './WorkspacePlaceholder.module.css'

function WorkspacePlaceholder({ moduleId, children, action }) {
  const module = getWorkspaceModule(moduleId)

  if (!module) return null

  return (
    <section className={styles.page}>
      <p className={styles.intro}>{module.summary}</p>

      <div className={styles.panel}>
        <p className={styles.kicker}>Workspace library</p>
        <p className={styles.description}>{module.description}</p>

        {module.capabilities.length > 0 ? (
          <ul className={styles.list}>
            {module.capabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        {children}

        {action}
      </div>
    </section>
  )
}

export default WorkspacePlaceholder
