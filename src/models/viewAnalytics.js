import { createRecordId } from './ids.js'

/**
 * Mock client-view analytics. No tracking pixel is fired.
 * A later provider can replace `recordViewSession` with real session ingest.
 */

export const VIEW_DEVICE = Object.freeze({
  DESKTOP: 'Desktop',
  MOBILE: 'Mobile',
  TABLET: 'Tablet',
})

const MOCK_COUNTRY = 'United Arab Emirates'

/**
 * @typedef {object} ViewSession
 * @property {string} id
 * @property {string} at
 * @property {string} device
 * @property {string} country
 * @property {string} browser
 * @property {number} timeSpentMs
 * @property {number} scrollPercent
 */

/**
 * @typedef {object} ViewAnalytics
 * @property {number} sentCount
 * @property {number} openCount
 * @property {number} viewCount
 * @property {string | null} lastViewedAt
 * @property {string} device
 * @property {string} country
 * @property {string} browser
 * @property {number} timeSpentMs
 * @property {number} scrollPercent
 * @property {ViewSession[]} sessions
 */

function clampPercent(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return 0
  return Math.max(0, Math.min(100, Math.round(next)))
}

function detectBrowser(userAgent) {
  const ua = String(userAgent ?? '')
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari'
  return 'Chrome'
}

function detectDevice(userAgent) {
  const ua = String(userAgent ?? '')
  if (/iPad|Tablet/i.test(ua)) return VIEW_DEVICE.TABLET
  if (/Mobi|Android/i.test(ua)) return VIEW_DEVICE.MOBILE
  return VIEW_DEVICE.DESKTOP
}

/**
 * Mock environment for a client session. Uses the browser UA when present;
 * never performs geo-IP or pixel collection.
 *
 * @param {{ userAgent?: string, country?: string }} [input]
 */
export function mockViewContext(input = {}) {
  const userAgent =
    input.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '')

  return {
    device: detectDevice(userAgent),
    browser: detectBrowser(userAgent),
    country: String(input.country ?? MOCK_COUNTRY).trim() || MOCK_COUNTRY,
  }
}

/**
 * @param {Partial<ViewSession>} [input]
 * @returns {ViewSession}
 */
export function makeViewSession(input = {}) {
  const context = mockViewContext(input)
  return {
    id: input.id ?? createRecordId('vws'),
    at: input.at ?? new Date().toISOString(),
    device: input.device || context.device,
    country: input.country || context.country,
    browser: input.browser || context.browser,
    timeSpentMs: Math.max(0, Number(input.timeSpentMs ?? 0) || 0),
    scrollPercent: clampPercent(input.scrollPercent),
  }
}

/**
 * @param {Partial<ViewAnalytics>} [input]
 * @returns {ViewAnalytics}
 */
export function makeViewAnalytics(input = {}) {
  const sessions = Array.isArray(input.sessions)
    ? input.sessions.map((item) => makeViewSession(item))
    : []
  const last = sessions[sessions.length - 1]

  return {
    sentCount: Math.max(0, Number(input.sentCount ?? 0) || 0),
    openCount: Math.max(0, Number(input.openCount ?? 0) || 0),
    viewCount: Math.max(0, Number(input.viewCount ?? sessions.length) || 0),
    lastViewedAt: input.lastViewedAt ?? last?.at ?? null,
    device: input.device || last?.device || '',
    country: input.country || last?.country || '',
    browser: input.browser || last?.browser || '',
    timeSpentMs: Math.max(0, Number(input.timeSpentMs ?? 0) || 0),
    scrollPercent: clampPercent(input.scrollPercent ?? last?.scrollPercent),
    sessions,
  }
}

/**
 * Append a mock view session and roll up totals.
 *
 * @param {Partial<ViewAnalytics> | null | undefined} current
 * @param {Partial<ViewSession>} [session]
 * @returns {ViewAnalytics}
 */
export function recordViewSession(current, session = {}) {
  const existing = makeViewAnalytics(current)
  const previousScroll = existing.scrollPercent
  const mockSpend = 18_000 + Math.round(Math.random() * 42_000)
  const mockScroll = Math.max(
    previousScroll,
    Math.min(100, previousScroll + 18 + Math.round(Math.random() * 22) || 42),
  )
  const nextSession = makeViewSession({
    ...mockViewContext(session),
    ...session,
    timeSpentMs: session.timeSpentMs ?? mockSpend,
    scrollPercent: session.scrollPercent ?? mockScroll,
  })
  const sessions = [...existing.sessions, nextSession].slice(-40)

  return makeViewAnalytics({
    ...existing,
    sentCount: existing.sentCount,
    openCount: existing.openCount + 1,
    viewCount: existing.viewCount + 1,
    lastViewedAt: nextSession.at,
    device: nextSession.device,
    country: nextSession.country,
    browser: nextSession.browser,
    timeSpentMs: existing.timeSpentMs + nextSession.timeSpentMs,
    scrollPercent: nextSession.scrollPercent,
    sessions,
  })
}

/**
 * @param {Partial<ViewAnalytics> | null | undefined} current
 * @returns {ViewAnalytics}
 */
export function recordAnalyticsSent(current) {
  const existing = makeViewAnalytics(current)
  return makeViewAnalytics({
    ...existing,
    sentCount: existing.sentCount + 1,
  })
}
