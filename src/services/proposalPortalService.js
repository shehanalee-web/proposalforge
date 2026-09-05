import { ForbiddenError, NotFoundError, ValidationError } from './errors.js'
import { DEFAULT_ACTOR_ID } from '../workflow/actors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'

async function parseError(response) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const message = payload?.message || `Portal request failed (${response.status}).`
  const extra = { reason: payload?.reason, unavailable: payload?.unavailable }
  if (response.status === 404) {
    const error = new NotFoundError(message)
    Object.assign(error, extra)
    return error
  }
  if (response.status === 403) {
    const error = new ForbiddenError(message)
    Object.assign(error, extra)
    return error
  }
  if (response.status === 400) {
    return new ValidationError(message, payload?.errors ?? [])
  }
  return Object.assign(new Error(message), extra)
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return null
  return response.json()
}

function withCompany(companyId) {
  return String(companyId ?? '').trim() || DEFAULT_COMPANY_ID
}

function withActor(actorId) {
  return String(actorId ?? '').trim() || DEFAULT_ACTOR_ID
}

export async function fetchProposalPortal({ companyId, proposalId, actorId, create = false } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  if (create) params.set('create', '1')
  const payload = await request(
    `/api/proposal-portal/${encodeURIComponent(proposalId)}?${params}`,
  )
  return payload.portal
}

export async function fetchProposalPortalMap({ companyId, proposalIds = [], actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  if (proposalIds.length) params.set('proposalIds', proposalIds.join(','))
  const payload = await request(`/api/proposal-portal?${params}`)
  return payload.portals ?? []
}

export async function createProposalPortalApi({ companyId, proposalId, actorId } = {}) {
  const payload = await request(
    `/api/proposal-portal/${encodeURIComponent(proposalId)}/create`,
    {
      method: 'POST',
      body: JSON.stringify({
        companyId: withCompany(companyId),
        actorId: withActor(actorId),
      }),
    },
  )
  return payload.portal
}

export async function publishProposalPortalApi({
  companyId,
  proposalId,
  actorId,
  expiresAt,
  clientLabel,
} = {}) {
  return request(`/api/proposal-portal/${encodeURIComponent(proposalId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      expiresAt,
      clientLabel,
    }),
  })
}

export async function revokeProposalPortalApi({ companyId, proposalId, actorId } = {}) {
  const payload = await request(
    `/api/proposal-portal/${encodeURIComponent(proposalId)}/revoke`,
    {
      method: 'POST',
      body: JSON.stringify({
        companyId: withCompany(companyId),
        actorId: withActor(actorId),
      }),
    },
  )
  return payload.portal
}

export async function previewProposalPortalApi({ companyId, proposalId, actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  return request(
    `/api/proposal-portal/${encodeURIComponent(proposalId)}/preview?${params}`,
  )
}

export async function fetchPublicPortalView(portalId) {
  return request(`/api/proposal-portal/public/${encodeURIComponent(portalId)}`)
}

export { DEFAULT_COMPANY_ID, DEFAULT_ACTOR_ID }
