import { assertStorageWritable, endJsonResponse, flushAndNext, ignoreUnavailableWrite, readJson, writeJson } from './runtimeStore.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { studioRequestIdentity } from '../src/integrations/identity/index.js'
import {
  allPortalRecords,
  configurePortalStore,
  replacePortalRecords,
} from '../src/portal/index.js'
import {
  allLivingEngagementEvents,
  configureLivingEventStore,
  configureLivingResolvers,
  replaceLivingEngagementEvents,
} from '../src/living/index.js'
import {
  acknowledgeInteraction,
  allInteractionRecords,
  configureInteractionResolvers,
  configureInteractionStore,
  createClientInteraction,
  createLivingClientInteraction,
  INTERACTION_CAPABILITIES,
  listClientInteractions,
  listLivingClientInteractions,
  listStudioInteractions,
  mutateClientInteraction,
  mutateClientInteractionStatus,
  replaceInteractionRecords,
  resolveInteraction,
} from '../src/interactions/index.js'

function json(res, status, body) {
  return endJsonResponse(res, status, body)
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

/**
 * Persist client interaction records to `data/interactions.json`.
 * Never writes `data/proposals.json`.
 * Living share routes may ensure portal + living-event stores for H12 convergence.
 */
export function interactionsPlugin() {
  let ready = false
  let portalReady = false
  let livingEventsReady = false
  let proposals = []

  function persist(records) {
    assertStorageWritable()
    return writeJson('interactions.json', records)
  }

  function persistPortals(records) {
    assertStorageWritable()
    return writeJson('portal.json', records)
  }

  function persistLivingEvents(records) {
    assertStorageWritable()
    return writeJson('living-events.json', records)
  }

  function readProposals() {
    return Array.isArray(proposals) ? proposals : []
  }

  async function refreshProposals() {
    const stored = await readJson('proposals.json', [])
    proposals = Array.isArray(stored) ? stored : []
    return proposals
  }

  async function ensurePortalStore() {
    if (portalReady) return
    const stored = await readJson('portal.json', null)
    if (Array.isArray(stored)) {
      replacePortalRecords(stored)
    } else {
      replacePortalRecords([])
      await ignoreUnavailableWrite(() => persistPortals(allPortalRecords()))
    }
    configurePortalStore({ persist: persistPortals })
    portalReady = true
  }

  async function ensureLivingEventStore() {
    if (livingEventsReady) return
    const stored = await readJson('living-events.json', null)
    if (Array.isArray(stored)) {
      replaceLivingEngagementEvents(stored)
    } else {
      replaceLivingEngagementEvents([])
      await ignoreUnavailableWrite(() => persistLivingEvents(allLivingEngagementEvents()))
    }
    configureLivingEventStore({ persist: persistLivingEvents })
    configureLivingResolvers({
      getProposalByShareToken(shareToken) {
        const token = String(shareToken ?? '').trim()
        if (!token) return null
        return readProposals().find((item) => item.shareToken === token) ?? null
      },
      getProposalById(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy =
          String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (companyId && ownedBy !== companyId) return null
        return found
      },
    })
    livingEventsReady = true
  }

  async function ensureStore() {
    if (ready) return
    const stored = await readJson('interactions.json', null)
    if (Array.isArray(stored)) {
      replaceInteractionRecords(stored)
    } else {
      replaceInteractionRecords([])
      await ignoreUnavailableWrite(() => persist(allInteractionRecords()))
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
      getProposalByShareToken(shareToken) {
        const token = String(shareToken ?? '').trim()
        if (!token) return null
        return readProposals().find((item) => item.shareToken === token) ?? null
      },
    })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/interactions')) return flushAndNext(next)

    const method = req.method || 'GET'
    function actorFrom(body, query) {
      return studioRequestIdentity(req, body, query).actor
    }
    function companyFrom(body, query) {
      return studioRequestIdentity(req, body, query).companyId
    }

    try {
      await ensureStore()
      await refreshProposals()
      if (method === 'GET' && matchRoute(url, '/api/interactions/capabilities')) {
        return json(res, 200, { capabilities: INTERACTION_CAPABILITIES })
      }

      const livingPublic = matchRoute(url, '/api/interactions/living/:token')
      if (livingPublic) {
        await ensurePortalStore()
        await ensureLivingEventStore()
        if (method === 'GET') {
          return json(res, 200, listLivingClientInteractions({ shareToken: livingPublic.token }))
        }
        if (method === 'POST') {
          const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
          return json(res, 201, {
            interaction: createLivingClientInteraction({
              shareToken: livingPublic.token,
              type: body.type,
              message: body.message,
              blockId: body.blockId,
              // Identity comes from the token — these are validated, never trusted.
              proposalId: body.proposalId,
              companyId: body.companyId,
            }),
          })
        }
        return json(res, 405, { message: 'Method not allowed.' })
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

      return flushAndNext(next)
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
