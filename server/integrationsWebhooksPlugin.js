/**
 * H16.5 — Persist outbound webhook destinations + outcomes; thin studio HTTP.
 *
 * Sync execution only. Live HTTPS requires OUTBOUND_WEBHOOK_NETWORK=1.
 * Not an outbox, worker, or retry scheduler. Never writes proposals.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  INTEGRATION_CAPABILITIES,
  configureOutboundWebhookDestinationStore,
  configureOutboundWebhookOutcomeStore,
  replaceOutboundWebhookDestinations,
  replaceOutboundWebhookOutcomes,
  serializeOutboundWebhookDestinations,
  serializeOutboundWebhookOutcomes,
  listStudioOutboundWebhookDestinations,
  getStudioOutboundWebhookDestination,
  upsertStudioOutboundWebhookDestination,
  patchStudioOutboundWebhookDestination,
  deleteStudioOutboundWebhookDestination,
  listStudioOutboundWebhookOutcomes,
  getStudioOutboundWebhookOutcome,
  executeStudioOutboundWebhook,
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
  return json(res, error?.status || 500, {
    message: error?.message || 'Unexpected error.',
  })
}

/**
 * Load/persist webhook destinations + outcomes and expose a thin studio API.
 */
export function integrationsWebhooksPlugin() {
  const dataDir = ensureRuntimeData()
  const destinationsFile = join(dataDir, 'outbound-webhook-destinations.json')
  const outcomesFile = join(dataDir, 'outbound-webhook-outcomes.json')
  let ready = false

  function persistDestinations(bag) {
    writeJson(destinationsFile, {
      destinations: Array.isArray(bag?.destinations) ? bag.destinations : [],
    })
  }

  function persistOutcomes(bag) {
    writeJson(outcomesFile, {
      outcomes: Array.isArray(bag?.outcomes) ? bag.outcomes : [],
    })
  }

  function ensureStore() {
    if (ready) return
    const storedDestinations = readJson(destinationsFile, null)
    if (storedDestinations && typeof storedDestinations === 'object') {
      replaceOutboundWebhookDestinations(storedDestinations)
    } else {
      replaceOutboundWebhookDestinations({ destinations: [] })
      persistDestinations(serializeOutboundWebhookDestinations())
    }
    configureOutboundWebhookDestinationStore({ persist: persistDestinations })

    const storedOutcomes = readJson(outcomesFile, null)
    if (storedOutcomes && typeof storedOutcomes === 'object') {
      replaceOutboundWebhookOutcomes(storedOutcomes)
    } else {
      replaceOutboundWebhookOutcomes({ outcomes: [] })
      persistOutcomes(serializeOutboundWebhookOutcomes())
    }
    configureOutboundWebhookOutcomeStore({ persist: persistOutcomes })
    ready = true
  }

  async function handle(req, res, next) {
    ensureStore()
    const url = req.url || ''

    if (req.method === 'GET' && matchRoute(url, '/api/integrations/capabilities')) {
      return json(res, 200, { capabilities: INTEGRATION_CAPABILITIES })
    }

    const destinations = matchRoute(url, '/api/integrations/outbound-webhooks/destinations')
    if (destinations && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, {
          destinations: listStudioOutboundWebhookDestinations(companyId),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (destinations && req.method === 'POST') {
      try {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const destination = upsertStudioOutboundWebhookDestination({
          ...body,
          companyId: body.companyId || DEFAULT_COMPANY_ID,
        })
        return json(res, 201, { destination })
      } catch (error) {
        return fail(res, error)
      }
    }

    const one = matchRoute(
      url,
      '/api/integrations/outbound-webhooks/destinations/:destinationId',
    )
    if (one && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, {
          destination: getStudioOutboundWebhookDestination(
            companyId,
            one.destinationId,
          ),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (one && req.method === 'PATCH') {
      try {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const destination = patchStudioOutboundWebhookDestination({
          ...body,
          id: one.destinationId,
          companyId: body.companyId || DEFAULT_COMPANY_ID,
        })
        return json(res, 200, { destination })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (one && req.method === 'DELETE') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        deleteStudioOutboundWebhookDestination(companyId, one.destinationId)
        return json(res, 200, { ok: true })
      } catch (error) {
        return fail(res, error)
      }
    }

    const outcomes = matchRoute(url, '/api/integrations/outbound-webhooks/outcomes')
    if (outcomes && req.method === 'GET') {
      try {
        const q = queryOf(url)
        const companyId = q.get('companyId') || DEFAULT_COMPANY_ID
        const limit = Number(q.get('limit') || 50)
        return json(res, 200, {
          outcomes: listStudioOutboundWebhookOutcomes(companyId, { limit }),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    const oneOutcome = matchRoute(
      url,
      '/api/integrations/outbound-webhooks/outcomes/:outcomeId',
    )
    if (oneOutcome && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, {
          outcome: getStudioOutboundWebhookOutcome(companyId, oneOutcome.outcomeId),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    const execute = matchRoute(url, '/api/integrations/outbound-webhooks/execute')
    if (execute && req.method === 'POST') {
      try {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const result = await executeStudioOutboundWebhook({
          companyId: body.companyId || DEFAULT_COMPANY_ID,
          intentId: body.intentId,
        })
        return json(res, 200, result)
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
    name: 'proposalforge-integrations-webhooks',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
