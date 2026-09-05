import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import {
  acknowledgeInteraction,
  allInteractionRecords,
  configureInteractionResolvers,
  configureInteractionStore,
  createClientInteraction,
  INTERACTION_CAPABILITIES,
  listClientInteractions,
  listStudioInteractions,
  mutateClientInteraction,
  mutateClientInteractionStatus,
  replaceInteractionRecords,
  resolveInteraction,
} from '../src/interactions/index.js'

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
  return json(res, status, { message: error.message || 'Interaction request failed.' })
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
 * Persist client interaction records to `data/interactions.json`.
 * Never writes `data/proposals.json`.
 */
export function interactionsPlugin() {
  const dataDir = ensureRuntimeData()
  const interactionsFile = join(dataDir, 'interactions.json')
  const proposalsFile = join(dataDir, 'proposals.json')
  let ready = false

  function persist(records) {
    writeJson(interactionsFile, records)
  }

  function readProposals() {
    const stored = readJson(proposalsFile, [])
    return Array.isArray(stored) ? stored : []
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(interactionsFile, null)
    if (Array.isArray(stored)) {
      replaceInteractionRecords(stored)
    } else {
      replaceInteractionRecords([])
      persist(allInteractionRecords())
    }
    configureInteractionStore({ persist })
    configureInteractionResolvers({
      getProposal(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy = String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (ownedBy !== companyId) return null
        return found
      },
    })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/interactions')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (method === 'GET' && matchRoute(url, '/api/interactions/capabilities')) {
        return json(res, 200, { capabilities: INTERACTION_CAPABILITIES })
      }

      const publicList = matchRoute(url, '/api/interactions/public/:portalId')
      if (method === 'GET' && publicList) {
        return json(res, 200, listClientInteractions({ portalId: publicList.portalId }))
      }
      if (method === 'POST' && publicList) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 201, {
          interaction: createClientInteraction({
            portalId: publicList.portalId,
            type: body.type,
            message: body.message,
            blockId: body.blockId,
            proposalId: body.proposalId,
            companyId: body.companyId,
          }),
        })
      }

      const publicMutate = matchRoute(url, '/api/interactions/public/:portalId/:interactionId')
      if (publicMutate && (method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
        if (method === 'DELETE') mutateClientInteraction()
        return mutateClientInteraction()
      }

      const publicStatus = matchRoute(url, '/api/interactions/public/:portalId/:interactionId/status')
      if (publicStatus && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        return mutateClientInteractionStatus()
      }

      const publicResolve = matchRoute(url, '/api/interactions/public/:portalId/:interactionId/resolve')
      if (method === 'POST' && publicResolve) {
        return mutateClientInteractionStatus()
      }

      const publicAck = matchRoute(url, '/api/interactions/public/:portalId/:interactionId/acknowledge')
      if (method === 'POST' && publicAck) {
        return mutateClientInteractionStatus()
      }

      if (method === 'GET' && matchRoute(url, '/api/interactions')) {
        const query = queryOf(url)
        return json(res, 200, {
          interactions: listStudioInteractions({
            companyId: companyFrom(null, query),
            proposalId: query.get('proposalId') || '',
            portalId: query.get('portalId') || '',
            status: query.get('status') || '',
            actor: actorFrom(null, query),
          }),
        })
      }

      const acknowledge = matchRoute(url, '/api/interactions/:interactionId/acknowledge')
      if (method === 'POST' && acknowledge) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          interaction: acknowledgeInteraction({
            companyId: companyFrom(body),
            interactionId: acknowledge.interactionId,
            actor: actorFrom(body),
          }),
        })
      }

      const resolveRoute = matchRoute(url, '/api/interactions/:interactionId/resolve')
      if (method === 'POST' && resolveRoute) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          interaction: resolveInteraction({
            companyId: companyFrom(body),
            interactionId: resolveRoute.interactionId,
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
    name: 'proposalforge-interactions',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
