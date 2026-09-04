const EM_DASH = '—'

/**
 * Format a monetary amount for display.
 *
 * Fractional units are dropped because proposal values are quoted in whole
 * currency units, and long cent strings add noise to a dense list.
 *
 * @param {number} amount
 * @param {string} [currency] ISO 4217 code.
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  if (!Number.isFinite(amount)) return EM_DASH

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format an ISO timestamp as a short, unambiguous date.
 *
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return EM_DASH

  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) return EM_DASH

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Format an ISO timestamp as a 12-hour clock time.
 *
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatTime(iso) {
  if (!iso) return EM_DASH

  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) return EM_DASH

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Format an ISO timestamp as a short date and time.
 *
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return EM_DASH

  const date = formatDate(iso)
  const time = formatTime(iso)

  if (date === EM_DASH) return EM_DASH

  return `${date} · ${time}`
}

/**
 * Format a timestamp as `4 Sept 2026 • 11:42 AM`.
 *
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatActivityStamp(iso) {
  if (!iso) return EM_DASH

  const date = formatDate(iso)
  const time = formatTime(iso)

  if (date === EM_DASH) return EM_DASH

  return `${date} • ${time}`
}

/**
 * Compact relative time for activity rows.
 *
 * @param {string | null | undefined} iso
 * @param {number | Date} [now]
 * @returns {string}
 */
export function formatRelativeTime(iso, now = Date.now()) {
  if (!iso) return EM_DASH

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return EM_DASH

  const current = typeof now === 'number' ? now : now.getTime()
  const diff = current - date.getTime()

  if (diff < 45_000) return 'Just now'
  if (diff < 90_000) return '1 minute ago'
  if (diff < 50 * 60_000) return `${Math.round(diff / 60_000)} minutes ago`
  if (diff < 90 * 60_000) return '1 hour ago'
  if (diff < 22 * 60 * 60_000) return `${Math.round(diff / 3_600_000)} hours ago`

  const startOfToday = new Date(current)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (date >= startOfYesterday && date < startOfToday) return 'Yesterday'
  if (date >= startOfToday && diff < 36 * 60 * 60_000) return 'Today'

  return formatActivityStamp(iso)
}

/**
 * Human duration for mock analytics time spent.
 *
 * @param {number | null | undefined} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return EM_DASH

  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'Under a minute'
  if (minutes === 1) return '1 minute'
  if (minutes < 60) return `${minutes} minutes`

  const hours = Math.round(minutes / 60)
  return hours === 1 ? '1 hour' : `${hours} hours`
}
