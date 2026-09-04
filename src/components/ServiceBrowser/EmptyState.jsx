import Icon from '../Icon/Icon.jsx'
import styles from './EmptyState.module.css'

/**
 * Catalogue empty state when search, industry and category yield no cards.
 *
 * @param {{
 *   onClear: () => void,
 *   onBrowseAll: () => void,
 *   search?: string,
 *   industryLabel?: string,
 *   categoryLabel?: string,
 * }} props
 */
function EmptyState({
  onClear,
  onBrowseAll,
  search = '',
  industryLabel = '',
  categoryLabel = '',
}) {
  const query = search.trim()
  const industry = industryLabel.trim()
  const category = categoryLabel.trim()
  const scope = [category, industry].filter(Boolean).join(' in ')

  const headline = 'No matching services'

  const body = query && scope
    ? `Nothing in ${scope} matches “${query}”. Try another keyword, or browse every service.`
    : query
      ? `Nothing in the catalogue matches “${query}”. Try another keyword.`
      : scope
        ? `No proposal templates match ${scope}. Try another filter, or browse every service.`
        : 'Try another keyword or select a different industry.'

  return (
    <div className={styles.root} role="status">
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size={32} />
      </span>
      <p className={styles.headline}>{headline}</p>
      <p className={styles.body}>{body}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.clear} onClick={onClear}>
          Clear filters
        </button>
        <button type="button" className={styles.browse} onClick={onBrowseAll}>
          Browse all services
        </button>
      </div>
    </div>
  )
}

export default EmptyState
