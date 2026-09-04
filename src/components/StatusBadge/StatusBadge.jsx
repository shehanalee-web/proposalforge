import { PROPOSAL_STATUS_LABELS } from '../../models/proposal.js'
import styles from './StatusBadge.module.css'

function StatusBadge({ status, label: labelOverride, compact = false }) {
  const label = labelOverride ?? PROPOSAL_STATUS_LABELS[status] ?? status
  const variant = styles[status] ?? ''

  return (
    <span
      className={`${styles.badge} ${variant} ${compact ? styles.compact : ''}`}
      data-card-interactive
    >
      {label}
    </span>
  )
}

export default StatusBadge
