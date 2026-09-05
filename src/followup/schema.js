import { createRecordId } from '../models/ids.js'
import { ValidationError } from '../services/errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { FOLLOWUP_REASON_META } from './reasons.js'
import {
  FOLLOWUP_PRIORITY,
  FOLLOWUP_PRIORITIES,
  FOLLOWUP_REASON,
  FOLLOWUP_REASONS,
  FOLLOWUP_SOURCE,
  FOLLOWUP_SOURCES,
  FOLLOWUP_STATUS,
  FOLLOWUP_STATUSES,
} from './types.js'

const SECRET_PATTERN =
  /(sk-[a-zA-Z0-9]{16,}|api[_-]?key\s*[:=]|secret[_-]?key\s*[:=]|Bearer\s+[A-Za-z0-9\-._~+/]+=*|-----BEGIN (?:RSA )?PRIVATE KEY-----)/i

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const MAX_TITLE = 200
const MAX_DESCRIPTION = 4000

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

export function normalizeFollowupTitle(value, { required = true } = {}) {
  const title = asString(value).trim()
  assertNoSecret(title, 'title')
  if (required && !title) {
    throw new ValidationError('A title is required.', [
      { field: 'title', message: 'title is required.' },
    ])
  }
  if (title.length > MAX_TITLE) {
    throw new ValidationError('This title is too long.', [
      { field: 'title', message: 'title is too long.' },
    ])
  }
  return title
}

export function normalizeFollowupDescription(value) {
  const description = asString(value).trim()
  assertNoSecret(description, 'description')
  if (description.length > MAX_DESCRIPTION) {
    throw new ValidationError('This description is too long.', [
      { field: 'description', message: 'description is too long.' },
    ])
  }
  return description
}

export function makeFollowupRecord(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  const reason = FOLLOWUP_REASONS.includes(input.reason) ? input.reason : FOLLOWUP_REASON.MANUAL
  const meta = FOLLOWUP_REASON_META[reason]
  const status = FOLLOWUP_STATUSES.includes(input.status) ? input.status : FOLLOWUP_STATUS.OPEN
  const priority = FOLLOWUP_PRIORITIES.includes(input.priority)
    ? input.priority
    : meta?.priority || FOLLOWUP_PRIORITY.MEDIUM
  const sourceType = FOLLOWUP_SOURCES.includes(input.sourceType)
    ? input.sourceType
    : meta?.sourceType || FOLLOWUP_SOURCE.MANUAL
  const companyId = asString(input.companyId).trim() || DEFAULT_COMPANY_ID
  const proposalId = asString(input.proposalId).trim()
  const id = asString(input.id).trim() || createRecordId('fup')
  return {
    id,
    companyId,
    proposalId,
    ownerActorId: asString(input.ownerActorId).trim(),
    reason,
    title: asString(input.title).trim() || meta?.title || 'Follow up',
    description: asString(input.description).trim(),
    priority,
    status,
    dueAt: asIso(input.dueAt, null),
    sourceType,
    sourceId: asString(input.sourceId).trim(),
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
    completedAt: asIso(input.completedAt, null),
    dismissedAt: asIso(input.dismissedAt, null),
  }
}

export function cloneFollowup(record) {
  return makeFollowupRecord(record)
}

export function emptyFollowup(input = {}) {
  return makeFollowupRecord({
    ...input,
    status: FOLLOWUP_STATUS.OPEN,
  })
}
