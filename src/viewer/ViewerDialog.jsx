import { useEffect } from 'react'
import Icon from '../components/Icon/Icon.jsx'
import styles from './ViewerDialog.module.css'

function ViewerDialog({
  title,
  description,
  open,
  onClose,
  children,
  footer,
}) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(event) {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="viewer-dialog-title">
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.head}>
          <div>
            <h2 id="viewer-dialog-title" className={styles.title}>{title}</h2>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        {children}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}

export default ViewerDialog
