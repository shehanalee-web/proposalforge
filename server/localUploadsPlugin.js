import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const __dirname = dirname(fileURLToPath(import.meta.url))

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
 * Persist uploaded files under `public/uploads` and JSON records under `data/`.
 * Vite serves `/uploads/...` as stable public URLs across refresh and restart.
 */
export function localUploadsPlugin() {
  const root = resolve(__dirname, '..')
  const uploadsDir = join(root, 'public', 'uploads')
  const dataDir = join(root, 'data')
  const assetsFile = join(dataDir, 'assets.json')
  const proposalsFile = join(dataDir, 'proposals.json')
  const brandKitFile = join(dataDir, 'brand-kit.json')
  const activityEventsFile = join(dataDir, 'activityEvents.json')
  const notificationsFile = join(dataDir, 'notifications.json')

  function loadAssets() {
    const records = readJson(assetsFile, [])
    return Array.isArray(records) ? records : []
  }

  function saveAssets(records) {
    writeJson(assetsFile, records)
  }

  async function handle(req, res, next) {
    const url = req.url || '/'
    const method = req.method || 'GET'

    try {
      if (method === 'GET' && matchRoute(url, '/api/assets')) {
        return json(res, 200, loadAssets())
      }

      const one = matchRoute(url, '/api/assets/:id')
      if (method === 'GET' && one) {
        const asset = loadAssets().find((entry) => entry.id === one.id)
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
        const folder = join(uploadsDir, id)
        mkdirSync(folder, { recursive: true })
        const filePath = join(folder, name)
        await pipeline(Readable.from(body), createWriteStream(filePath))

        const now = new Date().toISOString()
        const publicPath = `/uploads/${id}/${name}`
        const asset = {
          id,
          name,
          kind: kindFromMime(mimeType, name),
          mimeType,
          sizeBytes: body.length,
          url: publicPath,
          thumbnailUrl: publicPath,
          alt: '',
          caption: '',
          createdAt: now,
          updatedAt: now,
        }

        saveAssets([...loadAssets(), asset])
        return json(res, 201, asset)
      }

      const thumb = matchRoute(url, '/api/assets/:id/thumbnail')
      if (method === 'POST' && thumb) {
        const records = loadAssets()
        const index = records.findIndex((entry) => entry.id === thumb.id)
        if (index === -1) return json(res, 404, { message: 'Asset not found.' })

        const mimeType = String(req.headers['content-type'] || 'image/jpeg')
        const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/svg+xml' ? '.svg' : '.jpg'
        const body = await readBody(req)
        const folder = join(uploadsDir, thumb.id)
        mkdirSync(folder, { recursive: true })
        const fileName = `thumb${ext}`
        await pipeline(Readable.from(body), createWriteStream(join(folder, fileName)))

        const thumbnailUrl = `/uploads/${thumb.id}/${fileName}`
        const updated = {
          ...records[index],
          thumbnailUrl,
          updatedAt: new Date().toISOString(),
        }
        records[index] = updated
        saveAssets(records)
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
        const folder = join(uploadsDir, 'proposals', proposalId, uploadId)
        mkdirSync(folder, { recursive: true })
        await pipeline(Readable.from(body), createWriteStream(join(folder, name)))

        const publicPath = `/uploads/proposals/${proposalId}/${uploadId}/${name}`
        return json(res, 201, {
          id: uploadId,
          proposalId,
          name,
          mimeType,
          sizeBytes: body.length,
          storageKey: `proposals/${proposalId}/${uploadId}/${name}`,
          url: publicPath,
        })
      }

      const proposalFile = matchRoute(url, '/api/proposal-files/:id')
      if (method === 'DELETE' && proposalFile) {
        const proposalId = safeId(new URL(url, 'http://local').searchParams.get('proposalId'))
        const uploadId = safeId(proposalFile.id)
        if (!proposalId || !uploadId) return json(res, 400, { message: 'A proposal id is required.' })
        const folder = join(uploadsDir, 'proposals', proposalId, uploadId)
        try {
          rmSync(folder, { recursive: true, force: true })
        } catch {
          /* missing folder is fine */
        }
        return json(res, 200, { ok: true })
      }

      if (method === 'GET' && matchRoute(url, '/api/proposals')) {
        const records = readJson(proposalsFile, null)
        return json(res, 200, { records })
      }

      if (method === 'PUT' && matchRoute(url, '/api/proposals')) {
        const body = JSON.parse((await readBody(req, 32 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of proposals.' })
        }
        writeJson(proposalsFile, body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/brand-kit')) {
        return json(res, 200, { record: readJson(brandKitFile, null) })
      }

      if (method === 'PUT' && matchRoute(url, '/api/brand-kit')) {
        const body = JSON.parse((await readBody(req, 4 * 1024 * 1024)).toString('utf8') || 'null')
        writeJson(brandKitFile, body)
        return json(res, 200, { ok: true })
      }

      if (method === 'GET' && matchRoute(url, '/api/activity-events')) {
        const records = readJson(activityEventsFile, [])
        return json(res, 200, { records: Array.isArray(records) ? records : [] })
      }

      if (method === 'PUT' && matchRoute(url, '/api/activity-events')) {
        const body = JSON.parse((await readBody(req, 16 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of activity events.' })
        }
        writeJson(activityEventsFile, body)
        return json(res, 200, { ok: true, count: body.length })
      }

      if (method === 'GET' && matchRoute(url, '/api/notifications')) {
        const records = readJson(notificationsFile, [])
        return json(res, 200, { records: Array.isArray(records) ? records : [] })
      }

      if (method === 'PUT' && matchRoute(url, '/api/notifications')) {
        const body = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8') || 'null')
        if (!Array.isArray(body)) {
          return json(res, 400, { message: 'Expected an array of notifications.' })
        }
        writeJson(notificationsFile, body)
        return json(res, 200, { ok: true, count: body.length })
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
      mkdirSync(uploadsDir, { recursive: true })
      mkdirSync(dataDir, { recursive: true })
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      mkdirSync(uploadsDir, { recursive: true })
      mkdirSync(dataDir, { recursive: true })
      server.middlewares.use(handle)
    },
  }
}
