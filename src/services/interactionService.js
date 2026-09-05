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

  const message = payload?.message || `Interaction request failed (${response.status}).`
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

export async function fetchPublicInteractions(portalId) {
  return request(`/api/interactions/public/${encodeURIComponent(portalId)}`)
}

export async function createPublicInteraction(portalId, body = {}) {
  const payload = await request(`/api/interactions/public/${encodeURIComponent(portalId)}`, {
    method: 'POST',
    body: JSON.stringify({
      type: body.type,
      message: body.message,
      blockId: body.blockId || '',
      proposalId: body.proposalId,
    }),
  })
  return payload.interaction
}

export async function fetchStudioInteractions({
  companyId,
  proposalId,
  portalId,
  status,
  actorId,
} = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  if (proposalId) params.set('proposalId', proposalId)
  if (portalId) params.set('portalId', portalId)
  if (status) params.set('status', status)
  const payload = await request(`/api/interactions?${params}`)
  return payload.interactions ?? []
}

export async function acknowledgeInteractionApi({ companyId, interactionId, actorId } = {}) {
  const payload = await request(
    `/api/interactions/${encodeURIComponent(interactionId)}/acknowledge`,
    {
      method: 'POST',
      body: JSON.stringify({
        companyId: withCompany(companyId),
        actorId: withActor(actorId),
      }),
    },
  )
  return payload.interaction
}

export async function resolveInteractionApi({ companyId, interactionId, actorId } = {}) {
  const payload = await request(`/api/interactions/${encodeURIComponent(interactionId)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
    }),
  })
  return payload.interaction
}

export { DEFAULT_COMPANY_ID, DEFAULT_ACTOR_ID }
