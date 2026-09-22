import { mkdirSync } from 'node:fs'
import { isServerlessRuntime, resolveUploadsDir } from './dataPaths.js'
import { deleteBlob, putBlob, readJson, writeJson } from './runtimeStore.js'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

function parseRotateShareTokenIds(req) {
  const raw = req.headers['x-rotate-share-token-ids']
  if (!raw) return new Set()
  return new Set(
    String(raw)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

function preserveLiveShareTokens(incoming, existing, rotateIds) {
  const existingById = new Map(
    (Array.isArray(existing) ? existing : []).map((row) => [row.id, row]),
  )
  return incoming.map((row) => {
    const prev = existingById.get(row.id)
    if (!prev || rotateIds.has(row.id)) return row
    return { ...row, shareToken: prev.shareToken }
  })
}

function safeId(value) {
  return String(value || '')
    .replace(/[^\w.-]+/g, '_')
    .trim()
}

function safeFileName(name) {
  const base = String(name || 'file')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[^\w.\-()+ ]+/g, '_')
    .trim()

  return base || 'file'
}

function kindFromMime(mimeType, name) {
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(name)) return 'document'
  return 'other'
}

function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('File is too large.'), { status: 413 }))
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

/**
 * Persist uploaded files and JSON records through `runtimeStore`.
 * Local Vite: `public/uploads` + `data/*.json`.
 * Vercel: public Blob media + private Blob JSON.
 */
export function localUploadsPlugin() {
  async function loadAssets() {
    const records = await readJson('assets.json', [])
    return Array.isArray(records) ? records : []
  }

  async function saveAssets(records) {
    await writeJson('assets.json', records)
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    const method = req.method || 'GET'

    try {
      if (method === 'GET' && matchRoute(url, '/api/assets')) {
        return json(res, 200, await loadAssets())
      }

      const one = matchRoute(url, '/api/assets/:id')
      if (method === 'GET' && one) {
        const asset = (await loadAssets()).find((entry) => entry.id === one.id)
        if (!asset) return json(res, 404, { message: 'Asset not found.' })
        return json(res, 200, asset)
      }

      if (method === 'POST' && matchRoute(url, '/api/assets')) {
        const name = safeFileName(
          decodeURIComponent(req.headers['x-file-name'] || 'file'),
        )
        const mimeType = String(req.headers['content-type'] || 'application/octet-stream')
        const body = await readBody(req)
        const id = `asset-${crypto.randomUUID()}`
        const stored = await putBlob(`uploads/${id}/${name}`, body, mimeType)

        const now = new Date().toISOString()
        const asset = {
          id,
          name,
          kind: kindFromMime(mimeType, name),
          mimeType,
          sizeBytes: body.length,
          url: stored.url,
          thumbnailUrl: stored.url,
          alt: '',
          caption: '',
          createdAt: now,
          updatedAt: now,
        }

        await saveAssets([...(await loadAssets()), asset])
        return json(res, 201, asset)
      }

      const thumb = matchRoute(url, '/api/assets/:id/thumbnail')
      if (method === 'POST' && thumb) {
        const records = await loadAssets()
        const index = records.findIndex((entry) => entry.id === thumb.id)
        if (index === -1) return json(res, 404, { message: 'Asset not found.' })

        const mimeType = String(req.headers['content-type'] || 'image/jpeg')
        const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/svg+xml' ? '.svg' : '.jpg'
        const body = await readBody(req)
        const fileName = `thumb${ext}`
        const stored = await putBlob(`uploads/${thumb.id}/${fileName}`, body, mimeType)

        const updated = {
          ...records[index],
          thumbnailUrl: stored.url,
          updatedAt: new Date().toISOString(),
        }
        records[index] = updated
        await saveAssets(records)
        return json(res, 200, updated)
      }

      if (method === 'POST' && matchRoute(url, '/api/proposal-files')) {
        const proposalId = safeId(req.headers['x-proposal-id'])
        const uploadId = safeId(req.headers['x-upload-id']) || `upl-${crypto.randomUUID()}`
        if (!proposalId) return json(res, 400, { message: 'A proposal id is required.' })

        const name = safeFileName(
          decodeURIComponent(req.headers['x-file-name'] || 'file'),
        )
        const mimeType = String(req.headers['content-type'] || 'application/octet-stream')
        const body = await readBody(req, 48 * 1024 * 1024)
        const storageKey = `proposals/${proposalId}/${uploadId}/${name}`
        const stored = await putBlob(`uploads/${storageKey}`, body, mimeType)

        return json(res, 201, {
          id: uploadId,
          proposalId,
          name,
          mimeType,
          sizeBytes: body.length,
          storageKey,
          url: stored.url,
        })
      }

      const proposalFile = matchRoute(url, '/api/proposal-files/:id')
      if (method === 'DELETE' && proposalFile) {
        const proposalId = safeId(new URL(url, 'http://local').searchParams.get('proposalId'))
        const uploadId = safeId(proposalFile.id)
        if (!proposalId || !uploadId) return json(res, 400, { message: 'A proposal id is required.' })
        try {
          await deleteBlob(`uploads/proposals/${proposalId}/${uploadId}`)
        } catch (error) {
          if (error?.status === 503) throw error
          /* missing object is fine */
        }
        return json(res, 200, { ok: true })
      }

      if (method === 'GET' && matchRoute(url, '/api/proposals')) {
        const records = await readJson('proposals.json', null)
        return json(res, 200, { records })
      }

      if (method === 'PUT' && matchRoute(url, '/api/proposals')) {
        const body = JSON.parse((await readBody(req, 32 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of proposals.' })
        }
        const existing = await readJson('proposals.json', [])
        const next = preserveLiveShareTokens(
          body,
          existing,
          parseRotateShareTokenIds(req),
        )
        await writeJson('proposals.json', next)
        return json(res, 200, { ok: true, count: next.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/brand-kit')) {
        return json(res, 200, { record: await readJson('brand-kit.json', null) })
      }

      if (method === 'PUT' && matchRoute(url, '/api/brand-kit')) {
        const body = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8') || 'null')
        await writeJson('brand-kit.json', body)
        return json(res, 200, { ok: true })
      }

      if (method === 'GET' && matchRoute(url, '/api/activity-events')) {
        const records = await readJson('activityEvents.json', [])
        return json(res, 200, { records: Array.isArray(records) ? records : [] })
      }

      if (method === 'PUT' && matchRoute(url, '/api/activity-events')) {
        const body = JSON.parse((await readBody(req, 16 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of activity events.' })
        }
        await writeJson('activityEvents.json', body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/notifications')) {
        const records = await readJson('notifications.json', [])
        return json(res, 200, { records: Array.isArray(records) ? records : [] })
      }

      if (method === 'PUT' && matchRoute(url, '/api/notifications')) {
        const body = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of notifications.' })
        }
        await writeJson('notifications.json', body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/templates')) {
        const records = await readJson('templates.json', null)
        return json(res, 200, { records })
      }

      if (method === 'PUT' && matchRoute(url, '/api/templates')) {
        const body = JSON.parse((await readBody(req, 32 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of templates.' })
        }
        await writeJson('templates.json', body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/services')) {
        const records = await readJson('services.json', null)
        return json(res, 200, { records })
      }

      if (method === 'PUT' && matchRoute(url, '/api/services')) {
        const body = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of services.' })
        }
        await writeJson('services.json', body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/library-blocks')) {
        const records = await readJson('library-blocks.json', null)
        return json(res, 200, { records })
      }

      if (method === 'PUT' && matchRoute(url, '/api/library-blocks')) {
        const body = JSON.parse((await readBody(req, 32 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of library blocks.' })
        }
        await writeJson('library-blocks.json', body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/settings')) {
        return json(res, 200, { record: await readJson('settings.json', null) })
      }

      if (method === 'PUT' && matchRoute(url, '/api/settings')) {
        const body = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8') || 'null')
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return json(res, 400, { message: 'Expected a settings object.' })
        }
        await writeJson('settings.json', body)
        return json(res, 200, { ok: true })
      }
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : 500)
      return json(res, status, { message: error.message || 'Upload failed.' })
    }

    return next()
  }

  return {
    name: 'proposalforge-local-uploads',
    configureServer(server) {
      if (!isServerlessRuntime()) {
        mkdirSync(resolveUploadsDir(), { recursive: true })
      }
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      if (!isServerlessRuntime()) {
        mkdirSync(resolveUploadsDir(), { recursive: true })
      }
      server.middlewares.use(handle)
    },
    handle,
  }
}
