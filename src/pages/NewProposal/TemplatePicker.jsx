import { Link } from 'react-router'
import { useTemplates } from '../../hooks/useTemplates.js'
import { formatCurrency } from '../../utils/format.js'
import { getLayout } from '../../layouts/registry.js'
import styles from './NewProposal.module.css'

function TemplatePicker({ onSelect }) {
  const { templates, loading, error, refetch } = useTemplates()

  if (error) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>Could not load templates</p>
        <p className={styles.stateText}>
          {error.message || 'Something went wrong while fetching templates.'}
        </p>
        <button type="button" className={styles.retry} onClick={refetch}>
          Try again
        </button>
      </div>
    )
  }

  if (loading && templates.length === 0) {
    return (
      <div className={styles.skeleton} aria-hidden="true">
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>No templates yet</p>
        <p className={styles.stateText}>
          Create a template first, then come back to start a proposal from it.
        </p>
        <Link to="/templates/new" className={styles.choiceAction}>
          Create template
        </Link>
      </div>
    )
  }

  return (
    <ul className={styles.pickerList}>
      {templates.map((template) => (
        <li key={template.id} className={styles.pickerCard}>
          <div>
            <h3 className={styles.choiceTitle}>{template.title}</h3>
            <p className={styles.choiceText}>
              {template.description || 'No description'}
            </p>
            <p className={styles.pickerMeta}>
              {formatCurrency(template.amount, template.currency)}
              {' · '}
              {getLayout(template.defaultLayoutId).label}
            </p>
          </div>
          <button
            type="button"
            className={styles.choiceAction}
            onClick={() => onSelect(template)}
          >
            Use template
          </button>
        </li>
      ))}
    </ul>
  )
}

export default TemplatePicker
