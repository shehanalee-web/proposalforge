/**
 * H16.5 — Server-only secret reference resolution.
 *
 * Resolves env:/vault:/secretref: at send time only.
 * Never persists resolved values. Never projects to clients.
 */

import { OUTBOUND_WEBHOOK_FAILURE_CODE } from './types.js'

/** @type {Map<string, string>} */
const testSecretBag = new Map()

/**
 * Test seam for vault:/secretref: and env overrides.
 *
 * @param {Record<string, string> | Map<string, string> | null} bag
 */
export function setOutboundWebhookTestSecrets(bag) {
  testSecretBag.clear()
  if (!bag) return
  const entries = bag instanceof Map ? bag.entries() : Object.entries(bag)
  for (const [key, value] of entries) {
    const ref = String(key ?? '').trim()
    const secret = value == null ? '' : String(value)
    if (ref && secret) testSecretBag.set(ref, secret)
  }
}

export function clearOutboundWebhookTestSecrets() {
  testSecretBag.clear()
}

/**
 * @param {string} ref
 * @returns {{ ok: true, secret: string } | { ok: false, failureCode: string, message: string }}
 */
export function resolveOutboundWebhookSecretRef(ref) {
  const normalized = String(ref ?? '').trim()
  if (!normalized) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.AUTH_OR_SIGNATURE_FAILURE,
      message: 'Missing signing secret reference.',
    }
  }

  if (testSecretBag.has(normalized)) {
    return { ok: true, secret: testSecretBag.get(normalized) }
  }

  if (normalized.startsWith('env:')) {
    const name = normalized.slice(4)
    const value = process.env[name]
    if (value == null || value === '') {
      return {
        ok: false,
        failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.AUTH_OR_SIGNATURE_FAILURE,
        message: 'Signing secret environment value is unavailable.',
      }
    }
    return { ok: true, secret: String(value) }
  }

  if (normalized.startsWith('vault:') || normalized.startsWith('secretref:')) {
    return {
      ok: false,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.AUTH_OR_SIGNATURE_FAILURE,
      message: 'Signing secret reference could not be resolved.',
    }
  }

  return {
    ok: false,
    failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.AUTH_OR_SIGNATURE_FAILURE,
    message: 'Invalid signing secret reference.',
  }
}
