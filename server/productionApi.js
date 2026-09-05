import { aiPlugin } from './aiPlugin.js'
import { normalizeApiUrl } from './dataPaths.js'
import { emailPlugin } from './emailPlugin.js'
import { followupPlugin } from './followupPlugin.js'
import { interactionsPlugin } from './interactionsPlugin.js'
import { knowledgePlugin } from './knowledgePlugin.js'
import { localUploadsPlugin } from './localUploadsPlugin.js'
import { portalPlugin } from './portalPlugin.js'
import { workflowPlugin } from './workflowPlugin.js'

let handlers = null

function getHandlers() {
  if (handlers) return handlers
  const plugins = [
    localUploadsPlugin(),
    emailPlugin(),
    aiPlugin(),
    knowledgePlugin(),
    workflowPlugin(),
    portalPlugin(),
    interactionsPlugin(),
    followupPlugin(),
  ]
  handlers = plugins.map((plugin) => plugin.handle)
  return handlers
}

function notFound(res) {
  const payload = JSON.stringify({ message: 'Not found.' })
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
}

/**
 * Production adapter: same Vite plugin handlers, same `/api` contracts.
 * Does not reimplement domain logic.
 */
export async function dispatchProductionApi(req, res) {
  req.url = normalizeApiUrl(req.url)
  const chain = getHandlers()
  let index = 0

  const next = async () => {
    const handle = chain[index]
    index += 1
    if (!handle) {
      notFound(res)
      return
    }
    await handle(req, res, next)
  }

  await next()
}
