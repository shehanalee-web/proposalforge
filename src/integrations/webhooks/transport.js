/**
 * H16.5 — Controlled outbound webhook transport.
 *
 * Live HTTPS requires OUTBOUND_WEBHOOK_NETWORK=1.
 * Tests inject a fake transport — never silently enable production delivery.
 *
 * Residual limitations (H16.9+):
 * - No connect-time DNS pin (validation-time DNS can differ from fetch DNS).
 * - When response.body.getReader is unavailable, response.text() buffers fully
 *   before the size cap is applied.
 */

import { OUTBOUND_WEBHOOK_LIMITS, OUTBOUND_WEBHOOK_NETWORK_ENV } from './types.js'
import { OUTBOUND_WEBHOOK_FAILURE_CODE } from './types.js'

/** @type {null | { post: Function }} */
let transportOverride = null

/**
 * @param {null | { post: Function }} transport
 */
export function setOutboundWebhookTransportForTests(transport) {
  transportOverride = transport && typeof transport.post === 'function' ? transport : null
}

export function clearOutboundWebhookTransportForTests() {
  transportOverride = null
}

export function isOutboundWebhookNetworkEnabled(env = process.env) {
  return String(env?.[OUTBOUND_WEBHOOK_NETWORK_ENV] ?? '') === '1'
}

/**
 * @param {{
 *   status: number,
 *   headers?: Record<string, string>,
 *   bodyText?: string,
 * }} response
 * @param {number} maxBytes
 */
export function truncateOutboundWebhookResponseBody(response, maxBytes = OUTBOUND_WEBHOOK_LIMITS.MAX_RESPONSE_BODY_BYTES) {
  const text = response?.bodyText == null ? '' : String(response.bodyText)
  const buf = Buffer.from(text, 'utf8')
  if (buf.byteLength <= maxBytes) {
    return { bodyText: text, truncated: false, byteLength: buf.byteLength }
  }
  return {
    bodyText: buf.subarray(0, maxBytes).toString('utf8'),
    truncated: true,
    byteLength: buf.byteLength,
  }
}

/**
 * Fake/mock transport for verification — no real sockets.
 *
 * @param {(request: object) => Promise<object> | object} handler
 */
export function createFakeOutboundWebhookTransport(handler) {
  return {
    kind: 'fake',
    async post(request) {
      return handler(request)
    },
  }
}

async function readResponseLimited(response, maxBytes) {
  const reader = response.body?.getReader?.()
  if (!reader) {
    const text = await response.text()
    const buf = Buffer.from(text, 'utf8')
    if (buf.byteLength > maxBytes) {
      return {
        tooLarge: true,
        bodyText: buf.subarray(0, maxBytes).toString('utf8'),
        byteLength: buf.byteLength,
      }
    }
    return { tooLarge: false, bodyText: text, byteLength: buf.byteLength }
  }

  const chunks = []
  let size = 0
  let tooLarge = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value)
    size += chunk.byteLength
    if (size > maxBytes) {
      tooLarge = true
      const remaining = maxBytes - Buffer.concat(chunks).byteLength
      if (remaining > 0) chunks.push(chunk.subarray(0, remaining))
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
      break
    }
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks)
  return {
    tooLarge,
    bodyText: body.toString('utf8'),
    byteLength: tooLarge ? size : body.byteLength,
  }
}

function classifyFetchError(error) {
  const name = String(error?.name ?? '')
  const message = String(error?.message ?? '')
  if (name === 'AbortError' || /aborted|timeout|timed out/i.test(message)) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.TIMEOUT,
      message: 'Outbound webhook request timed out.',
    }
  }
  if (/redirect/i.test(message)) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.REDIRECT_REJECTED,
      message: 'Outbound webhook redirects are not allowed.',
    }
  }
  if (/certificate|ssl|tls|CERT/i.test(message)) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.TLS_FAILURE,
      message: 'Outbound webhook TLS failed.',
    }
  }
  return {
    ok: false,
    failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_FAILURE,
    message: 'Outbound webhook network failure.',
  }
}

/**
 * Live HTTPS transport. Guarded by OUTBOUND_WEBHOOK_NETWORK=1 at execute layer.
 */
export function createLiveOutboundWebhookTransport() {
  return {
    kind: 'live',
    async post(request) {
      const timeoutMs = Number(request.timeoutMs) || OUTBOUND_WEBHOOK_LIMITS.DEFAULT_TIMEOUT_MS
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(request.url, {
          method: 'POST',
          headers: request.headers,
          body: request.body,
          redirect: 'error',
          signal: controller.signal,
        })
        const limited = await readResponseLimited(
          response,
          OUTBOUND_WEBHOOK_LIMITS.MAX_RESPONSE_BODY_BYTES,
        )
        return {
          ok: true,
          status: response.status,
          bodyText: limited.bodyText,
          tooLarge: limited.tooLarge,
          byteLength: limited.byteLength,
        }
      } catch (error) {
        return classifyFetchError(error)
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

/**
 * Resolve active transport: test override → live (if enabled) → none.
 */
export function getOutboundWebhookTransport() {
  if (transportOverride) return transportOverride
  if (isOutboundWebhookNetworkEnabled()) return createLiveOutboundWebhookTransport()
  return null
}
