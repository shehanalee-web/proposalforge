import { VERSION_SOURCE } from '../../models/proposalVersion.js'
import styles from './VersionBadges.module.css'

function VersionBadges({ version, currentVersion, latestVersion }) {
  const badges = []

  if (version.versionNumber === currentVersion) {
    badges.push({ key: 'current', label: 'Current', weight: 'primary' })
  }

  if (version.versionNumber === latestVersion) {
    badges.push({ key: 'latest', label: 'Latest', weight: 'primary' })
  }

  if (version.source === VERSION_SOURCE.MANUAL) {
    badges.push({ key: 'manual', label: 'Manual Save', weight: 'secondary' })
  }

  if (version.restoredFrom != null || version.source === VERSION_SOURCE.RESTORED) {
    badges.push({ key: 'restored', label: 'Restored', weight: 'secondary' })
  }

  if (version.source === VERSION_SOURCE.SENT || version.source === VERSION_SOURCE.RESENT) {
    badges.push({ key: 'sent', label: 'Sent', weight: 'secondary' })
  }

  if (version.source === VERSION_SOURCE.APPROVED) {
    badges.push({ key: 'accepted', label: 'Accepted', weight: 'secondary' })
  }

  if (version.status === 'viewed') {
    badges.push({ key: 'viewed', label: 'Viewed', weight: 'secondary' })
  }

  if (badges.length === 0) return null

  return (
    <ul className={styles.list}>
      {badges.map((badge) => (
        <li
          key={badge.key}
          className={`${styles.badge} ${styles[badge.key] ?? ''} ${styles[badge.weight]}`}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  )
}

export default VersionBadges
