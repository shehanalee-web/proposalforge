import { getFollowupStatusMeta } from '../../followup/statuses.js'
import styles from './FollowupStatusBadge.module.css'

function FollowupStatusBadge({ status, compact = false }) {
  const meta = getFollowupStatusMeta(status)
  const tone = styles[meta.tone] ?? styles.neutral

  return (
    <span className={`${styles.badge} ${tone} ${compact ? styles.compact : ''}`}>
      {meta.label}
    </span>
  )
}

export default FollowupStatusBadge
