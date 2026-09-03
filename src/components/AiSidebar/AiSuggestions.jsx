import Icon from '../Icon/Icon.jsx'
import SidebarSection from './SidebarSection.jsx'
import styles from './AiSuggestions.module.css'

/**
 * Placeholder list of AI-generated suggestions.
 * Wire `items` prop to a real AI service later.
 */

const PLACEHOLDER_ITEMS = [
  { id: 1, text: 'Add a case study to strengthen the proposal', type: 'tip' },
  { id: 2, text: 'Executive summary could be more concise', type: 'warning' },
  { id: 3, text: 'Consider adding a timeline for client clarity', type: 'tip' },
]

function AiSuggestions({ items = PLACEHOLDER_ITEMS }) {
  return (
    <SidebarSection title="AI Suggestions" icon="spark" badge={items.length}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li
            key={item.id}
            className={`${styles.item} ${
              item.type === 'warning' ? styles.itemWarning : ''
            }`}
          >
            <Icon
              name={item.type === 'warning' ? 'close' : 'spark'}
              size={12}
              className={styles.icon}
            />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        Suggestions update as you edit. Connect an AI provider to enable.
      </p>
    </SidebarSection>
  )
}

export default AiSuggestions
