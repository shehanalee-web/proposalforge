import WorkspacePlaceholder from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.jsx'
import styles from '../../components/WorkspacePlaceholder/WorkspacePlaceholder.module.css'
import { listAssets } from '../../services/assetService.js'
import { WORKSPACE_MODULE } from '../../workspace/ids.js'

function formatBytes(bytes) {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function Assets() {
  const assets = listAssets()

  return (
    <WorkspacePlaceholder moduleId={WORKSPACE_MODULE.ASSETS}>
      {assets.length === 0 ? (
        <p className={styles.emptyNote}>
          No files yet. Uploads from Brand Kit and proposal blocks appear here.
        </p>
      ) : (
        <ul className={styles.records}>
          {assets.map((asset) => (
            <li key={asset.id} className={styles.record}>
              {asset.thumbnailUrl || asset.url ? (
                <img
                  src={asset.thumbnailUrl || asset.url}
                  alt=""
                  className={styles.thumb}
                />
              ) : (
                <span className={styles.portraitFallback}>File</span>
              )}
              <div className={styles.recordBody}>
                <p className={styles.recordTitle}>{asset.name}</p>
                <p className={styles.recordMeta}>
                  {asset.kind}
                  {asset.sizeBytes ? ` · ${formatBytes(asset.sizeBytes)}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePlaceholder>
  )
}

export default Assets
