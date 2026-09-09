/**
 * H16.7 — Activity timeline HTTP surface.
 *
 * Read-only by design. This plugin registers no data file, configures no
 * persist handler, and exposes no POST/PATCH/PUT/DELETE route. Native Activity
 * writes arrive in H16.8 on a durable PostgreSQL repository, never here.
 */
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  registerTimelineSource,
  getTimelineSource,
  createAutomationLedgerTimelineSource,
  listStudioTimeline,
  listStudioTimelineForProposal,
  describeStudioTimelineSources,
  getActivityCapabilities,
  TIMELINE_SOURCE_ID,
  TIMELINE_LIMITS,
} from '../src/integrations/index.js'

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
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

function listOf(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function queryToTimelineRequest(q) {
  const limitRaw = q.get('limit')
  return {
    companyId: q.get('companyId') || DEFAULT_COMPANY_ID,
    subjectType: q.get('subjectType') || null,
    subjectId: q.get('subjectId') || null,
    kinds: listOf(q.get('kind')),
    origins: listOf(q.get('origin')),
    audience: q.get('audience') || null,
    since: q.get('since') || null,
    until: q.get('until') || null,
    cursor: q.get('cursor') || null,
    limit: limitRaw ? Number(limitRaw) : TIMELINE_LIMITS.DEFAULT_LIMIT,
  }
}

/**
 * Expose the read-only activity timeline. Registers projection sources once.
 */
export function integrationsActivitiesPlugin() {
  let ready = false

  function ensureSources() {
    if (ready) return
    if (!getTimelineSource(TIMELINE_SOURCE_ID.AUTOMATION_LEDGER)) {
      registerTimelineSource(createAutomationLedgerTimelineSource())
    }
    ready = true
  }

  async function handle(req, res, next) {
    ensureSources()
    const url = req.url || ''

    if (req.method !== 'GET') {
      return next()
    }

    if (matchRoute(url, '/api/activities/capabilities')) {
      try {
        return json(res, 200, { capabilities: getActivityCapabilities() })
      } catch (error) {
        return fail(res, error)
      }
    }

    if (matchRoute(url, '/api/activities/sources')) {
      try {
        const companyId = queryOf(url).get('companyId') || DEFAULT_COMPANY_ID
        return json(res, 200, { sources: describeStudioTimelineSources(companyId) })
      } catch (error) {
        return fail(res, error)
      }
    }

    const proposal = matchRoute(url, '/api/activities/timeline/proposal/:proposalId')
    if (proposal) {
      try {
        const request = queryToTimelineRequest(queryOf(url))
        return json(
          res,
          200,
          listStudioTimelineForProposal(
            request.companyId,
            proposal.proposalId,
            request,
          ),
        )
      } catch (error) {
        return fail(res, error)
      }
    }

    if (matchRoute(url, '/api/activities/timeline')) {
      try {
        return json(res, 200, listStudioTimeline(queryToTimelineRequest(queryOf(url))))
      } catch (error) {
        return fail(res, error)
      }
    }

    return next()
  }

  function attach(server) {
    ensureSources()
    server.middlewares.use((req, res, next) => {
      handle(req, res, next)
    })
  }

  return {
    name: 'proposalforge-integrations-activities',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
