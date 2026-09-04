import styles from './BlockEmptyState.module.css'

function BlockEmptyState({ title, hint, action }) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {action}
    </div>
  )
}

export default BlockEmptyState
