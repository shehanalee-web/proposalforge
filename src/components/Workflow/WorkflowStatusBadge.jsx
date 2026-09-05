import { getWorkflowStatusMeta } from '../../workflow/statuses.js'
import styles from './WorkflowStatusBadge.module.css'

function WorkflowStatusBadge({ status, compact = false }) {
  const meta = getWorkflowStatusMeta(status)
  const tone = styles[meta.tone] ?? styles.neutral

  return (
    <span
      className={`${styles.badge} ${tone} ${compact ? styles.compact : ''}`}
      data-card-interactive
    >
      {meta.label}
    </span>
  )
}

export default WorkflowStatusBadge
