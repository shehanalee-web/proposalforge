/**
 * H16.9 Slice 9.4 — Native Activity authoring HTTP.
 *
 * Mutation surface only. Timeline GET routes stay on
 * integrationsActivitiesPlugin.js. The capability flag stays false in this
 * slice; isActivityAuthoringEnabled() is checked before every authoring
 * request. Writes go through the studio facade, never a persistence factory.
 */
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  ACTIVITY_SUBJECT_TYPE,
  assertProposalAccess,
  createStudioActivity,
  getStudioActivity,
  updateStudioActivity,
  archiveStudioActivity,
  ensureActivityPersistence,
  isActivityAuthoringEnabled,
} from '../src/integrations/index.js'

const DISABLED_MESSAGE = 'Activity authoring is not enabled.'
const RESERVED_ACTIVITY_IDS = new Set(['timeline', 'capabilities', 'sources'])

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
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

function parseJsonBody(raw) {
  if (!raw || !raw.length) return {}
  try {
    const parsed = JSON.parse(raw.toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ValidationError('Request body must be a JSON object.', [
        { field: 'body', message: 'Request body must be a JSON object.' },
      ])
    }
    return parsed
  } catch (error) {
    if (error instanceof ValidationError) throw error
    throw new ValidationError('Request body is not valid JSON.', [
      { field: 'body', message: 'Request body is not valid JSON.' },
    ])
  }
}

function companyFromQuery(url) {
  return queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
}

function readIdempotencyKey(req) {
  const raw = req.headers?.['idempotency-key']
  const value = Array.isArray(raw) ? raw[0] : raw
  return String(value ?? '').trim() || null
}

function refuseIfDisabled() {
  if (isActivityAuthoringEnabled() === true) return
  throw new ForbiddenError(DISABLED_MESSAGE)
}

/**
 * Native Activity authoring HTTP. No PUT or DELETE. Does not write
 * activities.json. Does not flip activityAuthoring.
 */
export function integrationsActivityAuthoringPlugin() {
  async function handle(req, res, next) {
    await ensureActivityPersistence()
    const url = req.url || ''
    const method = req.method || 'GET'

    const archive = matchRoute(url, '/api/activities/:id/archive')
    if (archive && !RESERVED_ACTIVITY_IDS.has(archive.id)) {
      if (method !== 'POST') return next()
      try {
        refuseIfDisabled()
        const activity = await archiveStudioActivity(archive.id, companyFromQuery(url))
        return json(res, 200, { activity })
      } catch (error) {
        return fail(res, error)
      }
    }

    const one = matchRoute(url, '/api/activities/:id')
    if (one && !RESERVED_ACTIVITY_IDS.has(one.id)) {
      if (method === 'GET') {
        try {
          refuseIfDisabled()
          const activity = await getStudioActivity(one.id, companyFromQuery(url))
          return json(res, 200, { activity })
        } catch (error) {
          return fail(res, error)
        }
      }
      if (method === 'PATCH') {
        try {
          refuseIfDisabled()
          const patch = parseJsonBody(await readBody(req))
          const activity = await updateStudioActivity(one.id, patch, companyFromQuery(url))
          return json(res, 200, { activity })
        } catch (error) {
          return fail(res, error)
        }
      }
      return next()
    }

    if (matchRoute(url, '/api/activities')) {
      if (method !== 'POST') return next()
      try {
        refuseIfDisabled()
        const body = parseJsonBody(await readBody(req))
        const companyId = body.companyId || DEFAULT_COMPANY_ID
        const headerKey = readIdempotencyKey(req)
        const input = {
          ...body,
          companyId,
          idempotencyKey: headerKey ?? body.idempotencyKey ?? null,
        }
        assertProposalAccess(companyId, input.subject ?? {})
        const activity = await createStudioActivity(input)
        return json(res, 201, { activity })
      } catch (error) {
        return fail(res, error)
      }
    }

    return next()
  }

  function attach(server) {
    void ensureActivityPersistence()
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-integrations-activity-authoring',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
