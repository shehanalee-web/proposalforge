import Icon from '../Icon/Icon.jsx'
import SidebarSection from './SidebarSection.jsx'
import styles from './RecentChanges.module.css'

/**
 * Placeholder timeline of recent AI-made edits.
 * Entries will come from an AI action log in the future.
 */

const PLACEHOLDER = [
  { id: 1, text: 'No AI changes yet', time: 'just now', icon: 'spark' },
]

function RecentChanges({ entries = PLACEHOLDER }) {
  return (
    <SidebarSection title="Recent AI Changes" icon="history" defaultOpen={false}>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.item}>
            <Icon name={entry.icon} size={12} className={styles.icon} />
            <div className={styles.content}>
              <span className={styles.text}>{entry.text}</span>
              <span className={styles.time}>{entry.time}</span>
            </div>
          </li>
        ))}
      </ul>
    </SidebarSection>
  )
}

export default RecentChanges
