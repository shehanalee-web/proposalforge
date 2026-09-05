import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import {
  addComment,
  approve,
  assignOwner,
  assignReviewer,
  assignSupporting,
  createTask,
  createTaskFromFinding,
  deleteComment,
  getCompanyWorkflowOverview,
  getWorkflow,
  getWorkflowSummary,
  listWorkflows,
  removeReviewer,
  reopenComment,
  requestChanges,
  resolveComment,
  transitionWorkflow,
  updateTask,
  WORKFLOW_CAPABILITIES,
} from '../src/workflow/index.js'
import {
  allWorkflowRecords,
  configureWorkflowStore,
  replaceWorkflowRecords,
} from '../src/workflow/store.js'
import { DEFAULT_ACTOR_ID } from '../src/workflow/actors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'

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
  return json(res, status, { message: error.message || 'Workflow request failed.' })
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
 * Persist proposal workflow to `data/workflow.json`.
 * Never writes `data/proposals.json`.
 */
export function workflowPlugin() {
  const workflowFile = join(ensureRuntimeData(), 'workflow.json')
  let ready = false

  function persist(records) {
    writeJson(workflowFile, records)
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(workflowFile, null)
    if (Array.isArray(stored)) {
      replaceWorkflowRecords(stored)
    } else {
      replaceWorkflowRecords([])
      persist(allWorkflowRecords())
    }
    configureWorkflowStore({ persist })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/workflow')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (method === 'GET' && matchRoute(url, '/api/workflow/capabilities')) {
        return json(res, 200, { capabilities: WORKFLOW_CAPABILITIES })
      }

      if (method === 'GET' && matchRoute(url, '/api/workflow/overview')) {
        const query = queryOf(url)
        return json(res, 200, {
          overview: getCompanyWorkflowOverview({ companyId: companyFrom(null, query) }),
        })
      }

      if (method === 'GET' && matchRoute(url, '/api/workflow')) {
        const query = queryOf(url)
        const ids = query.get('proposalIds')
        return json(res, 200, {
          workflows: listWorkflows({
            companyId: companyFrom(null, query),
            proposalIds: ids ? ids.split(',').filter(Boolean) : undefined,
          }),
        })
      }

      const one = matchRoute(url, '/api/workflow/:proposalId')
      if (method === 'GET' && one) {
        const query = queryOf(url)
        const workflow = getWorkflow({
          companyId: companyFrom(null, query),
          proposalId: one.proposalId,
          actor: actorFrom(null, query),
        })
        return json(res, 200, { workflow })
      }

      const summary = matchRoute(url, '/api/workflow/:proposalId/summary')
      if (method === 'GET' && summary) {
        const query = queryOf(url)
        const workflow = getWorkflow({
          companyId: companyFrom(null, query),
          proposalId: summary.proposalId,
          actor: actorFrom(null, query),
        })
        return json(res, 200, {
          summary: getWorkflowSummary({ workflow }),
        })
      }

      const transition = matchRoute(url, '/api/workflow/:proposalId/transition')
      if (method === 'POST' && transition) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          workflow: transitionWorkflow({
            companyId: companyFrom(body),
            proposalId: transition.proposalId,
            actor: actorFrom(body),
            to: body.to,
            note: body.note,
          }),
        })
      }

      const comments = matchRoute(url, '/api/workflow/:proposalId/comments')
      if (method === 'POST' && comments) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const result = addComment({
          companyId: companyFrom(body),
          proposalId: comments.proposalId,
          actor: actorFrom(body),
          body: body.body,
          blockId: body.blockId,
        })
        return json(res, 201, result)
      }

      const comment = matchRoute(url, '/api/workflow/:proposalId/comments/:commentId')
      if (method === 'PATCH' && comment) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const input = {
          companyId: companyFrom(body),
          proposalId: comment.proposalId,
          actor: actorFrom(body),
          commentId: comment.commentId,
        }
        const action = body.action
        const workflow =
          action === 'reopen'
            ? reopenComment(input)
            : action === 'delete'
              ? deleteComment(input)
              : resolveComment(input)
        return json(res, 200, { workflow })
      }

      const tasks = matchRoute(url, '/api/workflow/:proposalId/tasks')
      if (method === 'POST' && tasks) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const input = {
          companyId: companyFrom(body),
          proposalId: tasks.proposalId,
          actor: actorFrom(body),
        }
        const result = body.finding
          ? createTaskFromFinding({ ...input, finding: body.finding, source: body.source })
          : createTask({ ...input, ...body })
        return json(res, 201, result)
      }

      const task = matchRoute(url, '/api/workflow/:proposalId/tasks/:taskId')
      if (method === 'PATCH' && task) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          workflow: updateTask({
            companyId: companyFrom(body),
            proposalId: task.proposalId,
            actor: actorFrom(body),
            taskId: task.taskId,
            changes: body.changes ?? body,
          }),
        })
      }

      const assign = matchRoute(url, '/api/workflow/:proposalId/assign')
      if (method === 'POST' && assign) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const input = {
          companyId: companyFrom(body),
          proposalId: assign.proposalId,
          actor: actorFrom(body),
        }
        let workflow
        if (body.removeReviewerId) {
          workflow = removeReviewer({ ...input, reviewerId: body.removeReviewerId })
        } else if (body.reviewerId) {
          workflow = assignReviewer({ ...input, reviewerId: body.reviewerId })
        } else if (body.assigneeId) {
          workflow = assignSupporting({ ...input, assigneeId: body.assigneeId })
        } else {
          workflow = assignOwner({ ...input, ownerId: body.ownerId })
        }
        return json(res, 200, { workflow })
      }

      const approvals = matchRoute(url, '/api/workflow/:proposalId/approvals')
      if (method === 'POST' && approvals) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const input = {
          companyId: companyFrom(body),
          proposalId: approvals.proposalId,
          actor: actorFrom(body),
          note: body.note,
          blockId: body.blockId,
        }
        const workflow =
          body.action === 'request_changes' ? requestChanges(input) : approve(input)
        return json(res, 200, { workflow })
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
    name: 'proposalforge-workflow',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
