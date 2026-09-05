import { PORTAL_STATUS } from './types.js'

/**
 * Access is explicit and revocable. A portal id is an identifier, not
 * enterprise authentication. PORTAL_CAPABILITIES.unguessableUrlIsAuth is false.
 */

export function isPortalExpired(record, now = Date.now()) {
  if (!record?.expiresAt) return false
  const expires = Date.parse(record.expiresAt)
  if (Number.isNaN(expires)) return false
  const clock = typeof now === 'number' ? now : Date.parse(now)
  if (Number.isNaN(clock)) return false
  return expires <= clock
}

export function effectivePortalStatus(record, now = Date.now()) {
  if (!record) return null
  if (record.status === PORTAL_STATUS.REVOKED) return PORTAL_STATUS.REVOKED
  if (record.status === PORTAL_STATUS.DRAFT) return PORTAL_STATUS.DRAFT
  if (record.status === PORTAL_STATUS.EXPIRED || isPortalExpired(record, now)) {
    return PORTAL_STATUS.EXPIRED
  }
  return record.status
}

export function isClientAccessible(record, now = Date.now()) {
  return effectivePortalStatus(record, now) === PORTAL_STATUS.PUBLISHED
}

export function presentPublicAccess(record, now = Date.now()) {
  if (!record) return null
  const status = effectivePortalStatus(record, now)
  return {
    portalId: record.id,
    status,
    publishedAt: record.publishedAt,
    expiresAt: record.expiresAt,
    accessModel: 'revocable-identifier',
    enterpriseAuth: false,
  }
}
