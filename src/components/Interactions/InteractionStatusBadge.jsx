import { getInteractionStatusMeta } from '../../interactions/statuses.js'
import styles from './InteractionStatusBadge.module.css'

function InteractionStatusBadge({ status, compact = false }) {
  const meta = getInteractionStatusMeta(status)
  const tone = styles[meta.tone] ?? styles.neutral

  return (
    <span className={`${styles.badge} ${tone} ${compact ? styles.compact : ''}`}>
      {meta.label}
    </span>
  )
}

export default InteractionStatusBadge
