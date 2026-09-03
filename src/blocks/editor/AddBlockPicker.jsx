import { useState, useRef, useEffect } from 'react'
import Icon from '../../components/Icon/Icon.jsx'
import { BUILTIN_BLOCK_TYPES } from '../ids.js'
import { getBlockType } from '../registry.js'
import { getBlockIcon } from './blockIcons.js'
import styles from './AddBlockPicker.module.css'

/**
 * Floating menu that lets the user pick a block type to insert.
 *
 * @param {{
 *   onAdd: (type: string) => void,
 *   disabled?: boolean,
 * }} props
 */
function AddBlockPicker({ onAdd, disabled = false, compact = false }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const types = BUILTIN_BLOCK_TYPES.map((type) => ({
    type,
    ...getBlockType(type),
    icon: getBlockIcon(type),
  }))

  const filtered = filter
    ? types.filter((t) => t.label.toLowerCase().includes(filter.toLowerCase()))
    : types

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
          <div className={styles.searchRow}>
            <Icon name="search" size={14} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter blocks…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <ul className={styles.list}>
            {filtered.length === 0 ? (
              <li className={styles.noMatch}>No matching block types</li>
            ) : (
              filtered.map((t) => (
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
