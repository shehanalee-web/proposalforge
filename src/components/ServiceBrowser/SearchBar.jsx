import { useEffect, useRef } from 'react'
import Icon from '../Icon/Icon.jsx'
import styles from './SearchBar.module.css'

/**
 * Search input with icon, clear button, keyboard shortcut and ESC support.
 *
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   placeholder?: string,
 *   autoFocus?: boolean,
 * }} props
 */
function SearchBar({ value, onChange, placeholder = 'Search services...', autoFocus = false }) {
  const ref = useRef(null)

  /* Ctrl / Cmd + K focuses the search input from anywhere on the page. */
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleInputKeyDown(event) {
    if (event.key === 'Escape') {
      if (value) {
        event.preventDefault()
        onChange('')
      }
    }
  }

  return (
    <div className={styles.root}>
      <span className={styles.searchIcon} aria-hidden="true">
        <Icon name="search" size={16} />
      </span>

      <input
        ref={ref}
        type="search"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        aria-label="Search services"
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />

      {value ? (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            onChange('')
            ref.current?.focus()
          }}
          aria-label="Clear search"
          tabIndex={-1}
        >
          <Icon name="close" size={14} />
        </button>
      ) : (
        <span className={styles.shortcut} aria-hidden="true">
          ⌘K
        </span>
      )}
    </div>
  )
}

export default SearchBar
