import { getPortalStatusMeta } from '../../portal/statuses.js'
import styles from './PortalStatusBadge.module.css'

function PortalStatusBadge({ status, compact = false }) {
  const meta = getPortalStatusMeta(status)
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

export default PortalStatusBadge
