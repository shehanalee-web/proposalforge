import styles from './ViewerToast.module.css'

function ViewerToast({ message }) {
  if (!message) return null
  return (
    <p className={styles.toast} role="status">
      {message}
    </p>
  )
}

export default ViewerToast
