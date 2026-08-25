import { PROPOSAL_STATUS_LABELS } from '../../models/proposal.js'
import styles from './StatusBadge.module.css'

function StatusBadge({ status }) {
  const label = PROPOSAL_STATUS_LABELS[status] ?? status
  const variant = styles[status] ?? ''

  return <span className={`${styles.badge} ${variant}`}>{label}</span>
}

export default StatusBadge
