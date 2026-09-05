import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import { findWorkflowByProposal } from '../src/workflow/store.js'
import { WORKFLOW_STATUS } from '../src/workflow/types.js'
import {
  configurePortalResolvers,
  configurePortalStore,
  createPortal,
  getClientPortalView,
  getPortal,
  listPortals,
  PORTAL_CAPABILITIES,
  previewPortal,
  publishPortal,
  replacePortalRecords,
  allPortalRecords,
  revokePortal,
} from '../src/portal/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('Payload is too large.'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function matchRoute(url, pattern) {
  const path = url.split('?')[0]
  const routeParts = pattern.split('/')
  const pathParts = path.split('/')
  if (routeParts.length !== pathParts.length) return null
  const params = {}
  for (let i = 0; i < routeParts.length; i += 1) {
    if (routeParts[i].startsWith(':')) {
      params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i])
      continue
    }
    if (routeParts[i] !== pathParts[i]) return null
  }
  return params
}

function queryOf(url) {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  return new URLSearchParams(q)
}

function fail(res, error) {
  if (error instanceof ValidationError) {
    return json(res, 400, { message: error.message, errors: error.errors })
  }
  if (error instanceof ForbiddenError) {
    return json(res, 403, {
      message: error.message,
      reason: error.reason,
      unavailable: error.unavailable,
    })
  }
  if (error instanceof NotFoundError) {
    return json(res, 404, {
      message: error.message,
      reason: error.reason,
      unavailable: error.unavailable,
    })
  }
  const status = error.status ?? 500
  return json(res, status, { message: error.message || 'Portal request failed.' })
}

function actorFrom(body, query) {
  return {
    id: body?.actorId || query?.get?.('actorId') || DEFAULT_ACTOR_ID,
  }
}

function companyFrom(body, query) {
  return body?.companyId || query?.get?.('companyId') || DEFAULT_COMPANY_ID
}

/**
 * Persist client portal records to `data/portal.json`.
 * Never writes `data/proposals.json`.
 */
export function portalPlugin() {
  const root = resolve(__dirname, '..')
  const portalFile = join(root, 'data', 'portal.json')
  const proposalsFile = join(root, 'data', 'proposals.json')
  let ready = false

  function persist(records) {
    writeJson(portalFile, records)
  }

  function readProposals() {
    const stored = readJson(proposalsFile, [])
    return Array.isArray(stored) ? stored : []
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(portalFile, null)
    if (Array.isArray(stored)) {
      replacePortalRecords(stored)
    } else {
      replacePortalRecords([])
      persist(allPortalRecords())
    }
    configurePortalStore({ persist })
    configurePortalResolvers({
      getProposal(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy = String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (ownedBy !== companyId) return null
        return found
      },
      getWorkflowStatus(companyId, proposalId) {
        return findWorkflowByProposal(companyId, proposalId)?.status ?? WORKFLOW_STATUS.DRAFT
      },
    })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/proposal-portal')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (method === 'GET' && matchRoute(url, '/api/proposal-portal/capabilities')) {
        return json(res, 200, { capabilities: PORTAL_CAPABILITIES })
      }

      const publicView = matchRoute(url, '/api/proposal-portal/public/:portalId')
      if (method === 'GET' && publicView) {
        return json(res, 200, getClientPortalView({ portalId: publicView.portalId }))
      }

      if (method === 'GET' && matchRoute(url, '/api/proposal-portal')) {
        const query = queryOf(url)
        const ids = query.get('proposalIds')
        return json(res, 200, {
          portals: listPortals({
            companyId: companyFrom(null, query),
            proposalIds: ids ? ids.split(',').filter(Boolean) : undefined,
          }),
        })
      }

      const one = matchRoute(url, '/api/proposal-portal/:proposalId')
      if (method === 'GET' && one) {
        const query = queryOf(url)
        const create = query.get('create') === '1'
        return json(res, 200, {
          portal: getPortal({
            companyId: companyFrom(null, query),
            proposalId: one.proposalId,
            actor: actorFrom(null, query),
            create,
          }),
        })
      }

      const preview = matchRoute(url, '/api/proposal-portal/:proposalId/preview')
      if (method === 'GET' && preview) {
        const query = queryOf(url)
        return json(res, 200, previewPortal({
          companyId: companyFrom(null, query),
          proposalId: preview.proposalId,
          actor: actorFrom(null, query),
        }))
      }

      const create = matchRoute(url, '/api/proposal-portal/:proposalId/create')
      if (method === 'POST' && create) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 201, {
          portal: createPortal({
            companyId: companyFrom(body),
            proposalId: create.proposalId,
            actor: actorFrom(body),
          }),
        })
      }

      const publish = matchRoute(url, '/api/proposal-portal/:proposalId/publish')
      if (method === 'POST' && publish) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, publishPortal({
          companyId: companyFrom(body),
          proposalId: publish.proposalId,
          actor: actorFrom(body),
          expiresAt: body.expiresAt ?? null,
          clientLabel: body.clientLabel,
        }))
      }

      const revoke = matchRoute(url, '/api/proposal-portal/:proposalId/revoke')
      if (method === 'POST' && revoke) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          portal: revokePortal({
            companyId: companyFrom(body),
            proposalId: revoke.proposalId,
            actor: actorFrom(body),
          }),
        })
      }

      return next()
    } catch (error) {
      return fail(res, error)
    }
  }

  function attach(server) {
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-proposal-portal',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
