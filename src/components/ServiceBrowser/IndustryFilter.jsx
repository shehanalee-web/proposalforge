import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../Icon/Icon.jsx'
import { INDUSTRIES } from '../../models/industry.js'
import styles from './IndustryFilter.module.css'

/**
 * Searchable catalogue dropdown with colour-coded dots.
 * Keyboard navigation: Arrow Up/Down moves through options, Enter/Escape close.
 *
 * Pass `options` to reuse the same control for categories. Industry usage
 * always lists the full taxonomy.
 *
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   options?: readonly { id: string, label: string, color?: string }[],
 *   ariaLabel?: string,
 *   searchPlaceholder?: string,
 * }} props
 */
function IndustryFilter({
  value,
  onChange,
  options = INDUSTRIES,
  ariaLabel = 'Industry',
  searchPlaceholder = 'Filter industries...',
}) {
  const [open, setOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const labelId = useId()

  const selected = options.find((item) => item.id === value) ?? options[0]

  const filtered = filterText
    ? options.filter((item) =>
        item.label.toLowerCase().includes(filterText.toLowerCase()),
      )
    : options

  /* Close on outside click / Escape. */
  useEffect(() => {
    if (!open) return undefined

    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) close()
    }
    function handleKey(event) {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function openMenu() {
    setOpen(true)
    setFilterText('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function close() {
    setOpen(false)
    setFilterText('')
  }

  function select(id) {
    onChange(id)
    close()
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      openMenu()
    }
  }

  function handleListKeyDown(event) {
    const items = listRef.current?.querySelectorAll('[role="option"]')
    if (!items || items.length === 0) return

    const active = document.activeElement
    const index = [...items].indexOf(active)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[Math.min(index + 1, items.length - 1)]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index <= 0) {
        inputRef.current?.focus()
      } else {
        items[index - 1]?.focus()
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (active?.dataset?.value !== undefined) select(active.dataset.value)
    }
  }

  return (
    <div
      className={styles.root}
      ref={rootRef}
      aria-labelledby={labelId}
    >
      <button
        type="button"
        id={labelId}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={open ? close : openMenu}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={styles.triggerDot}
          style={{ background: selected?.color ?? '#71717a' }}
          aria-hidden="true"
        />
        <span className={styles.triggerLabel}>{selected.label}</span>
        <Icon name="chevronDown" size={14} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>

      {open ? (
        <div className={styles.dropdown} role="listbox" aria-label={ariaLabel}>
          <div className={styles.searchRow}>
            <Icon name="search" size={14} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  listRef.current?.querySelector('[role="option"]')?.focus()
                }
                if (event.key === 'Escape') close()
              }}
            />
          </div>

          <ul
            className={styles.list}
            ref={listRef}
            role="group"
            onKeyDown={handleListKeyDown}
          >
            {filtered.length === 0 ? (
              <li className={styles.noMatch}>No matches</li>
            ) : (
              filtered.map((item) => (
                <li key={item.id || 'all'} role="none">
                  <button
                    type="button"
                    role="option"
                    data-value={item.id}
                    aria-selected={item.id === value}
                    className={`${styles.option} ${item.id === value ? styles.optionActive : ''}`}
                    onClick={() => select(item.id)}
                    tabIndex={-1}
                  >
                    <span
                      className={styles.dot}
                      style={{ background: item.color ?? '#71717a' }}
                      aria-hidden="true"
                    />
                    {item.label}
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

export default IndustryFilter
