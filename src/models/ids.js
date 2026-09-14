/**
 * Stable record ids for workspace library models.
 *
 * Proposal and template models keep their own helpers so existing records
 * are untouched. New modules share this helper.
 */

export function createRecordId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Normalize a list of record ids. Empty values are dropped; first-seen order
 * is kept. Shared by workspace library fields that store id arrays.
 *
 * @param {unknown} [ids]
 * @returns {string[]}
 */
export function normalizeIdList(ids) {
  const seen = new Set()
  const next = []

  for (const value of ids ?? []) {
    const id = String(value ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }

  return next
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
