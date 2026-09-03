import Icon from '../Icon/Icon.jsx'
import styles from './EmptyState.module.css'

/**
 * Empty state shown when no services match the current search / industry.
 *
 * @param {{ onClear: () => void }} props
 */
function EmptyState({ onClear }) {
  return (
    <div className={styles.root} role="status">
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size={32} />
      </span>
      <p className={styles.headline}>No matching services</p>
      <p className={styles.body}>
        Try another keyword or select a different industry.
      </p>
      <button type="button" className={styles.clear} onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}

export default EmptyState
