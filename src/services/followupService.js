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

  const message = payload?.message || `Follow-up request failed (${response.status}).`
  if (response.status === 404) return new NotFoundError(message)
  if (response.status === 403) return new ForbiddenError(message)
  if (response.status === 400) return new ValidationError(message, payload?.errors ?? [])
  return new Error(message)
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

export async function fetchFollowupCapabilities() {
  return request('/api/followups/capabilities')
}

export async function fetchFollowups({ companyId, actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  return request(`/api/followups?${params}`)
}

export async function fetchProposalFollowups({ companyId, proposalId, actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  return request(`/api/followups/proposal/${encodeURIComponent(proposalId)}?${params}`)
}

export async function fetchFollowupSignals({ companyId, proposalId, actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  const payload = await request(
    `/api/followups/signals/${encodeURIComponent(proposalId)}?${params}`,
  )
  return payload.signals ?? []
}

export async function createFollowupApi({
  companyId,
  proposalId,
  actorId,
  title,
  description,
  dueAt,
  ownerActorId,
} = {}) {
  const payload = await request('/api/followups', {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      proposalId,
      title,
      description,
      dueAt,
      ownerActorId,
    }),
  })
  return payload.followup
}

function mutate(path, { companyId, followupId, actorId, extra } = {}) {
  return request(`/api/followups/${encodeURIComponent(followupId)}${path}`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      ...extra,
    }),
  }).then((payload) => payload.followup)
}

export function startFollowupApi(input) {
  return mutate('/start', input)
}

export function completeFollowupApi(input) {
  return mutate('/complete', input)
}

export function dismissFollowupApi(input) {
  return mutate('/dismiss', input)
}

export function assignFollowupApi({ ownerActorId, ...input } = {}) {
  return mutate('/assign', { ...input, extra: { ownerActorId } })
}

export function scheduleFollowupApi({ dueAt, ...input } = {}) {
  return mutate('/schedule', { ...input, extra: { dueAt } })
}

export { DEFAULT_COMPANY_ID, DEFAULT_ACTOR_ID }
