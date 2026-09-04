import { useEffect, useState } from 'react'
import {
  onActivityEvent,
  shouldToastActivity,
  toastMessageForActivity,
} from '../../services/activityService.js'
import styles from './ActivityToasts.module.css'

function ActivityToasts() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return onActivityEvent((event) => {
      if (!shouldToastActivity(event)) return
      const toast = {
        id: event.id,
        message: toastMessageForActivity(event),
      }
      setToasts((current) => [...current.slice(-3), toast])
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id))
      }, 2400)
    })
  }, [])

  if (!toasts.length) return null

  return (
    <div className={styles.host} aria-live="polite">
      {toasts.map((toast) => (
        <p
          key={toast.id}
          className={`${styles.toast} ${/fail|bounce/i.test(toast.message) ? styles.toastDanger : ''}`}
          role="status"
        >
          {toast.message}
        </p>
      ))}
    </div>
  )
}

export default ActivityToasts
