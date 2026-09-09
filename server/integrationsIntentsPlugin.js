/**
 * H16.4 — Persist automation action intents; thin studio HTTP surface.
 *
 * Not an outbox, worker, or delivery executor. Never writes proposals.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  INTEGRATION_CAPABILITIES,
  cancelStudioAutomationActionIntent,
  configureAutomationActionIntentStore,
  getStudioAutomationActionIntent,
  listStudioAutomationActionIntents,
  replaceAutomationActionIntents,
  serializeAutomationActionIntents,
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
 * Load/persist action intents and expose a thin studio API.
 */
export function integrationsIntentsPlugin() {
  const dataDir = ensureRuntimeData()
  const intentsFile = join(dataDir, 'automation-action-intents.json')
  let ready = false

  function persist(bag) {
    writeJson(intentsFile, {
      intents: Array.isArray(bag?.intents) ? bag.intents : [],
    })
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(intentsFile, null)
    if (stored && typeof stored === 'object') {
      replaceAutomationActionIntents(stored)
    } else {
      replaceAutomationActionIntents({ intents: [] })
      persist(serializeAutomationActionIntents())
    }
    configureAutomationActionIntentStore({ persist })
    ready = true
  }

  async function handle(req, res, next) {
    ensureStore()
    const url = req.url || ''

    if (req.method === 'GET' && matchRoute(url, '/api/integrations/capabilities')) {
      return json(res, 200, { capabilities: INTEGRATION_CAPABILITIES })
    }

    const list = matchRoute(url, '/api/integrations/action-intents')
    if (list && req.method === 'GET') {
      try {
        const q = queryOf(url)
        const companyId = q.get('companyId') || DEFAULT_COMPANY_ID
        const status = q.get('status') || undefined
        const limit = Number(q.get('limit') || 50)
        return json(res, 200, {
          intents: listStudioAutomationActionIntents(companyId, { limit, status }),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    const one = matchRoute(url, '/api/integrations/action-intents/:intentId')
    if (one && req.method === 'GET') {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, {
          intent: getStudioAutomationActionIntent(companyId, one.intentId),
        })
      } catch (error) {
        return fail(res, error)
      }
    }

    const cancel = matchRoute(url, '/api/integrations/action-intents/:intentId/cancel')
    if (cancel && req.method === 'POST') {
      try {
        const raw = await readBody(req)
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
        const intent = cancelStudioAutomationActionIntent({
          companyId: body.companyId || DEFAULT_COMPANY_ID,
          intentId: cancel.intentId,
          reason: body.reason,
        })
        return json(res, 200, { intent })
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
    name: 'proposalforge-integrations-intents',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
