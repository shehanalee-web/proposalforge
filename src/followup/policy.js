/**
 * Horizon 13 follow-up timing policy.
 *
 * Explicit dates (proposal.validUntil, workflow task.dueAt) always win.
 * Inferred offsets live here so UI and plugins never embed magic numbers.
 *
 * Grace windows reuse the existing commercial queue policy so "needs follow-up"
 * and follow-up signals agree on the same clocks.
 */

import {
  EXPIRING_WITHIN_MS,
  FOLLOW_UP_AFTER_MS,
  NEVER_OPENED_AFTER_MS,
} from '../models/commercialQueues.js'

/** Studio SLA after a proposal is accepted before the handoff is due. */
export const ACCEPTED_HANDOFF_AFTER_MS = 24 * 60 * 60 * 1000

/** Default due offset for a manual follow-up with no explicit date. */
export const MANUAL_DEFAULT_DUE_MS = 2 * 24 * 60 * 60 * 1000

export const FOLLOWUP_POLICY = Object.freeze({
  neverOpenedAfterMs: NEVER_OPENED_AFTER_MS,
  awaitingResponseAfterMs: FOLLOW_UP_AFTER_MS,
  expiringWithinMs: EXPIRING_WITHIN_MS,
  acceptedHandoffAfterMs: ACCEPTED_HANDOFF_AFTER_MS,
  manualDefaultDueMs: MANUAL_DEFAULT_DUE_MS,
})

export function clockOf(now = Date.now()) {
  if (now instanceof Date) return now.getTime()
  const value = Number(now)
  return Number.isFinite(value) ? value : Date.now()
}

export function toIso(value, fallback = null) {
  if (!value && value !== 0) return fallback
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

export function parseTime(value) {
  if (!value && value !== 0) return Number.NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  const text = String(value).trim()
  if (!text) return Number.NaN
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return Date.parse(`${text}T23:59:59.999`)
  }
  return Date.parse(text)
}

export function addMs(base, ms) {
  const start = parseTime(base)
  if (!Number.isFinite(start) || !Number.isFinite(ms)) return null
  return new Date(start + ms).toISOString()
}

export function isSameCalendarDay(left, right) {
  const a = new Date(parseTime(left))
  const b = new Date(parseTime(right))
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isDueToday(dueAt, now = Date.now()) {
  if (!dueAt) return false
  const due = parseTime(dueAt)
  const clock = clockOf(now)
  if (!Number.isFinite(due)) return false
  return isSameCalendarDay(due, clock) && due >= clock
}

export function isFollowupOverdue(dueAt, now = Date.now()) {
  const due = parseTime(dueAt)
  if (!Number.isFinite(due)) return false
  return due < clockOf(now)
}

export function isValidityExpired(validUntil, now = Date.now()) {
  const end = parseTime(validUntil)
  if (!Number.isFinite(end)) return false
  return end < clockOf(now)
}

export function isValidityExpiring(validUntil, now = Date.now()) {
  const end = parseTime(validUntil)
  const clock = clockOf(now)
  if (!Number.isFinite(end)) return false
  return end > clock && end - clock <= FOLLOWUP_POLICY.expiringWithinMs
}
