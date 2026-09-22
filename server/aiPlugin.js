import { projectRoot } from './dataPaths.js'
import {
  endJsonResponse,
  flushAndNext,
  flushRuntimeWrites,
  readJson,
  trackRuntimeOperation,
  writeJson,
} from './runtimeStore.js'
import { describeAiEngine, generateImprovement, loadAiProvider } from '../src/improve/engine.js'
import { generateCoachAdvice } from '../src/coach/ai.js'
import { generateProposal } from '../src/generate/ai.js'
import { ImproveError, IMPROVE_ERROR_CODE, isImproveAbort } from '../src/improve/errors.js'

const ACTIVITY_LIMIT = 400

function json(res, status, body) {
  return endJsonResponse(res, status, body)
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

async function endSse(res, payload) {
  try {
    await flushRuntimeWrites()
  } catch (error) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        message: error.message || 'Could not persist.',
      })}\n\n`,
    )
    res.end()
    return
  }
  if (payload) res.write(payload)
  res.end()
}

export function aiPlugin() {
  const root = projectRoot()

  async function loadActivity() {
    const records = await readJson('aiActivity.json', [])
    return Array.isArray(records) ? records : []
  }

  function saveActivity(record) {
    if (!record) return undefined
    return trackRuntimeOperation(async () => {
      const records = [...(await loadActivity()), record].slice(-ACTIVITY_LIMIT)
      await writeJson('aiActivity.json', records)
    })
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
        return json(res, 200, { records: (await loadActivity()).slice(-50).reverse() })
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

      if (method === 'POST' && matchRoute(url, '/api/ai/generate-proposal')) {
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
            const result = await generateProposal(payload, env, {
              signal: controller.signal,
              onActivity: saveActivity,
            })
            return json(res, 200, result)
          }

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          })

          const result = await generateProposal(payload, env, {
            signal: controller.signal,
            onActivity: saveActivity,
            onStatus(status) {
              res.write(`data: ${JSON.stringify({ type: 'status', status })}\n\n`)
            },
            onDelta(text) {
              res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
            },
          })

          await endSse(res, `data: ${JSON.stringify({ type: 'done', result })}\n\n`)
          return
        } catch (error) {
          if (isImproveAbort(error) || controller.signal.aborted) {
            if (!res.headersSent) return json(res, 499, publicError())
            await endSse(res, `data: ${JSON.stringify({ type: 'error', ...publicError() })}\n\n`)
            return
          }
          const failed = error instanceof ImproveError ? error : null
          const status =
            error?.name === 'ValidationError'
              ? 400
              : failed?.code === IMPROVE_ERROR_CODE.INVALID_KEY
                ? 401
                : failed?.code === IMPROVE_ERROR_CODE.RATE_LIMIT
                  ? 429
                  : 502
          if (!res.headersSent) {
            if (error?.name === 'ValidationError') {
              return json(res, 400, {
                message: error.message || 'Generation setup is incomplete.',
                retryable: false,
                errors: error.errors ?? [],
              })
            }
            return json(res, status, publicError())
          }
          await endSse(res, `data: ${JSON.stringify({ type: 'error', ...publicError() })}\n\n`)
          return
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

          await endSse(
            res,
            `data: ${JSON.stringify({
              type: 'done',
              draft: result.draft,
              activity: result.activity,
              provider: result.provider,
            })}\n\n`,
          )
          return
        } catch (error) {
          if (isImproveAbort(error) || controller.signal.aborted) {
            if (!res.headersSent) return json(res, 499, publicError())
            await endSse(res, `data: ${JSON.stringify({ type: 'error', ...publicError() })}\n\n`)
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
          await endSse(res, `data: ${JSON.stringify({ type: 'error', ...publicError() })}\n\n`)
          return
        } finally {
          req.off('close', onClose)
        }
      }
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : 500)
      return json(res, status, publicError())
    }

    return flushAndNext(next)
  }

  function attach(server) {
    server.middlewares.use((req, res, next) => {
      import('vite')
        .then(({ loadEnv }) => handle(req, res, next, loadEnv(server.config.mode, root, '')))
        .catch(next)
    })
  }

  return {
    name: 'proposalforge-ai',
    configureServer: attach,
    configurePreviewServer: attach,
    handle: (req, res, next) => handle(req, res, next, process.env),
  }
}
