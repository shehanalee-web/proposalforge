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

  const message = payload?.message || `Workflow request failed (${response.status}).`
  if (response.status === 404) return new NotFoundError(message)
  if (response.status === 403) return new ForbiddenError(message)
  if (response.status === 400) {
    return new ValidationError(message, payload?.errors ?? [])
  }
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

export async function fetchWorkflow({ companyId, proposalId, actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  const payload = await request(`/api/workflow/${encodeURIComponent(proposalId)}?${params}`)
  return payload.workflow
}

export async function fetchWorkflowMap({ companyId, proposalIds = [], actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  if (proposalIds.length) params.set('proposalIds', proposalIds.join(','))
  const payload = await request(`/api/workflow?${params}`)
  return payload.workflows ?? []
}

export async function fetchWorkflowOverview({ companyId, actorId } = {}) {
  const params = new URLSearchParams({
    companyId: withCompany(companyId),
    actorId: withActor(actorId),
  })
  const payload = await request(`/api/workflow/overview?${params}`)
  return payload.overview
}

export async function transitionWorkflowApi({ companyId, proposalId, actorId, to, note } = {}) {
  const payload = await request(`/api/workflow/${encodeURIComponent(proposalId)}/transition`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      to,
      note,
    }),
  })
  return payload.workflow
}

export async function assignWorkflowApi({ companyId, proposalId, actorId, ...body } = {}) {
  const payload = await request(`/api/workflow/${encodeURIComponent(proposalId)}/assign`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      ...body,
    }),
  })
  return payload.workflow
}

export async function addWorkflowCommentApi({
  companyId,
  proposalId,
  actorId,
  body,
  blockId,
} = {}) {
  const payload = await request(`/api/workflow/${encodeURIComponent(proposalId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      body,
      blockId,
    }),
  })
  return payload.workflow
}

export async function patchWorkflowCommentApi({
  companyId,
  proposalId,
  actorId,
  commentId,
  action,
} = {}) {
  const payload = await request(
    `/api/workflow/${encodeURIComponent(proposalId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        companyId: withCompany(companyId),
        actorId: withActor(actorId),
        action,
      }),
    },
  )
  return payload.workflow
}

export async function createWorkflowTaskApi({ companyId, proposalId, actorId, ...body } = {}) {
  const payload = await request(`/api/workflow/${encodeURIComponent(proposalId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      ...body,
    }),
  })
  return payload.workflow
}

export async function patchWorkflowTaskApi({
  companyId,
  proposalId,
  actorId,
  taskId,
  changes,
} = {}) {
  const payload = await request(
    `/api/workflow/${encodeURIComponent(proposalId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        companyId: withCompany(companyId),
        actorId: withActor(actorId),
        changes,
      }),
    },
  )
  return payload.workflow
}

export async function postWorkflowApprovalApi({
  companyId,
  proposalId,
  actorId,
  action,
  note,
  blockId,
} = {}) {
  const payload = await request(`/api/workflow/${encodeURIComponent(proposalId)}/approvals`, {
    method: 'POST',
    body: JSON.stringify({
      companyId: withCompany(companyId),
      actorId: withActor(actorId),
      action,
      note,
      blockId,
    }),
  })
  return payload.workflow
}

export { DEFAULT_COMPANY_ID, DEFAULT_ACTOR_ID }
