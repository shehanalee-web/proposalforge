import { createRecordId } from '../models/ids.js'
import { ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import {
  INTERACTION_EVENT,
  INTERACTION_EVENTS,
  INTERACTION_SOURCE,
  INTERACTION_SOURCES,
  INTERACTION_STATUS,
  INTERACTION_STATUSES,
  INTERACTION_TYPE,
  INTERACTION_TYPES,
} from './types.js'

const SECRET_PATTERN =
  /(sk-[a-zA-Z0-9]{16,}|api[_-]?key\s*[:=]|secret[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9\-._~+/]+=*|-----BEGIN (?:RSA )?PRIVATE KEY-----)/i

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const MAX_MESSAGE = 8000
const MAX_LABEL = 200

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

export function isWellFormedId(value) {
  return ID_PATTERN.test(asString(value).trim())
}

export function containsSecret(value) {
  return SECRET_PATTERN.test(asString(value))
}

export function assertNoSecret(value, field) {
  if (!containsSecret(value)) return
  throw new ValidationError('This field cannot contain secret-like values.', [
    { field, message: 'Secret-like values are not allowed.' },
  ])
}

export function requireWellFormedId(value, field) {
  const id = asString(value).trim()
  if (!id || !isWellFormedId(id)) {
    throw new ValidationError('A valid identifier is required.', [
      { field, message: `${field} is not a valid identifier.` },
    ])
  }
  return id
}

export function normalizeMessage(value, { required = true, field = 'message' } = {}) {
  const message = asString(value).trim()
  assertNoSecret(message, field)
  if (required && !message) {
    throw new ValidationError('A message is required.', [
      { field, message: 'message is required.' },
    ])
  }
  if (message.length > MAX_MESSAGE) {
    throw new ValidationError('This message is too long.', [
      { field, message: 'message is too long.' },
    ])
  }
  return message
}

export function normalizeBlockLabel(value) {
  const label = asString(value).trim().slice(0, MAX_LABEL)
  assertNoSecret(label, 'blockLabel')
  return label
}

export function makeInteractionEvent(input = {}) {
  const type = INTERACTION_EVENTS.includes(input.type) ? input.type : INTERACTION_EVENT.CREATED
  const payload =
    input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
      ? { ...input.payload }
      : {}
  delete payload.accessRef
  delete payload.accessKey
  delete payload.token
  delete payload.secret
  delete payload.apiKey
  delete payload.apiKeys
  return {
    id: asString(input.id).trim() || createRecordId('ixev'),
    interactionId: asString(input.interactionId).trim(),
    portalId: asString(input.portalId).trim(),
    proposalId: asString(input.proposalId).trim(),
    companyId: asString(input.companyId).trim() || DEFAULT_COMPANY_ID,
    actorId: asString(input.actorId).trim(),
    actorName: asString(input.actorName).trim(),
    type,
    payload,
    from: input.from ?? payload.from ?? null,
    to: input.to ?? payload.to ?? null,
    createdAt: asIso(input.createdAt, nowIso()),
  }
}

export function makeInteractionRecord(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  const type = INTERACTION_TYPES.includes(input.type) ? input.type : INTERACTION_TYPE.COMMENT
  const status = INTERACTION_STATUSES.includes(input.status)
    ? input.status
    : INTERACTION_STATUS.OPEN
  const source = INTERACTION_SOURCES.includes(input.source)
    ? input.source
    : INTERACTION_SOURCE.CLIENT
  const proposalId = asString(input.proposalId).trim()
  const portalId = asString(input.portalId).trim()
  const companyId = asString(input.companyId).trim() || DEFAULT_COMPANY_ID
  const id = asString(input.id).trim() || createRecordId('ixn')
  return {
    id,
    companyId,
    portalId,
    proposalId,
    type,
    status,
    source,
    actorId: asString(input.actorId).trim(),
    actorName: asString(input.actorName).trim() || (source === INTERACTION_SOURCE.CLIENT ? 'Client' : ''),
    message: asString(input.message),
    blockId: asString(input.blockId).trim(),
    blockLabel: asString(input.blockLabel).trim(),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
    acknowledgedAt: asIso(input.acknowledgedAt, null),
    acknowledgedBy: asString(input.acknowledgedBy).trim(),
    resolvedAt: asIso(input.resolvedAt, null),
    resolvedBy: asString(input.resolvedBy).trim(),
    activity: (Array.isArray(input.activity) ? input.activity : []).map((item) =>
      makeInteractionEvent({
        ...item,
        interactionId: id,
        portalId,
        proposalId,
        companyId,
      }),
    ),
  }
}

export function cloneInteraction(record) {
  return makeInteractionRecord(record)
}

export function emptyInteraction(input = {}) {
  return makeInteractionRecord({
    ...input,
    status: INTERACTION_STATUS.OPEN,
    source: INTERACTION_SOURCE.CLIENT,
  })
}
