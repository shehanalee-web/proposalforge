import styles from './ServiceSkeleton.module.css'

/**
 * Skeleton placeholder grid for the service browser loading state.
 * Not rendered yet — ready for when a real API adds network latency.
 *
 * @param {{ count?: number }} props
 */
function ServiceSkeleton({ count = 6 }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.card} />
      ))}
    </div>
  )
}

export default ServiceSkeleton
