import styles from './ReadingProgress.module.css'

function ReadingProgress({ value = 0 }) {
  return (
    <div className={styles.track} aria-hidden="true">
      <div className={styles.bar} style={{ width: `${value}%` }} />
    </div>
  )
}

export default ReadingProgress
