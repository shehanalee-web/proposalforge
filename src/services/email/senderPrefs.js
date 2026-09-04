const SENDER_KEY = 'proposalforge.emailSender'

/**
 * Last used from-name / from-email for the send dialog.
 */

export function readRememberedSender() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SENDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const name = String(parsed?.name ?? '').trim()
    const email = String(parsed?.email ?? '').trim()
    if (!name && !email) return null
    return { name, email }
  } catch {
    return null
  }
}

export function rememberSender(input) {
  if (typeof window === 'undefined') return
  const name = String(input?.name ?? '').trim()
  const email = String(input?.email ?? '').trim()
  window.localStorage.setItem(SENDER_KEY, JSON.stringify({ name, email }))
}
