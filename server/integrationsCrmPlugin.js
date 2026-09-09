/**
 * H16.6 — Persist CRM connections + execution outcomes; thin studio HTTP.
 *
 * Sync execution only, and only for internal/studio callers. mock_crm runs
 * in-process with no network. Not an outbox, worker, or retry scheduler.
 * Never writes proposals.json or any H16.5/H16.4 store.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  configureCrmConnectionStore,
  configureCrmOutcomeStore,
  replaceCrmConnections,
  replaceCrmOutcomes,
  serializeCrmConnections,
  serializeCrmOutcomes,
  listStudioCrmConnections,
  getStudioCrmConnection,
  upsertStudioCrmConnection,
  patchStudioCrmConnection,
  deleteStudioCrmConnection,
  listStudioCrmOutcomes,
  getStudioCrmOutcome,
} from '../src/integrations/index.js'

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
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function readBody(req, limit = 512 * 1024) {
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
  return json(res, error?.status || 500, {
    message: error?.message || 'Unexpected error.',
  })
}

/**
 * Load/persist CRM connections + outcomes and expose a thin studio API.
 *
 * There is intentionally no HTTP route that triggers a CRM mutation.
 */
export function integrationsCrmPlugin() {
  const dataDir = ensureRuntimeData()
  const connectionsFile = join(dataDir, 'crm-connections.json')
  const outcomesFile = join(dataDir, 'crm-outcomes.json')
  let ready = false

  function persistConnections(bag) {
    writeJson(connectionsFile, {
      connections: Array.isArray(bag?.connections) ? bag.connections : [],
    })
  }

  function persistOutcomes(bag) {
    writeJson(outcomesFile, {
      outcomes: Array.isArray(bag?.outcomes) ? bag.outcomes : [],
    })
  }

  function ensureStore() {
    if (ready) return
    const storedConnections = readJson(connectionsFile, null)
    if (storedConnections && typeof storedConnections === 'object') {
      replaceCrmConnections(storedConnections)
    } else {
      replaceCrmConnections({ connections: [] })
      persistConnections(serializeCrmConnections())
    }
    configureCrmConnectionStore({ persist: persistConnections })

    const storedOutcomes = readJson(outcomesFile, null)
    if (storedOutcomes && typeof storedOutcomes === 'object') {
      replaceCrmOutcomes(storedOutcomes)
    } else {
      replaceCrmOutcomes({ outcomes: [] })
      persistOutcomes(serializeCrmOutcomes())
    }
    configureCrmOutcomeStore({ persist: persistOutcomes })
    ready = true
  }

  async function handle(req, res, next) {
    ensureStore()
    const url = req.url || ''

    const connections = matchRoute(url, '/api/integrations/crm/connections')
    if (connections && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, { connections: listStudioCrmConnections(companyId) })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (connections && req.method === 'POST') {
      try {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const connection = upsertStudioCrmConnection({
          ...body,
          companyId: body.companyId || DEFAULT_COMPANY_ID,
        })
        return json(res, 201, { connection })
      } catch (error) {
        return fail(res, error)
      }
    }

    const one = matchRoute(url, '/api/integrations/crm/connections/:connectionId')
    if (one && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, {
          connection: getStudioCrmConnection(companyId, one.connectionId),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (one && req.method === 'PATCH') {
      try {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const connection = patchStudioCrmConnection({
          ...body,
          id: one.connectionId,
          companyId: body.companyId || DEFAULT_COMPANY_ID,
        })
        return json(res, 200, { connection })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (one && req.method === 'DELETE') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        deleteStudioCrmConnection(companyId, one.connectionId)
        return json(res, 200, { ok: true })
      } catch (error) {
        return fail(res, error)
      }
    }

    const outcomes = matchRoute(url, '/api/integrations/crm/outcomes')
    if (outcomes && req.method === 'GET') {
      try {
        const q = queryOf(url)
        const companyId = q.get('companyId') || DEFAULT_COMPANY_ID
        const limit = Number(q.get('limit') || 50)
        return json(res, 200, { outcomes: listStudioCrmOutcomes(companyId, { limit }) })
      } catch (error) {
        return fail(res, error)
      }
    }

    const oneOutcome = matchRoute(url, '/api/integrations/crm/outcomes/:outcomeId')
    if (oneOutcome && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, {
          outcome: getStudioCrmOutcome(companyId, oneOutcome.outcomeId),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    return next()
  }

  function attach(server) {
    ensureStore()
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-integrations-crm',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
