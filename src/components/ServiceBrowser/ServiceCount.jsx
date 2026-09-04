import styles from './ServiceCount.module.css'

/**
 * Small muted count badge — "4 Services" / "1 Service".
 *
 * @param {{ count: number }} props
 */
function ServiceCount({ count }) {
  const label = `${count} ${count === 1 ? 'Service' : 'Services'}`

  return (
    <span className={styles.root} aria-live="polite" aria-atomic="true">
      {label}
    </span>
  )
}

export default ServiceCount
