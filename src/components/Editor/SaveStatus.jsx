import Icon from '../Icon/Icon.jsx'
import styles from './SaveStatus.module.css'

function SaveStatus({ status, label }) {
  return (
    <p className={`${styles.status} ${styles[status] ?? ''}`} aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span>
      {status === 'saving' ? <Icon name="spark" size={12} /> : null}
    </p>
  )
}

export default SaveStatus
