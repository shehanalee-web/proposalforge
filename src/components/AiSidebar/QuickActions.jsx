import Icon from '../Icon/Icon.jsx'
import SidebarSection from './SidebarSection.jsx'
import styles from './QuickActions.module.css'

/**
 * Quick AI action buttons. Each fires `onAction(id)` so the
 * editor can route it to an AI provider in the future.
 */

const ACTIONS = [
  { id: 'improve-summary', label: 'Improve summary', icon: 'blockText' },
  { id: 'generate-faq', label: 'Generate FAQ', icon: 'blockFaq' },
  { id: 'write-terms', label: 'Draft terms', icon: 'blockTerms' },
  { id: 'add-testimonial', label: 'Suggest testimonial', icon: 'blockTestimonials' },
  { id: 'expand-scope', label: 'Expand scope text', icon: 'blockDeliverables' },
  { id: 'polish-tone', label: 'Polish tone', icon: 'spark' },
]

function QuickActions({ onAction }) {
  return (
    <SidebarSection title="Quick Actions" icon="spark">
      <div className={styles.grid}>
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            className={styles.action}
            onClick={() => onAction?.(action.id)}
          >
            <Icon name={action.icon} size={14} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </SidebarSection>
  )
}

export default QuickActions
