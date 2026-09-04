import SidebarSection from './SidebarSection.jsx'
import styles from './WorkspaceMemory.module.css'

/**
 * Placeholder for workspace memory — brand voice, past decisions,
 * tone preferences. Will be populated by an AI memory store.
 */

const PLACEHOLDER = [
  { id: 1, label: 'Brand voice', value: 'Professional, concise' },
  { id: 2, label: 'Default currency', value: 'USD' },
  { id: 3, label: 'Preferred tone', value: 'Confident, warm' },
  { id: 4, label: 'Company name', value: 'ProposalForge Studio' },
]

function WorkspaceMemory({ entries = PLACEHOLDER }) {
  return (
    <SidebarSection title="Workspace Memory" icon="brand" defaultOpen={false}>
      <dl className={styles.list}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.row}>
            <dt className={styles.label}>{entry.label}</dt>
            <dd className={styles.value}>{entry.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.hint}>
        Memory persists across proposals. Connect an AI service to learn
        preferences over time.
      </p>
    </SidebarSection>
  )
}

export default WorkspaceMemory
