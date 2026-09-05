import { NotFoundError, ValidationError } from './errors.js'
import { DEFAULT_COMPANY_ID } from '../knowledge/types.js'

async function parseError(response) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const message = payload?.message || `Knowledge request failed (${response.status}).`
  if (response.status === 404) return new NotFoundError(message)
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

export async function fetchCompanyKnowledge({
  companyId,
  query,
  categories,
  status,
  includeArchived,
  limit,
} = {}) {
  const params = new URLSearchParams()
  params.set('companyId', withCompany(companyId))
  if (query) params.set('query', query)
  if (categories?.length) params.set('categories', categories.join(','))
  if (status) params.set('status', Array.isArray(status) ? status.join(',') : status)
  if (includeArchived) params.set('includeArchived', 'true')
  if (limit) params.set('limit', String(limit))
  const payload = await request(`/api/knowledge?${params}`)
  return payload.records ?? []
}

export async function fetchKnowledgeItem(companyId, id) {
  const params = new URLSearchParams({ companyId: withCompany(companyId) })
  const payload = await request(`/api/knowledge/item/${encodeURIComponent(id)}?${params}`)
  return payload.record
}

export async function searchCompanyKnowledgeApi(input = {}) {
  const payload = await request('/api/knowledge/search', {
    method: 'POST',
    body: JSON.stringify({ ...input, companyId: withCompany(input.companyId) }),
  })
  return payload.records ?? []
}

export async function fetchKnowledgeContext(input = {}) {
  const payload = await request('/api/knowledge/context', {
    method: 'POST',
    body: JSON.stringify({ ...input, companyId: withCompany(input.companyId) }),
  })
  return payload
}

export async function createKnowledgeItemApi(input = {}) {
  const payload = await request('/api/knowledge', {
    method: 'POST',
    body: JSON.stringify({ ...input, companyId: withCompany(input.companyId) }),
  })
  return payload.record
}

export async function updateKnowledgeItemApi({ companyId, id, changes }) {
  const payload = await request(`/api/knowledge/item/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ companyId: withCompany(companyId), changes }),
  })
  return payload.record
}

export async function approveKnowledgeItemApi({ companyId, id, approvedBy = 'studio' }) {
  const payload = await request(`/api/knowledge/item/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ companyId: withCompany(companyId), approvedBy }),
  })
  return payload.record
}

export async function archiveKnowledgeItemApi({ companyId, id }) {
  const payload = await request(`/api/knowledge/item/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: JSON.stringify({ companyId: withCompany(companyId) }),
  })
  return payload.record
}

export async function restoreKnowledgeItemApi({ companyId, id }) {
  const payload = await request(`/api/knowledge/item/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ companyId: withCompany(companyId) }),
  })
  return payload.record
}

export async function saveProposalToKnowledgeApi(input = {}) {
  const payload = await request('/api/knowledge/from-proposal', {
    method: 'POST',
    body: JSON.stringify({ ...input, companyId: withCompany(input.companyId) }),
  })
  return payload.record
}

export async function fetchKnowledgeDuplicates(input = {}) {
  const payload = await request('/api/knowledge/duplicates', {
    method: 'POST',
    body: JSON.stringify({ ...input, companyId: withCompany(input.companyId) }),
  })
  return payload.records ?? []
}

export { DEFAULT_COMPANY_ID }
