import { useMemo, useState } from 'react'
import { formatDate, formatTime } from '../../utils/format.js'
import {
  diffSnapshots,
  latestVersionNumber,
  snapshotFromProposal,
} from '../../models/proposalVersion.js'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import VersionBadges from './VersionBadges.jsx'
import VersionCompare from './VersionCompare.jsx'
import styles from './VersionHistoryPanel.module.css'

function VersionHistoryPanel({
  proposal,
  onClose,
  onRestore,
  restoring,
  restoreError,
}) {
  const versions = useMemo(() => {
    return [...(proposal.versions ?? [])].sort(
      (a, b) => b.versionNumber - a.versionNumber,
    )
  }, [proposal.versions])

  const latest = latestVersionNumber(proposal.versions)
  const [selectedId, setSelectedId] = useState(
    () => versions.find((version) => version.versionNumber !== latest)?.versionId
      ?? versions[0]?.versionId
      ?? null,
  )
  const [comparing, setComparing] = useState(false)

  const selected = versions.find((version) => version.versionId === selectedId)
  const isCurrent = selected?.versionNumber === proposal.currentVersion
  const compareRows = selected
    ? diffSnapshots(snapshotFromProposal(proposal), selected.snapshot)
    : []

  function handleRestore() {
    if (!selected || isCurrent || restoring) return
    onRestore(selected.versionId)
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="version-history-title" className={styles.title}>
              Version history
            </h2>
            <p className={styles.intro}>
              Every save keeps a snapshot. Restore adds a new latest version
              instead of deleting older ones.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        {restoreError ? (
          <p className={styles.error} role="alert">
            {restoreError.message || 'Could not restore this version.'}
          </p>
        ) : null}

        {versions.length === 0 ? (
          <p className={styles.empty}>No versions recorded yet.</p>
        ) : (
          <ul className={styles.list}>
            {versions.map((version) => {
              const active = version.versionId === selectedId

              return (
                <li key={version.versionId}>
                  <button
                    type="button"
                    className={`${styles.card} ${active ? styles.cardActive : ''}`}
                    onClick={() => {
                      setSelectedId(version.versionId)
                      setComparing(false)
                    }}
                  >
                    <div className={styles.cardTop}>
                      <p className={styles.versionName}>
                        Version {version.versionNumber}
                      </p>
                      <VersionBadges
                        version={version}
                        currentVersion={proposal.currentVersion}
                        latestVersion={latest}
                      />
                    </div>
                    <p className={styles.date}>{formatDate(version.createdAt)}</p>
                    <p className={styles.time}>{formatTime(version.createdAt)}</p>
                    <StatusBadge status={version.status} />
                    {version.restoredFrom != null ? (
                      <p className={styles.restoredFrom}>
                        Restored from Version {version.restoredFrom}
                      </p>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {selected ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={handleRestore}
              disabled={isCurrent || restoring}
            >
              {restoring ? 'Restoring…' : 'Restore version'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setComparing((open) => !open)}
            >
              {comparing ? 'Hide comparison' : 'Compare with current'}
            </button>
          </div>
        ) : null}

        {comparing && selected ? (
          <div className={styles.compareWrap}>
            <VersionCompare rows={compareRows} />
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export default VersionHistoryPanel
