import { onNotificationEvent } from '../collaboration/notify.js'
import {
  isNotificationUnread,
  makeNotification,
  NOTIFICATION_TITLES,
} from '../models/notification.js'
import * as store from './notificationStore.js'

const MAX_NOTIFICATIONS = 80

/** @type {Set<(items: import('../models/notification.js').StudioNotification[]) => void>} */
const listeners = new Set()
let hooked = false

function emit() {
  const items = store.all()
  listeners.forEach((handler) => {
    try {
      handler(items)
    } catch {
      /* subscribers must not break writes */
    }
  })
  return items
}

async function persistFromDispatch(event) {
  try {
    const activity = event?.payload?.activity ?? {}
    const proposalId =
      event?.payload?.proposalId ?? activity.proposalId ?? activity.proposal_id ?? null
    const body =
      event?.payload?.detail ??
      activity.detail ??
      activity.metadata?.detail ??
      ''

    await store.ready()
    const existing = store.all()
    const saved = makeNotification({
      id: event?.id,
      type: event?.type,
      proposalId,
      title: NOTIFICATION_TITLES[event?.type] || event?.payload?.title || 'Update',
      body,
      createdAt: event?.createdAt,
    })
    const next = [saved, ...existing.filter((item) => item.id !== saved.id)].slice(
      0,
      MAX_NOTIFICATIONS,
    )
    await store.replaceAll(next)
    emit()
    return saved
  } catch {
    return null
  }
}

export function bindNotificationPersistence() {
  if (hooked) return
  hooked = true
  onNotificationEvent((event) => {
    void persistFromDispatch(event)
  })
}

export function ingestDispatchedNotification(event) {
  bindNotificationPersistence()
  return persistFromDispatch(event)
}

export function onNotificationsChange(handler) {
  if (typeof handler !== 'function') return () => {}
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export async function fetchNotifications() {
  bindNotificationPersistence()
  await store.ready()
  return store.all()
}

export function countUnread(items = store.all()) {
  return items.filter(isNotificationUnread).length
}

export async function markNotificationRead(id) {
  await store.ready()
  const now = new Date().toISOString()
  const next = store.all().map((item) =>
    item.id === id && !item.readAt ? makeNotification({ ...item, readAt: now }) : item,
  )
  await store.replaceAll(next)
  return emit()
}

export async function markAllNotificationsRead() {
  await store.ready()
  const now = new Date().toISOString()
  const next = store.all().map((item) =>
    item.readAt ? item : makeNotification({ ...item, readAt: now }),
  )
  await store.replaceAll(next)
  return emit()
}
