import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import { listAssets } from '../../services/assetService.js'
import { filterLibraryAssets } from './libraryAsset.js'
import styles from './AssetPicker.module.css'

/**
 * On-demand Asset Library chooser. Mount this only while the library UI is
 * open so listAssets() never runs for a closed picker or a bare ImageUpload.
 *
 * @param {{
 *   multiple?: boolean,
 *   selectedIds?: string[],
 *   variant?: 'image' | 'file',
 *   disabled?: boolean,
 *   onSelect?: (asset: import('../../models/asset.js').Asset) => void,
 *   onToggleId?: (id: string) => void,
 *   onClose?: () => void,
 * }} props
 */
function AssetPicker({
  multiple = false,
  selectedIds = [],
  variant = 'image',
  disabled = false,
  onSelect,
  onToggleId,
  onClose,
}) {
  const searchId = useId()
  const rootRef = useRef(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    listAssets()
      .then((records) => {
        if (cancelled) return
        setAssets(records)
        setError(null)
      })
      .catch((caught) => {
        if (cancelled) return
        setError(caught)
        setAssets([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) onClose?.()
    }

    function onKey(event) {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const visible = filterLibraryAssets(assets, { variant, query })

  function handlePick(asset) {
    if (disabled) return
    if (multiple) {
      onToggleId?.(asset.id)
      return
    }
    onSelect?.(asset)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.panel} role="dialog" aria-label="Asset Library">
        <div className={styles.searchRow}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <input
            id={searchId}
            type="text"
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter library…"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
          />
        </div>

        <ul className={styles.list}>
          {loading ? (
            <li className={styles.status}>Loading library…</li>
          ) : error ? (
            <li className={styles.status}>
              {error.message || 'Could not load the Asset Library.'}
            </li>
          ) : visible.length === 0 ? (
            <li className={styles.status}>
              {assets.length === 0
                ? 'No files in the Asset Library yet.'
                : 'No matching files.'}
            </li>
          ) : (
            visible.map((asset) => {
              const selected = selectedIds.includes(asset.id)
              const preview = asset.thumbnailUrl || asset.url
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    className={`${styles.option} ${selected ? styles.optionOn : ''}`}
                    onClick={() => handlePick(asset)}
                    disabled={disabled}
                  >
                    {preview ? (
                      <img src={preview} alt="" className={styles.thumb} />
                    ) : (
                      <span className={styles.thumbFallback}>File</span>
                    )}
                    <span className={styles.copy}>
                      <span className={styles.name}>{asset.name || asset.id}</span>
                      <span className={styles.meta}>{asset.kind}</span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>

        {multiple ? (
          <button type="button" className={styles.done} onClick={() => onClose?.()}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default AssetPicker
