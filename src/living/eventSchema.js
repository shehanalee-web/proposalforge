import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { LIVING_EVENTS } from './types.js'
import { ValidationError } from '../services/errors.js'

/**
 * Living engagement event records (H14 Phase 4).
 *
 * Observation layer only. Does not store proposal copies, selection state,
 * or client-supplied monetary values.
 */

const MAX_META_KEYS = 12
const MAX_META_STRING = 200
const MAX_ID = 128

const BLOCKED_META_KEYS = Object.freeze([
  'amount',
  'total',
  'selectedTotal',
  'packageAmount',
  'price',
  'unitPrice',
  'grandTotal',
  'subtotal',
  'blocks',
  'items',
  'offers',
  'proposal',
  'accessRef',
  'accessKey',
  'token',
  'secret',
  'apiKey',
  'password',
])

function asString(value) {
  return value == null ? '' : String(value)
}

function asIso(value, fallback = null) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

function asOptionalId(value) {
  const id = asString(value).trim()
  if (!id) return null
  if (id.length > MAX_ID) {
    throw new ValidationError('Identifier is too long.', [
      { field: 'id', message: 'Identifier is too long.' },
    ])
  }
  return id
}

function sanitizeMetaValue(value) {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return value
  }
  if (typeof value === 'string') {
    return value.trim().slice(0, MAX_META_STRING)
  }
  return undefined
}

/**
 * Bound, safe metadata. Drops nested objects, arrays, secrets, and money fields.
 *
 * @param {unknown} input
 */
export function sanitizeLivingEventMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  let count = 0
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (count >= MAX_META_KEYS) break
    const key = String(rawKey).trim()
    if (!key || key.length > 64) continue
    if (BLOCKED_META_KEYS.includes(key)) continue
    if (/password|secret|token|api[_-]?key/i.test(key)) continue
    const value = sanitizeMetaValue(rawValue)
    if (value === undefined) continue
    out[key] = value
    count += 1
  }
  return out
}

/**
 * @param {object} [input]
 */
export function makeLivingEngagementEvent(input = {}) {
  const type = asString(input.type).trim()
  if (!LIVING_EVENTS.includes(type)) {
    throw new ValidationError('Unknown living event type.', [
      { field: 'type', message: `Unsupported event type: ${type || '(empty)'}` },
    ])
  }

  const at = asIso(input.at, nowIso())
  return {
    id: asString(input.id).trim() || createRecordId('lev'),
    companyId: asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    proposalId: asString(input.proposalId).trim(),
    shareToken: asString(input.shareToken).trim(),
    type,
    blockId: asOptionalId(input.blockId),
    offerId: asOptionalId(input.offerId),
    sessionId: asOptionalId(input.sessionId),
    at,
    metadata: sanitizeLivingEventMetadata(input.metadata),
  }
}

export function cloneLivingEngagementEvent(event) {
  const next = makeLivingEngagementEvent(event)
  return {
    ...next,
    metadata: { ...next.metadata },
  }
}

/**
 * Studio/client-safe projection (no extra internal fields).
 *
 * @param {object} event
 */
export function presentLivingEngagementEvent(event) {
  const next = makeLivingEngagementEvent(event)
  return {
    id: next.id,
    companyId: next.companyId,
    proposalId: next.proposalId,
    shareToken: next.shareToken,
    type: next.type,
    blockId: next.blockId,
    offerId: next.offerId,
    sessionId: next.sessionId,
    at: next.at,
    metadata: { ...next.metadata },
  }
}
