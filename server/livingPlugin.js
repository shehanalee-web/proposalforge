import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  allLivingEngagementEvents,
  allLivingSessions,
  applyLivingDecisions,
  configureLivingEventStore,
  configureLivingResolvers,
  configureLivingStore,
  getLivingClientView,
  getLivingStudioSummary,
  LIVING_CAPABILITIES,
  listStudioLivingEngagementEvents,
  recordLivingEngagementEvent,
  replaceLivingEngagementEvents,
  replaceLivingSessions,
} from '../src/living/index.js'

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
    })
  }
  if (error instanceof NotFoundError) {
    return json(res, 404, {
      message: error.message,
      reason: error.reason,
    })
  }
  const status = error.status ?? 500
  return json(res, status, { message: error.message || 'Living request failed.' })
}

function companyFrom(body, query) {
  return body?.companyId || query?.get?.('companyId') || DEFAULT_COMPANY_ID
}

/**
 * Persist living sessions to `data/living.json` and engagement events to
 * `data/living-events.json`. Never writes `data/proposals.json` or follow-ups.
 */
export function livingPlugin() {
  const dataDir = ensureRuntimeData()
  const livingFile = join(dataDir, 'living.json')
  const livingEventsFile = join(dataDir, 'living-events.json')
  const proposalsFile = join(dataDir, 'proposals.json')
  let ready = false

  function persistSessions(records) {
    writeJson(livingFile, records)
  }

  function persistEvents(records) {
    writeJson(livingEventsFile, records)
  }

  function readProposals() {
    const stored = readJson(proposalsFile, [])
    return Array.isArray(stored) ? stored : []
  }

  function ensureStore() {
    if (ready) return
    const storedSessions = readJson(livingFile, null)
    if (Array.isArray(storedSessions)) {
      replaceLivingSessions(storedSessions)
    } else {
      replaceLivingSessions([])
      persistSessions(allLivingSessions())
    }
    configureLivingStore({ persist: persistSessions })

    const storedEvents = readJson(livingEventsFile, null)
    if (Array.isArray(storedEvents)) {
      replaceLivingEngagementEvents(storedEvents)
    } else {
      replaceLivingEngagementEvents([])
      persistEvents(allLivingEngagementEvents())
    }
    configureLivingEventStore({ persist: persistEvents })

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
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/living')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (method === 'GET' && matchRoute(url, '/api/living/capabilities')) {
        return json(res, 200, { capabilities: LIVING_CAPABILITIES })
      }

      const studioEvents = matchRoute(url, '/api/living/proposal/:proposalId/events')
      if (studioEvents) {
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        return json(
          res,
          200,
          listStudioLivingEngagementEvents({
            proposalId: studioEvents.proposalId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const studio = matchRoute(url, '/api/living/proposal/:proposalId')
      if (method === 'GET' && studio) {
        const query = queryOf(url)
        return json(
          res,
          200,
          getLivingStudioSummary({
            proposalId: studio.proposalId,
            companyId: companyFrom(null, query),
          }),
        )
      }

      const events = matchRoute(url, '/api/living/:token/events')
      if (events) {
        if (method === 'GET') {
          return json(res, 403, {
            message: 'Living engagement feeds are studio-only.',
            reason: 'studio_only',
          })
        }
        if (method !== 'POST') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(
          res,
          201,
          {
            event: recordLivingEngagementEvent({
              shareToken: events.token,
              type: body.type,
              blockId: body.blockId,
              offerId: body.offerId,
              sessionId: body.sessionId,
              metadata: body.metadata,
              at: body.at,
              // Ignored identity / money fields — token establishes proposal.
              proposalId: body.proposalId,
              companyId: body.companyId,
              amount: body.amount,
              total: body.total,
              selectedTotal: body.selectedTotal,
              packageAmount: body.packageAmount,
            }),
          },
        )
      }

      const decisions = matchRoute(url, '/api/living/:token/decisions')
      if (method === 'POST' && decisions) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const patch = { shareToken: decisions.token }
        if ('selectedPackageId' in body) patch.selectedPackageId = body.selectedPackageId
        if ('selectedAlternativeId' in body) {
          patch.selectedAlternativeId = body.selectedAlternativeId
        }
        if ('selectedAddonIds' in body) patch.selectedAddonIds = body.selectedAddonIds
        if ('toggleAddonId' in body) patch.toggleAddonId = body.toggleAddonId
        if ('amount' in body) patch.amount = body.amount
        if ('total' in body) patch.total = body.total
        if ('selectedTotal' in body) patch.selectedTotal = body.selectedTotal
        if ('packageAmount' in body) patch.packageAmount = body.packageAmount
        return json(res, 200, applyLivingDecisions(patch))
      }

      const client = matchRoute(url, '/api/living/:token')
      if (method === 'GET' && client) {
        if (client.token === 'proposal' || client.token === 'capabilities') {
          return next()
        }
        return json(res, 200, getLivingClientView({ shareToken: client.token }))
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
    name: 'proposalforge-living',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
