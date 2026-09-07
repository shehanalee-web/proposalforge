import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import {
  configureLivingEventStore,
  replaceLivingEngagementEvents,
} from '../src/living/eventStore.js'
import {
  configureLivingStore,
  replaceLivingSessions,
} from '../src/living/store.js'
import { configureLivingResolvers } from '../src/living/resolvers.js'
import {
  allFollowupRecords,
  configureFollowupStore,
  replaceFollowupRecords,
} from '../src/followup/index.js'
import {
  COMMERCIAL_CLOSE_CAPABILITIES,
  allCommercialCloses,
  clientCommercialCloseTransitionDenied,
  completeInternalCommercialCloseSignature,
  configureCommercialCloseStore,
  createCommercialCloseFromAcceptedDecision,
  getClientCommercialCloseSummary,
  getCommercialCloseById,
  getCommercialCloseForProposal,
  getCommercialCloseSignature,
  replaceCommercialCloses,
  requestCommercialCloseSignature,
  transitionCommercialClose,
} from '../src/commercialClose/index.js'

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
  return json(res, status, { message: error.message || 'Commercial close request failed.' })
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
 * Persist commercial closes to `data/commercial-closes.json`.
 * Never writes `data/proposals.json`.
 * H13 follow-up side-effects may write `data/followups.json`.
 */
export function commercialClosePlugin() {
  const dataDir = ensureRuntimeData()
  const closesFile = join(dataDir, 'commercial-closes.json')
  const livingFile = join(dataDir, 'living.json')
  const livingEventsFile = join(dataDir, 'living-events.json')
  const followupsFile = join(dataDir, 'followups.json')
  const proposalsFile = join(dataDir, 'proposals.json')
  let ready = false

  function persistCloses(records) {
    writeJson(closesFile, records)
  }

  function persistSessions(records) {
    writeJson(livingFile, records)
  }

  function persistEvents(records) {
    writeJson(livingEventsFile, records)
  }

  function persistFollowups(records) {
    writeJson(followupsFile, records)
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
    }
    configureLivingStore({ persist: persistSessions })

    const storedEvents = readJson(livingEventsFile, null)
    if (Array.isArray(storedEvents)) {
      replaceLivingEngagementEvents(storedEvents)
    }
    configureLivingEventStore({ persist: persistEvents })

    const storedFollowups = readJson(followupsFile, null)
    if (Array.isArray(storedFollowups)) {
      replaceFollowupRecords(storedFollowups)
    } else {
      replaceFollowupRecords([])
      persistFollowups(allFollowupRecords())
    }
    configureFollowupStore({ persist: persistFollowups })

    const storedCloses = readJson(closesFile, null)
    if (Array.isArray(storedCloses)) {
      replaceCommercialCloses(storedCloses)
    } else {
      replaceCommercialCloses([])
      persistCloses(allCommercialCloses())
    }
    configureCommercialCloseStore({ persist: persistCloses })

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
    if (!url.startsWith('/api/commercial-close')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (method === 'GET' && matchRoute(url, '/api/commercial-close/capabilities')) {
        return json(res, 200, { capabilities: COMMERCIAL_CLOSE_CAPABILITIES })
      }

      const publicByToken = matchRoute(url, '/api/commercial-close/public/:token')
      if (publicByToken) {
        if (method === 'POST') {
          clientCommercialCloseTransitionDenied()
        }
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        return json(
          res,
          200,
          getClientCommercialCloseSummary({ shareToken: publicByToken.token }),
        )
      }

      const publicTransition = matchRoute(
        url,
        '/api/commercial-close/public/:token/transition',
      )
      if (publicTransition) {
        clientCommercialCloseTransitionDenied()
      }

      const transition = matchRoute(url, '/api/commercial-close/:closeId/transition')
      if (transition) {
        if (method !== 'POST') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8') || '{}') : {}
        return json(
          res,
          200,
          transitionCommercialClose({
            closeId: transition.closeId,
            companyId: companyFrom(body, query),
            actor: actorFrom(body, query),
            to: body.to,
          }),
        )
      }

      const signatureRequest = matchRoute(
        url,
        '/api/commercial-close/:closeId/signature/request',
      )
      if (signatureRequest) {
        if (method !== 'POST') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8') || '{}') : {}
        const result = requestCommercialCloseSignature({
          closeId: signatureRequest.closeId,
          companyId: companyFrom(body, query),
          actor: actorFrom(body, query),
          parties: body.parties,
        })
        return json(res, result.created === false ? 200 : 200, result)
      }

      const signatureComplete = matchRoute(
        url,
        '/api/commercial-close/:closeId/signature/complete',
      )
      if (signatureComplete) {
        if (method !== 'POST') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8') || '{}') : {}
        return json(
          res,
          200,
          completeInternalCommercialCloseSignature({
            closeId: signatureComplete.closeId,
            companyId: companyFrom(body, query),
            actor: actorFrom(body, query),
            signerDisplayName: body.signerDisplayName,
            signedAt: body.signedAt,
            evidenceRef: body.evidenceRef,
          }),
        )
      }

      const signatureGet = matchRoute(url, '/api/commercial-close/:closeId/signature')
      if (signatureGet) {
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        return json(
          res,
          200,
          getCommercialCloseSignature({
            closeId: signatureGet.closeId,
            companyId: companyFrom(null, query),
            actor: actorFrom(null, query),
          }),
        )
      }

      const byProposal = matchRoute(url, '/api/commercial-close/proposal/:proposalId')
      if (byProposal) {
        const query = queryOf(url)
        if (method === 'GET') {
          return json(
            res,
            200,
            getCommercialCloseForProposal({
              proposalId: byProposal.proposalId,
              companyId: companyFrom(null, query),
              actor: actorFrom(null, query),
            }),
          )
        }
        if (method === 'POST') {
          const raw = await readBody(req)
          const body = raw.length ? JSON.parse(raw.toString('utf8') || '{}') : {}
          const result = createCommercialCloseFromAcceptedDecision({
            proposalId: byProposal.proposalId,
            companyId: companyFrom(body, query),
            actor: actorFrom(body, query),
            sessionId: body.sessionId,
          })
          return json(res, result.created ? 201 : 200, result)
        }
        return json(res, 405, { message: 'Method not allowed.' })
      }

      const byCloseId = matchRoute(url, '/api/commercial-close/:closeId')
      if (byCloseId) {
        if (method !== 'GET') {
          return json(res, 405, { message: 'Method not allowed.' })
        }
        const query = queryOf(url)
        return json(
          res,
          200,
          getCommercialCloseById({
            closeId: byCloseId.closeId,
            companyId: companyFrom(null, query),
            actor: actorFrom(null, query),
          }),
        )
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
    name: 'proposalforge-commercial-close',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
