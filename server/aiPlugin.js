import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { describeAiEngine, generateImprovement, loadAiProvider } from '../src/improve/engine.js'
import { generateCoachAdvice } from '../src/coach/ai.js'
import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../src/improve/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ACTIVITY_LIMIT = 400

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

function readBody(req, limit = 1 * 1024 * 1024) {
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
  return path === pattern
}

function publicError() {
  return { message: 'Generation failed.', retryable: true }
}

export function aiPlugin() {
  const root = resolve(__dirname, '..')
  const activityFile = join(root, 'data', 'aiActivity.json')

  function loadActivity() {
    const records = readJson(activityFile, [])
    return Array.isArray(records) ? records : []
  }

  function saveActivity(record) {
    if (!record) return
    const records = [...loadActivity(), record].slice(-ACTIVITY_LIMIT)
    writeJson(activityFile, records)
  }

  async function handle(req, res, next, env) {
    const url = req.url || '/'
    const method = req.method || 'GET'

    try {
      if (method === 'GET' && matchRoute(url, '/api/ai/settings')) {
        const settings = await describeAiEngine(env)
        return json(res, 200, settings)
      }

      if (method === 'GET' && matchRoute(url, '/api/ai/activity')) {
        return json(res, 200, { records: loadActivity().slice(-50).reverse() })
      }

      if (method === 'POST' && matchRoute(url, '/api/ai/coach')) {
        const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const controller = new AbortController()
        const onClose = () => controller.abort()
        req.on('close', onClose)
        try {
          const result = await generateCoachAdvice(payload, env, {
            signal: controller.signal,
            onActivity: saveActivity,
          })
          return json(res, 200, {
            text: result.text,
            activity: result.activity,
            provider: result.provider,
          })
        } catch (error) {
          if (isImproveAbort(error) || controller.signal.aborted) {
            return json(res, 499, publicError())
          }
          const failed = error instanceof ImproveError ? error : null
          const status =
            failed?.code === IMPROVE_ERROR_CODE.INVALID_KEY
              ? 401
              : failed?.code === IMPROVE_ERROR_CODE.RATE_LIMIT
                ? 429
                : 502
          return json(res, status, publicError())
        } finally {
          req.off('close', onClose)
        }
      }

      if (method === 'POST' && matchRoute(url, '/api/ai/improve')) {
        const query = new URL(url, 'http://local').searchParams
        const wantStream = query.get('stream') === '1'
        const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const { provider, settings } = await loadAiProvider(env)
        const stream = wantStream && settings.streaming && provider.supportsStreaming
        const controller = new AbortController()
        const onClose = () => controller.abort()
        req.on('close', onClose)

        try {
          if (!stream) {
            const result = await generateImprovement(payload, env, {
              signal: controller.signal,
              onActivity: saveActivity,
            })
            return json(res, 200, {
              draft: result.draft,
              activity: result.activity,
              provider: result.provider,
            })
          }

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          })

          const result = await generateImprovement(payload, env, {
            signal: controller.signal,
            onActivity: saveActivity,
            onDelta(text) {
              res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
            },
          })

          res.write(
            `data: ${JSON.stringify({
              type: 'done',
              draft: result.draft,
              activity: result.activity,
              provider: result.provider,
            })}\n\n`,
          )
          res.end()
          return
        } catch (error) {
          if (isImproveAbort(error) || controller.signal.aborted) {
            if (!res.headersSent) return json(res, 499, publicError())
            res.write(`data: ${JSON.stringify({ type: 'error', ...publicError() })}\n\n`)
            res.end()
            return
          }
          const failed = error instanceof ImproveError ? error : null
          const status =
            failed?.code === IMPROVE_ERROR_CODE.INVALID_KEY
              ? 401
              : failed?.code === IMPROVE_ERROR_CODE.RATE_LIMIT
                ? 429
                : 502
          if (!res.headersSent) return json(res, status, publicError())
          res.write(`data: ${JSON.stringify({ type: 'error', ...publicError() })}\n\n`)
          res.end()
          return
        } finally {
          req.off('close', onClose)
        }
      }
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : 500)
      return json(res, status, publicError())
    }

    return next()
  }

  function attach(server) {
    mkdirSync(join(root, 'data'), { recursive: true })
    const env = loadEnv(server.config.mode, root, '')
    server.middlewares.use((req, res, next) => handle(req, res, next, env))
  }

  return {
    name: 'proposalforge-ai',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
