import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import { useNotifications } from '../../hooks/useNotifications.js'
import { formatRelativeTime } from '../../utils/format.js'
import { proposalPath } from '../../workspace/paths.js'
import styles from './NotificationCenter.module.css'

function NotificationCenter() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined

    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  async function handleItem(item) {
    await markRead(item.id)
    setOpen(false)
    if (item.proposalId) navigate(proposalPath(item.proposalId))
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.bell}
        aria-label={
          unreadCount
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 ? (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <header className={styles.head}>
            <p className={styles.title}>Notifications</p>
            {unreadCount > 0 ? (
              <button type="button" className={styles.mark} onClick={markAllRead}>
                Mark all read
              </button>
            ) : null}
          </header>
          {items.length === 0 ? (
            <p className={styles.empty}>No notifications yet.</p>
          ) : (
            <ul className={styles.list}>
              {items.slice(0, 20).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${item.readAt ? '' : styles.unread}`}
                    onClick={() => handleItem(item)}
                  >
                    <span className={styles.itemTitle}>{item.title}</span>
                    {item.body ? <span className={styles.itemBody}>{item.body}</span> : null}
                    <span className={styles.itemMeta}>{formatRelativeTime(item.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default NotificationCenter
