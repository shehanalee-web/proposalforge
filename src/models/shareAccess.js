import { createRecordId, EMAIL_PATTERN } from './ids.js'

export function createShareToken() {
  return createRecordId('share')
}

/**
 * Client-link access control. The share token stays on the proposal;
 * this record gates who can open it.
 */

export const SHARE_ACCESS_STATE = Object.freeze({
  OPEN: 'open',
  GATED: 'gated',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
})

/**
 * @typedef {object} ShareAccess
 * @property {string | null} revokedAt
 * @property {string} passwordHash
 * @property {boolean} requireEmail
 * @property {string | null} accessExpiresAt
 */

/**
 * @param {Partial<ShareAccess>} [input]
 * @returns {ShareAccess}
 */
export function makeShareAccess(input = {}) {
  return {
    revokedAt: input.revokedAt ?? null,
    passwordHash: String(input.passwordHash ?? '').trim(),
    requireEmail: Boolean(input.requireEmail),
    accessExpiresAt: input.accessExpiresAt ?? null,
  }
}

export function isShareRevoked(access) {
  return Boolean(access?.revokedAt)
}

/**
 * @param {ShareAccess | null | undefined} access
 * @param {number} [now]
 */
export function isShareAccessExpired(access, now = Date.now()) {
  const raw = String(access?.accessExpiresAt ?? '').trim()
  if (!raw) return false
  const stamp = raw.includes('T') ? raw : `${raw}T23:59:59.999`
  const end = Date.parse(stamp)
  return Number.isFinite(end) && now > end
}

export function getShareAccessState(access) {
  if (isShareRevoked(access)) return SHARE_ACCESS_STATE.REVOKED
  if (isShareAccessExpired(access)) return SHARE_ACCESS_STATE.EXPIRED
  if (access?.passwordHash || access?.requireEmail) return SHARE_ACCESS_STATE.GATED
  return SHARE_ACCESS_STATE.OPEN
}

export async function hashShareSecret(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv:${(hash >>> 0).toString(16)}`
}

export async function sharePasswordMatches(access, password) {
  const expected = String(access?.passwordHash ?? '').trim()
  if (!expected) return true
  const submitted = String(password ?? '').trim()
  if (!submitted) return false
  const hashed = await hashShareSecret(submitted)
  return hashed === expected
}

export function shareEmailMatches(proposal, email) {
  const expected = String(proposal?.clientEmail ?? '').trim().toLowerCase()
  const submitted = String(email ?? '').trim().toLowerCase()
  if (!expected) return Boolean(submitted && EMAIL_PATTERN.test(submitted))
  return submitted === expected
}

export function maskEmail(email) {
  const value = String(email ?? '').trim()
  const at = value.indexOf('@')
  if (at < 1) return ''
  const name = value.slice(0, at)
  const domain = value.slice(at + 1)
  const hint = name.slice(0, 1)
  return `${hint}${'•'.repeat(Math.max(2, Math.min(name.length - 1, 6)))}@${domain}`
}

export function presentShareAccess(access) {
  const next = makeShareAccess(access)
  return {
    revokedAt: next.revokedAt,
    requireEmail: next.requireEmail,
    accessExpiresAt: next.accessExpiresAt,
    passwordSet: Boolean(next.passwordHash),
  }
}
