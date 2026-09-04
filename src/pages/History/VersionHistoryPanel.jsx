import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '../../utils/format.js'
import {
  diffSnapshots,
  latestVersionNumber,
  versionLabel,
} from '../../models/proposalVersion.js'
import {
  canCompareProposalVersions,
  canCreateProposalVersion,
  canDeleteDraftVersion,
  canRestoreProposalVersion,
} from '../../models/versionAccess.js'
import { useExportProposalPdf } from '../../hooks/useExportProposalPdf.js'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import VersionBadges from './VersionBadges.jsx'
import VersionCompare from './VersionCompare.jsx'
import VersionPreview from './VersionPreview.jsx'
import styles from './VersionHistoryPanel.module.css'

function VersionHistoryPanel({
  proposal,
  onClose,
  onRestore,
  restoring,
  restoreError,
  onSaveVersion,
  savingVersion,
  saveVersionError,
  onDeleteVersion,
  deleting,
  deleteError,
}) {
  const versions = useMemo(() => {
    return [...(proposal.versions ?? [])].sort(
      (a, b) => b.versionNumber - a.versionNumber,
    )
  }, [proposal.versions])

  const latest = latestVersionNumber(proposal.versions)
  const [selectedId, setSelectedId] = useState(
    () => versions.find((version) => version.versionNumber === latest)?.versionId
      ?? versions[0]?.versionId
      ?? null,
  )
  const [comparing, setComparing] = useState(false)
  const [compareAId, setCompareAId] = useState(null)
  const [compareBId, setCompareBId] = useState(null)
  const [toast, setToast] = useState('')
  const { runExport, exporting, error: exportError } = useExportProposalPdf()

  const selected = versions.find(
    (version) => version.versionId === selectedId || version.id === selectedId,
  )
  const isCurrent = selected?.versionNumber === proposal.currentVersion
  const compareA =
    versions.find((version) => version.versionId === compareAId || version.id === compareAId)
    ?? selected
  const compareB =
    versions.find((version) => version.versionId === compareBId || version.id === compareBId)
    ?? versions.find((version) => version.versionNumber === latest)
    ?? versions[0]

  const canRestore = canRestoreProposalVersion()
  const canCompare = canCompareProposalVersions()
  const canSave = canCreateProposalVersion()
  const canDelete = selected ? canDeleteDraftVersion(selected) : false
  const busy = restoring || savingVersion || deleting || Boolean(exporting)

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function handleRestore() {
    if (!selected || isCurrent || restoring || !canRestore) return
    const next = await onRestore(selected.versionId || selected.id)
    if (next) setToast('Version restored')
  }

  async function handleDownloadPdf() {
    if (!selected || exporting) return
    const ok = await runExport(proposal, 'download', { version: selected })
    if (ok) setToast('PDF downloaded')
  }

  function handleCompare() {
    if (!selected) return
    const other =
      versions.find((version) => version.versionNumber === latest && version.versionId !== selected.versionId)
      ?? versions.find((version) => version.versionId !== selected.versionId)
    setCompareAId(selected.versionId)
    setCompareBId(other?.versionId ?? selected.versionId)
    setComparing((open) => {
      const next = !open
      if (next) setToast('Comparison ready')
      return next
    })
  }

  async function handleSaveVersion() {
    if (!onSaveVersion || busy) return
    const next = await onSaveVersion()
    if (next) setToast('Version saved')
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
              History
            </h2>
            <p className={styles.intro}>
              Every milestone keeps a snapshot. Restore adds a new latest version
              instead of deleting older ones.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        {toast ? (
          <p className={styles.toast} role="status">
            {toast}
          </p>
        ) : null}

        {restoreError ? (
          <p className={styles.error} role="alert">
            {restoreError.message || 'Could not restore this version.'}
          </p>
        ) : null}

        {saveVersionError ? (
          <p className={styles.error} role="alert">
            {saveVersionError.message || 'Could not save a version.'}
          </p>
        ) : null}

        {deleteError ? (
          <p className={styles.error} role="alert">
            {deleteError.message || 'Could not delete this version.'}
          </p>
        ) : null}

        {exportError ? (
          <p className={styles.error} role="alert">
            {exportError.message || 'Could not generate the PDF. Please try again.'}
          </p>
        ) : null}

        {onSaveVersion && canSave ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={handleSaveVersion}
              disabled={busy}
            >
              {savingVersion ? 'Saving version…' : 'Save version'}
            </button>
          </div>
        ) : null}

        {versions.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No versions recorded yet</p>
            <p className={styles.emptyHint}>
              Save a version to start this proposal’s history.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {versions.map((version) => {
              const active =
                version.versionId === selectedId || version.id === selectedId
              const isLatest = version.versionNumber === latest

              return (
                <li key={version.versionId || version.id} className={styles.item}>
                  <span
                    className={`${styles.dot} ${isLatest ? styles.dotLatest : ''} ${active ? styles.dotActive : ''}`}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className={`${styles.card} ${isLatest ? styles.cardLatest : ''} ${active ? styles.cardActive : ''}`}
                    aria-pressed={active}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setSelectedId(version.versionId || version.id)
                      setComparing(false)
                    }}
                  >
                    <span className={styles.versionNumber}>
                      v{version.versionNumber}
                    </span>
                    <p className={styles.versionAction}>
                      {version.reason || versionLabel(version).replace(/^v\d+\s+/, '')}
                    </p>
                    <p className={styles.metaRow}>
                      <span className={styles.date}>{formatDate(version.createdAt)}</span>
                      <span className={styles.metaSep} aria-hidden="true">
                        •
                      </span>
                      <span className={styles.user}>
                        {version.createdBy || version.updatedBy || 'Studio'}
                      </span>
                    </p>
                    <div className={styles.statusRow}>
                      <VersionBadges
                        version={version}
                        currentVersion={proposal.currentVersion}
                        latestVersion={latest}
                      />
                      <StatusBadge compact status={version.status} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {selected ? (
          <div className={styles.actions}>
            {canRestore ? (
              <button
                type="button"
                className={styles.primary}
                onClick={handleRestore}
                disabled={isCurrent || busy}
              >
                {restoring ? 'Restoring…' : 'Restore version'}
              </button>
            ) : null}
            {canCompare ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={handleCompare}
                disabled={busy}
              >
                {comparing ? 'Hide comparison' : 'Compare'}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.ghost}
              onClick={handleDownloadPdf}
              disabled={busy}
            >
              {exporting === 'download' ? 'Preparing PDF…' : 'Download PDF'}
            </button>
            {canDelete && onDeleteVersion ? (
              <button
                type="button"
                className={styles.danger}
                onClick={() => onDeleteVersion(selected.versionId || selected.id)}
                disabled={busy || versions.length <= 1}
              >
                {deleting ? 'Deleting…' : 'Delete draft'}
              </button>
            ) : null}
          </div>
        ) : null}

        {comparing && selected && canCompare ? (
          <div className={styles.compareWrap}>
            <div className={styles.selectRow}>
              <label className={styles.selectField}>
                Version A
                <select
                  className={styles.select}
                  value={compareA?.versionId ?? ''}
                  onChange={(event) => setCompareAId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option key={version.versionId} value={version.versionId}>
                      {versionLabel(version)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.selectField}>
                Version B
                <select
                  className={styles.select}
                  value={compareB?.versionId ?? ''}
                  onChange={(event) => setCompareBId(event.target.value)}
                >
                  {versions.map((version) => (
                    <option key={`b-${version.versionId}`} value={version.versionId}>
                      {versionLabel(version)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <VersionCompare
              rows={
                compareA && compareB
                  ? diffSnapshots(compareA.snapshot, compareB.snapshot).filter(
                      (row) =>
                        !['blocksAdded', 'blocksRemoved', 'filesAdded', 'filesRemoved'].includes(
                          row.key,
                        ) || row.changed,
                    )
                  : []
              }
              leftLabel={compareA ? versionLabel(compareA) : 'Version A'}
              rightLabel={compareB ? versionLabel(compareB) : 'Version B'}
            />
          </div>
        ) : null}

        {selected && !comparing ? <VersionPreview version={selected} /> : null}
      </aside>
    </div>
  )
}

export default VersionHistoryPanel
