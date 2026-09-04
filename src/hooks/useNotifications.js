import { useCallback, useEffect, useState } from 'react'
import {
  bindNotificationPersistence,
  countUnread,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  onNotificationsChange,
} from '../services/notificationService.js'

export function useNotifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const next = await fetchNotifications()
    setItems(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    bindNotificationPersistence()
    void refresh()
    return onNotificationsChange((next) => {
      setItems(next)
      setLoading(false)
    })
  }, [refresh])

  const markRead = useCallback(async (id) => {
    const next = await markNotificationRead(id)
    setItems(next)
  }, [])

  const markAllRead = useCallback(async () => {
    const next = await markAllNotificationsRead()
    setItems(next)
  }, [])

  return {
    items,
    loading,
    unreadCount: countUnread(items),
    markRead,
    markAllRead,
    refetch: refresh,
  }
}
