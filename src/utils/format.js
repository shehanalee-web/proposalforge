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
