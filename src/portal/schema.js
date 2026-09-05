import { createRecordId } from '../models/ids.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'
import { PORTAL_EVENT, PORTAL_EVENTS, PORTAL_STATUS, PORTAL_STATUSES } from './types.js'

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

function asClientMetadata(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    label: asString(source.label).trim(),
  }
}

export function makePortalEvent(input = {}) {
  const type = PORTAL_EVENTS.includes(input.type) ? input.type : PORTAL_EVENT.CREATED
  const payload =
    input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
      ? { ...input.payload }
      : {}
  delete payload.accessRef
  delete payload.accessKey
  delete payload.token
  delete payload.secret
  return {
    id: asString(input.id).trim() || createRecordId('ptev'),
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

export function makePortalRecord(input = {}) {
  const createdAt = asIso(input.createdAt, nowIso())
  const status = PORTAL_STATUSES.includes(input.status) ? input.status : PORTAL_STATUS.DRAFT
  const proposalId = asString(input.proposalId).trim()
  const companyId = asString(input.companyId).trim() || DEFAULT_COMPANY_ID
  const id = asString(input.id).trim() || createRecordId('portal')
  return {
    id,
    companyId,
    proposalId,
    status,
    createdAt,
    updatedAt: asIso(input.updatedAt, createdAt),
    publishedAt: asIso(input.publishedAt, null),
    revokedAt: asIso(input.revokedAt, null),
    expiresAt: asIso(input.expiresAt, null),
    accessRef: asString(input.accessRef).trim() || id,
    clientFacing: asClientMetadata(input.clientFacing),
    activity: (Array.isArray(input.activity) ? input.activity : []).map((item) =>
      makePortalEvent({ ...item, portalId: id, proposalId, companyId }),
    ),
  }
}

export function clonePortal(record) {
  return makePortalRecord(record)
}

export function emptyPortal({ companyId, proposalId } = {}) {
  return makePortalRecord({
    companyId,
    proposalId,
    status: PORTAL_STATUS.DRAFT,
  })
}

export function publicPortalPath(portalId) {
  return `/portal/${encodeURIComponent(String(portalId ?? '').trim())}`
}
