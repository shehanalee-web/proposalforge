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
  allFollowupRecords,
  assignFollowupOwner,
  clientFollowupApiDenied,
  completeFollowup,
  configureFollowupResolvers,
  configureFollowupStore,
  createManualFollowup,
  dismissFollowup,
  FOLLOWUP_CAPABILITIES,
  getCompanyFollowupOverview,
  getProposalFollowupView,
  listFollowupSignals,
  replaceFollowupRecords,
  scheduleFollowup,
  startFollowup,
} from '../src/followup/index.js'

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
  return json(res, status, { message: error.message || 'Follow-up request failed.' })
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
 * Persist follow-up records to `data/followups.json`.
 * Never writes `data/proposals.json`.
 */
export function followupPlugin() {
  const dataDir = ensureRuntimeData()
  const followupsFile = join(dataDir, 'followups.json')
  const proposalsFile = join(dataDir, 'proposals.json')
  let ready = false

  function persist(records) {
    writeJson(followupsFile, records)
  }

  function readProposals() {
    const stored = readJson(proposalsFile, [])
    return Array.isArray(stored) ? stored : []
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(followupsFile, null)
    if (Array.isArray(stored)) {
      replaceFollowupRecords(stored)
    } else {
      replaceFollowupRecords([])
      persist(allFollowupRecords())
    }
    configureFollowupStore({ persist })
    configureFollowupResolvers({
      getProposal(proposalId, companyId) {
        const found = readProposals().find((item) => item.id === proposalId)
        if (!found) return null
        const ownedBy = String(found.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
        if (ownedBy !== companyId) return null
        return found
      },
      listProposals(companyId) {
        return readProposals().filter((item) => {
          const ownedBy = String(item.companyId ?? DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID
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
    })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/followups')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (url.startsWith('/api/followups/public')) {
        return clientFollowupApiDenied()
      }

      if (method === 'GET' && matchRoute(url, '/api/followups/capabilities')) {
        return json(res, 200, { capabilities: FOLLOWUP_CAPABILITIES })
      }

      const signals = matchRoute(url, '/api/followups/signals/:proposalId')
      if (method === 'GET' && signals) {
        const query = queryOf(url)
        return json(res, 200, {
          signals: listFollowupSignals({
            companyId: companyFrom(null, query),
            proposalId: signals.proposalId,
            actor: actorFrom(null, query),
          }),
        })
      }

      const forProposal = matchRoute(url, '/api/followups/proposal/:proposalId')
      if (method === 'GET' && forProposal) {
        const query = queryOf(url)
        return json(res, 200, getProposalFollowupView({
          companyId: companyFrom(null, query),
          proposalId: forProposal.proposalId,
          actor: actorFrom(null, query),
        }))
      }

      if (method === 'GET' && matchRoute(url, '/api/followups')) {
        const query = queryOf(url)
        return json(
          res,
          200,
          getCompanyFollowupOverview({
            companyId: companyFrom(null, query),
            actor: actorFrom(null, query),
            now: Date.now(),
          }),
        )
      }

      if (method === 'POST' && matchRoute(url, '/api/followups')) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 201, {
          followup: createManualFollowup({
            companyId: companyFrom(body),
            proposalId: body.proposalId,
            actor: actorFrom(body),
            title: body.title,
            description: body.description,
            dueAt: body.dueAt,
            ownerActorId: body.ownerActorId,
          }),
        })
      }

      const start = matchRoute(url, '/api/followups/:id/start')
      if (method === 'POST' && start) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          followup: startFollowup({
            companyId: companyFrom(body),
            followupId: start.id,
            actor: actorFrom(body),
          }),
        })
      }

      const complete = matchRoute(url, '/api/followups/:id/complete')
      if (method === 'POST' && complete) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          followup: completeFollowup({
            companyId: companyFrom(body),
            followupId: complete.id,
            actor: actorFrom(body),
          }),
        })
      }

      const dismiss = matchRoute(url, '/api/followups/:id/dismiss')
      if (method === 'POST' && dismiss) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          followup: dismissFollowup({
            companyId: companyFrom(body),
            followupId: dismiss.id,
            actor: actorFrom(body),
          }),
        })
      }

      const assign = matchRoute(url, '/api/followups/:id/assign')
      if (method === 'POST' && assign) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          followup: assignFollowupOwner({
            companyId: companyFrom(body),
            followupId: assign.id,
            actor: actorFrom(body),
            ownerActorId: body.ownerActorId,
          }),
        })
      }

      const schedule = matchRoute(url, '/api/followups/:id/schedule')
      if (method === 'POST' && schedule) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          followup: scheduleFollowup({
            companyId: companyFrom(body),
            followupId: schedule.id,
            actor: actorFrom(body),
            dueAt: body.dueAt,
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
    name: 'proposalforge-followup',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
