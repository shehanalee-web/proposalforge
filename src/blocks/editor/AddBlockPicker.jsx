import { useState, useRef, useEffect } from 'react'
import Icon from '../../components/Icon/Icon.jsx'
import { BUILTIN_BLOCK_TYPES } from '../ids.js'
import { getBlockType } from '../registry.js'
import { getBlockIcon } from './blockIcons.js'
import { useLibraryBlocks } from '../../hooks/useLibraryBlocks.js'
import { LIBRARY_BLOCK_STATUS } from '../../models/contentBlock.js'
import styles from './AddBlockPicker.module.css'

function AddBlockPicker({
  onAdd,
  onInsertLibrary,
  disabled = false,
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState('library')
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const { blocks: library } = useLibraryBlocks()

  const types = BUILTIN_BLOCK_TYPES.map((type) => ({
    type,
    ...getBlockType(type),
    icon: getBlockIcon(type),
  }))

  const q = filter.trim().toLowerCase()
  const filteredTypes = q
    ? types.filter((t) => t.label.toLowerCase().includes(q))
    : types
  const libraryItems = library
    .filter((block) => block.status === LIBRARY_BLOCK_STATUS.PUBLISHED)
    .filter((block) => {
      if (!q) return true
      return `${block.name} ${(block.tags ?? []).join(' ')}`.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) {
        return a.favorite ? -1 : 1
      }
      return (b.useCount ?? 0) - (a.useCount ?? 0)
    })

  useEffect(() => {
    if (!open) return undefined

    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function openPicker() {
    setOpen(true)
    setFilter('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function pick(type) {
    onAdd(type)
    setOpen(false)
  }

  function pickLibrary(block) {
    if (onInsertLibrary) onInsertLibrary(block)
    else onAdd(block.type)
    setOpen(false)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${compact ? styles.triggerCompact : ''}`}
        onClick={open ? () => setOpen(false) : openPicker}
        disabled={disabled}
        aria-label="Add block"
      >
        <Icon name="plus" size={compact ? 14 : 16} />
        {!compact ? <span>Add block</span> : null}
      </button>

      {open ? (
        <div className={styles.dropdown}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={tab === 'library' ? styles.tabOn : styles.tab}
              onClick={() => setTab('library')}
            >
              Library
            </button>
            <button
              type="button"
              className={tab === 'types' ? styles.tabOn : styles.tab}
              onClick={() => setTab('types')}
            >
              Types
            </button>
          </div>
          <div className={styles.searchRow}>
            <Icon name="search" size={14} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={tab === 'library' ? 'Filter library…' : 'Filter types…'}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <ul className={styles.list}>
            {tab === 'library' ? (
              libraryItems.length === 0 ? (
                <li className={styles.noMatch}>No published library blocks</li>
              ) : (
                libraryItems.map((block) => (
                  <li key={block.id}>
                    <button
                      type="button"
                      className={styles.option}
                      onClick={() => pickLibrary(block)}
                    >
                      <Icon name={getBlockIcon(block.type)} size={16} />
                      <span>
                        {block.name}
                        {block.favorite ? ' ★' : ''}
                      </span>
                    </button>
                  </li>
                ))
              )
            ) : filteredTypes.length === 0 ? (
              <li className={styles.noMatch}>No matching block types</li>
            ) : (
              filteredTypes.map((t) => (
                <li key={t.type}>
                  <button
                    type="button"
                    className={styles.option}
                    onClick={() => pick(t.type)}
                  >
                    <Icon name={t.icon} size={16} />
                    <span>{t.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default AddBlockPicker
