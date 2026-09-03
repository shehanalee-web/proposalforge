/**
 * Turn a stored public path into an absolute URL for PDF links and fetches.
 * Relative `/uploads/...` paths work in the app; PDF viewers need origin.
 * Browser object URLs are never promoted into documents.
 */
export function toAbsoluteUrl(url) {
  if (!url || typeof url !== 'string') return ''
  if (url.startsWith('blob:')) return ''
  if (/^(https?:|data:|mailto:)/i.test(url)) return url
  if (typeof window === 'undefined' || !window.location?.origin) return url

  try {
    return new URL(url, window.location.origin).href
  } catch {
    return url
  }
}

export function isEphemeralUrl(url) {
  return typeof url === 'string' && (url.startsWith('blob:') || url.startsWith('data:'))
}

export function persistableUrl(url) {
  if (!url || typeof url !== 'string') return ''
  if (isEphemeralUrl(url)) return ''
  return url
}
