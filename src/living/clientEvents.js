import { LIVING_CAPABILITIES, LIVING_EVENTS } from './types.js'

/**
 * Fire-and-forget living engagement POSTs.
 *
 * Never throws to callers. Never blocks rendering. Dedupes noisy events
 * per share session in this browser tab.
 */

const seenKeys = new Set()

function dedupeKey(shareToken, type, blockId, offerId) {
  return [shareToken, type, blockId || '', offerId || ''].join('\0')
}

export function resetLivingClientEventDedupe() {
  seenKeys.clear()
}

/**
 * @param {string} shareToken
 * @param {{
 *   type: string,
 *   blockId?: string | null,
 *   offerId?: string | null,
 *   sessionId?: string | null,
 *   metadata?: object,
 *   dedupe?: boolean,
 * }} input
 * @returns {Promise<object | null>}
 */
export async function postLivingEngagementEvent(shareToken, input = {}) {
  if (!LIVING_CAPABILITIES.commercialEvents) return null
  const token = String(shareToken ?? '').trim()
  const type = String(input.type ?? '').trim()
  if (!token || !LIVING_EVENTS.includes(type)) return null

  const blockId = input.blockId ?? null
  const offerId = input.offerId ?? null
  const dedupe = input.dedupe !== false
  const key = dedupeKey(token, type, blockId, offerId)
  if (dedupe && seenKeys.has(key)) return null
  if (dedupe) seenKeys.add(key)

  try {
    const response = await fetch(`/api/living/${encodeURIComponent(token)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        blockId,
        offerId,
        sessionId: input.sessionId ?? null,
        metadata: input.metadata ?? {},
      }),
    })
    if (!response.ok) {
      // Allow a later retry for hard failures by clearing dedupe when useful.
      if (dedupe && response.status >= 500) seenKeys.delete(key)
      return null
    }
    return response.json().catch(() => null)
  } catch {
    if (dedupe) seenKeys.delete(key)
    return null
  }
}
