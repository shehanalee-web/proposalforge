import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ensureRuntimeData } from './dataPaths.js'
import { NotFoundError, ValidationError } from '../src/services/errors.js'
import {
  approveKnowledgeItem,
  archiveKnowledgeItem,
  buildKnowledgeContext,
  createKnowledgeItem,
  deleteKnowledgeItem,
  findPossibleDuplicates,
  getCompanyKnowledge,
  getCompanyKnowledgeItem,
  getKnowledgeContext,
  KNOWLEDGE_CAPABILITIES,
  recordKnowledgeUsage,
  restoreKnowledgeItem,
  saveProposalContentAsKnowledge,
  searchCompanyKnowledge,
  summarizeCompanyKnowledge,
  updateKnowledgeItem,
} from '../src/knowledge/index.js'
import {
  allKnowledgeRecords,
  configureKnowledgeStore,
  replaceKnowledgeRecords,
  seedKnowledgeRecords,
} from '../src/knowledge/store.js'

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
  if (error instanceof NotFoundError) {
    return json(res, 404, { message: error.message })
  }
  const status = error.status ?? 500
  return json(res, status, { message: error.message || 'Knowledge request failed.' })
}

/**
 * Persist company knowledge to `data/knowledge.json`.
 * Never writes `data/proposals.json`.
 */
export function knowledgePlugin() {
  const knowledgeFile = join(ensureRuntimeData(), 'knowledge.json')
  let ready = false

  function persist(records) {
    writeJson(knowledgeFile, records)
  }

  function ensureStore() {
    if (ready) return
    const stored = readJson(knowledgeFile, null)
    if (Array.isArray(stored) && stored.length > 0) {
      replaceKnowledgeRecords(stored)
    } else {
      seedKnowledgeRecords()
      persist(allKnowledgeRecords())
    }
    configureKnowledgeStore({ persist })
    ready = true
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    if (!url.startsWith('/api/knowledge')) return next()

    const method = req.method || 'GET'
    ensureStore()

    try {
      if (method === 'GET' && matchRoute(url, '/api/knowledge/capabilities')) {
        return json(res, 200, { capabilities: KNOWLEDGE_CAPABILITIES })
      }

      if (method === 'GET' && matchRoute(url, '/api/knowledge/summary')) {
        const companyId = queryOf(url).get('companyId')
        return json(res, 200, summarizeCompanyKnowledge({ companyId }))
      }

      if (method === 'GET' && matchRoute(url, '/api/knowledge/context')) {
        const params = queryOf(url)
        return json(
          res,
          200,
          getKnowledgeContext({
            companyId: params.get('companyId'),
            query: params.get('query') || '',
            category: params.get('category') || '',
            proposalType: params.get('proposalType') || '',
            industry: params.get('industry') || '',
            limit: params.get('limit'),
          }),
        )
      }

      const one = matchRoute(url, '/api/knowledge/item/:id')
      if (method === 'GET' && one) {
        const companyId = queryOf(url).get('companyId')
        return json(res, 200, { record: getCompanyKnowledgeItem({ companyId, id: one.id }) })
      }

      if (method === 'GET' && matchRoute(url, '/api/knowledge')) {
        const params = queryOf(url)
        const categories = params.get('categories')
        return json(res, 200, {
          records: getCompanyKnowledge({
            companyId: params.get('companyId'),
            query: params.get('query') || '',
            categories: categories ? categories.split(',') : undefined,
            status: params.get('status') || undefined,
            includeArchived: params.get('includeArchived') === 'true',
            limit: params.get('limit'),
          }),
        })
      }

      if (method === 'POST' && matchRoute(url, '/api/knowledge/search')) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, { records: searchCompanyKnowledge(body) })
      }

      if (method === 'POST' && matchRoute(url, '/api/knowledge/context')) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, buildKnowledgeContext(body))
      }

      if (method === 'POST' && matchRoute(url, '/api/knowledge/duplicates')) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, { records: findPossibleDuplicates(body) })
      }

      if (method === 'POST' && matchRoute(url, '/api/knowledge/from-proposal')) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 201, { record: saveProposalContentAsKnowledge(body) })
      }

      if (method === 'POST' && matchRoute(url, '/api/knowledge')) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 201, { record: createKnowledgeItem(body) })
      }

      const approve = matchRoute(url, '/api/knowledge/item/:id/approve')
      if (method === 'POST' && approve) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          record: approveKnowledgeItem({
            companyId: body.companyId,
            id: approve.id,
            approvedBy: body.approvedBy,
          }),
        })
      }

      const archive = matchRoute(url, '/api/knowledge/item/:id/archive')
      if (method === 'POST' && archive) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          record: archiveKnowledgeItem({ companyId: body.companyId, id: archive.id }),
        })
      }

      const restore = matchRoute(url, '/api/knowledge/item/:id/restore')
      if (method === 'POST' && restore) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          record: restoreKnowledgeItem({ companyId: body.companyId, id: restore.id }),
        })
      }

      const usage = matchRoute(url, '/api/knowledge/item/:id/usage')
      if (method === 'POST' && usage) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          record: recordKnowledgeUsage({
            companyId: body.companyId,
            id: usage.id,
            proposalId: body.proposalId,
          }),
        })
      }

      if (method === 'PATCH' && one) {
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        return json(res, 200, {
          record: updateKnowledgeItem({
            companyId: body.companyId,
            id: one.id,
            changes: body.changes ?? body,
          }),
        })
      }

      if (method === 'DELETE' && one) {
        const params = queryOf(url)
        let scoped = params.get('companyId')
        if (!scoped) {
          const parsed = JSON.parse((await readBody(req)).toString('utf8') || '{}')
          scoped = parsed.companyId
        }
        return json(res, 200, deleteKnowledgeItem({ companyId: scoped, id: one.id }))
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
    name: 'proposalforge-knowledge',
    configureServer: attach,
    configurePreviewServer: attach,
    handle,
  }
}
