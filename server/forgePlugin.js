import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import { findWorkflowByProposal } from '../src/workflow/store.js'
import { findPortalByProposal } from '../src/portal/store.js'
import { listInteractionsForProposal } from '../src/interactions/store.js'
import {
  findLivingSessionByShareToken,
  listLivingSessionsForProposal,
  allLivingSessions,
  configureLivingStore,
  replaceLivingSessions,
} from '../src/living/store.js'
import {
  allLivingEngagementEvents,
  configureLivingEventStore,
  replaceLivingEngagementEvents,
} from '../src/living/eventStore.js'
import {
  allLivingPublications,
  configureLivingPublicationStore,
  replaceLivingPublications,
} from '../src/living/publicationStore.js'
import {
  allFollowupRecords,
  configureFollowupResolvers,
  configureFollowupStore,
  replaceFollowupRecords,
} from '../src/followup/index.js'
import {
  FORGE_CAPABILITIES,
  clientForgeApiDenied,
  getForgeProposalView,
  runForgeAction,
} from '../src/forge/index.js'
import { LIVING_CAPABILITIES } from '../src/living/types.js'

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
    return json(res, 403, { message: error.message })
  }
  if (error instanceof NotFoundError) {
    return json(res, 404, { message: error.message })
  }
  const status = error.status ?? 500
  return json(res, status, { message: error.message || 'Forge request failed.' })
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
 * Studio-only Forge plugin.
 * Never writes `data/proposals.json`.
 * Follow-up writes go through H13 into `data/followups.json`.
 */
export function forgePlugin() {
  const dataDir = ensureRuntimeData()
  const followupsFile = join(dataDir, 'followups.json')
  const livingFile = join(dataDir, 'living.json')
  const livingEventsFile = join(dataDir, 'living-events.json')
  const livingPublicationsFile = join(dataDir, 'living-publications.json')
  const proposalsFile = join(dataDir, 'proposals.json')
  let ready = false

  function persistFollowups(records) {
    writeJson(followupsFile, records)
  }

  function persistSessions(records) {
    writeJson(livingFile, records)
  }

  function persistEvents(records) {
    writeJson(livingEventsFile, records)
  }

  function persistPublications(records) {
    writeJson(livingPublicationsFile, records)
  }

  function readProposals() {
    const stored = readJson(proposalsFile, [])
    return Array.isArray(stored) ? stored : []
  }

  function ensureStore() {
    if (ready) return

    const storedFollowups = readJson(followupsFile, null)
    if (Array.isArray(storedFollowups)) replaceFollowupRecords(storedFollowups)
    else {
      replaceFollowupRecords([])
      persistFollowups(allFollowupRecords())
    }
    configureFollowupStore({ persist: persistFollowups })

    const storedSessions = readJson(livingFile, null)
    if (Array.isArray(storedSessions)) replaceLivingSessions(storedSessions)
    else {
      replaceLivingSessions([])
      persistSessions(allLivingSessions())
    }
    configureLivingStore({ persist: persistSessions })

    const storedEvents = readJson(livingEventsFile, null)
    if (Array.isArray(storedEvents)) replaceLivingEngagementEvents(storedEvents)
    else {
      replaceLivingEngagementEvents([])
      persistEvents(allLivingEngagementEvents())
    }
    configureLivingEventStore({ persist: persistEvents })

    const storedPublications = readJson(livingPublicationsFile, null)
    if (Array.isArray(storedPublications)) replaceLivingPublications(storedPublications)
    else {
      replaceLivingPublications([])
      persistPublications(allLivingPublications())
    }
    configureLivingPublicationStore({ persist: persistPublications })

    configureFollowupResolvers({
      getProposal(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy =
          String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (ownedBy !== companyId) return null
        return found
      },
      listProposals(companyId) {
        return readProposals().filter((item) => {
          const ownedBy =
            String(item.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
          return ownedBy === companyId
        })
      },
      getWorkflow(companyId, proposalId) {
        return findWorkflowByProposal(companyId, proposalId) ?? null
      },
      getPortal(companyId, proposalId) {
        return findPortalByProposal(companyId, proposalId) ?? null
      },
      getInteractions(companyId, proposalId) {
        return listInteractionsForProposal(companyId, proposalId)
      },
      getLivingSession(companyId, proposalId) {
        const proposals = readProposals()
        const proposal = proposals.find((item) => item.id === proposalId)
        if (proposal?.shareToken) {
          const byToken = findLivingSessionByShareToken(proposal.shareToken)
          if (byToken) return byToken
        }
        const sessions = listLivingSessionsForProposal(proposalId)
        return sessions.find((item) => item.companyId === companyId) ?? sessions[0] ?? null
      },
    })

    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/forge')) return next()

    const method = req.method || 'GET'

    try {
      ensureStore()
      if (url.startsWith('/api/forge/public')) {
        return clientForgeApiDenied()
      }

      if (method === 'GET' && matchRoute(url, '/api/forge/capabilities')) {
        return json(res, 200, {
          capabilities: FORGE_CAPABILITIES,
          livingCapabilities: LIVING_CAPABILITIES,
        })
      }

      const proposalView = matchRoute(url, '/api/forge/proposal/:proposalId')
      if (proposalView) {
        const query = queryOf(url)
        if (method === 'GET') {
          return json(
            res,
            200,
            getForgeProposalView({
              companyId: companyFrom(null, query),
              proposalId: proposalView.proposalId,
              actor: actorFrom(null, query),
            }),
          )
        }
        if (method === 'POST') {
          const raw = await readBody(req)
          const body = raw.length ? JSON.parse(raw.toString('utf8') || '{}') : {}
          return json(
            res,
            200,
            runForgeAction({
              companyId: companyFrom(body, query),
              proposalId: proposalView.proposalId,
              actor: actorFrom(body, query),
              action: body.action,
              followupId: body.followupId,
              title: body.title,
              description: body.description,
            }),
          )
        }
        return json(res, 405, { message: 'Method not allowed.' })
      }

      return json(res, 404, { message: 'Forge route not found.' })
    } catch (error) {
      if (error instanceof SyntaxError) {
        return json(res, 400, { message: 'Invalid JSON body.' })
      }
      return fail(res, error)
    }
  }

  function attach(server) {
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-forge',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
