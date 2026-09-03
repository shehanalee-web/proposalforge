import styles from './VersionBadges.module.css'

function VersionBadges({ version, currentVersion, latestVersion }) {
  const badges = []

  if (version.versionNumber === latestVersion) {
    badges.push({ key: 'latest', label: 'Latest' })
  }

  if (version.versionNumber === currentVersion) {
    badges.push({ key: 'current', label: 'Current' })
  }

  if (version.restoredFrom != null) {
    badges.push({ key: 'restored', label: 'Restored' })
  }

  if (badges.length === 0) return null

  return (
    <ul className={styles.list}>
      {badges.map((badge) => (
        <li key={badge.key} className={`${styles.badge} ${styles[badge.key]}`}>
          {badge.label}
        </li>
      ))}
    </ul>
  )
}

export default VersionBadges
