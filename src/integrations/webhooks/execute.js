/**
 * H16.5 — Synchronous outbound webhook execution.
 *
 * Consumes recorded H16.4 intents. Does not mutate intent status.
 * Application-level duplicate suppression by intent.id — not network exactly-once.
 * No workers, outbox, or retry scheduler.
 */

import { INTEGRATION_CAPABILITIES, INTEGRATION_KIND } from '../types.js'
import { getAutomationActionIntentForCompany } from '../intents/store.js'
import { AUTOMATION_ACTION_INTENT_STATUS } from '../intents/types.js'
import { getOutboundWebhookDestinationForCompany } from './destinations.js'
import {
  buildOutboundWebhookEnvelope,
  serializeOutboundWebhookEnvelope,
} from './envelope.js'
import { buildOutboundWebhookSignatureHeaders } from './sign.js'
import { resolveOutboundWebhookSecretRef } from './secrets.js'
import { validateOutboundWebhookUrl } from './ssrf.js'
import {
  getOutboundWebhookTransport,
  isOutboundWebhookNetworkEnabled,
  truncateOutboundWebhookResponseBody,
} from './transport.js'
import {
  findOutboundWebhookOutcomeByIntentId,
  recordOutboundWebhookOutcome,
} from './outcomes.js'
import {
  OUTBOUND_WEBHOOK_FAILURE_CODE,
  OUTBOUND_WEBHOOK_LIMITS,
  OUTBOUND_WEBHOOK_OUTCOME_STATUS,
} from './types.js'
import { NotFoundError } from '../../services/errors.js'

/** @type {boolean | null} */
let capabilityOverride = null

/**
 * Test-only capability override (does not mutate frozen INTEGRATION_CAPABILITIES).
 * @param {boolean | null} value
 */
export function setOutboundWebhooksCapabilityOverrideForTests(value) {
  capabilityOverride = typeof value === 'boolean' ? value : null
}

function outboundWebhooksCapable() {
  if (capabilityOverride != null) return capabilityOverride
  return INTEGRATION_CAPABILITIES.outboundWebhooks === true
}

function sanitizeErrorMessage(message) {
  return String(message ?? '')
    .replace(/(env|vault|secretref):[A-Za-z0-9_./:-]+/gi, '[ref]')
    .replace(/v1=[a-f0-9]+/gi, 'v1=[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, OUTBOUND_WEBHOOK_LIMITS.MAX_ERROR)
}

function persistOutcome(input) {
  return recordOutboundWebhookOutcome({
    ...input,
    truncatedError: input.truncatedError
      ? sanitizeErrorMessage(input.truncatedError)
      : null,
    attemptNumber: 1,
    completedAt: new Date().toISOString(),
  }).outcome
}

function rejectOutcome({
  companyId,
  intentId,
  destinationId,
  failureCode,
  message,
  retryable = false,
}) {
  return {
    ok: false,
    duplicate: false,
    outcome: persistOutcome({
      companyId,
      intentId,
      destinationId: destinationId ?? null,
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.REJECTED,
      idempotencyKey: intentId,
      httpStatus: null,
      failureCode,
      retryable,
      truncatedError: message,
    }),
  }
}

function classifyHttpStatus(status) {
  if (status >= 200 && status < 300) {
    return {
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.SUCCEEDED,
      failureCode: null,
      retryable: false,
    }
  }
  if (status >= 300 && status < 400) {
    return {
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.HTTP_3XX,
      retryable: false,
    }
  }
  if (status >= 400 && status < 500) {
    return {
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.HTTP_4XX,
      retryable: false,
    }
  }
  if (status >= 500 && status < 600) {
    return {
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.HTTP_5XX,
      retryable: true,
    }
  }
  return {
    status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
    failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_FAILURE,
    retryable: true,
  }
}

/**
 * Execute outbound webhook delivery for a recorded intent.
 *
 * @param {{ companyId: string, intentId: string, allowHttp?: boolean }} input
 */
export async function executeOutboundWebhookForIntent(input = {}) {
  const companyId = String(input.companyId ?? '').trim()
  const intentId = String(input.intentId ?? '').trim()

  if (!companyId || !intentId) {
    throw new NotFoundError('Outbound webhook execution requires companyId and intentId.')
  }

  // Application-level idempotency: one terminal outcome per intent.id.
  // Crash-after-send-before-record can still duplicate at the network layer.
  const existing = findOutboundWebhookOutcomeByIntentId(intentId)
  if (existing) {
    if (existing.companyId !== companyId) {
      throw new NotFoundError('Outbound webhook outcome not found for company.')
    }
    return { ok: existing.status === OUTBOUND_WEBHOOK_OUTCOME_STATUS.SUCCEEDED, duplicate: true, outcome: existing }
  }

  if (!outboundWebhooksCapable()) {
    return rejectOutcome({
      companyId,
      intentId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.CAPABILITY_DISABLED,
      message: 'Outbound webhooks capability is disabled.',
    })
  }

  let intent
  try {
    intent = getAutomationActionIntentForCompany(companyId, intentId)
  } catch (error) {
    if (error instanceof NotFoundError) throw error
    return rejectOutcome({
      companyId,
      intentId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Automation action intent is unavailable.',
    })
  }

  if (intent.kind !== INTEGRATION_KIND.OUTBOUND_WEBHOOK) {
    return rejectOutcome({
      companyId,
      intentId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Intent kind is not outboundWebhook.',
    })
  }

  if (intent.status === AUTOMATION_ACTION_INTENT_STATUS.CANCELLED) {
    return rejectOutcome({
      companyId,
      intentId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INTENT_CANCELLED,
      message: 'Cancelled intents cannot be delivered.',
    })
  }

  const destinationId = String(intent.payload?.destinationId ?? '').trim()
  if (!destinationId) {
    return rejectOutcome({
      companyId,
      intentId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Intent payload requires destinationId.',
    })
  }

  let destination
  try {
    destination = getOutboundWebhookDestinationForCompany(companyId, destinationId)
  } catch {
    return rejectOutcome({
      companyId,
      intentId,
      destinationId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INVALID_DESTINATION,
      message: 'Webhook destination was not found for this company.',
    })
  }

  if (!destination.enabled) {
    return rejectOutcome({
      companyId,
      intentId,
      destinationId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.DESTINATION_DISABLED,
      message: 'Webhook destination is disabled.',
    })
  }

  const transport = getOutboundWebhookTransport()
  const networkEnabled = isOutboundWebhookNetworkEnabled()
  const usingFake = Boolean(transport && transport.kind === 'fake')
  if (!transport || (!networkEnabled && !usingFake)) {
    return rejectOutcome({
      companyId,
      intentId,
      destinationId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_DISABLED,
      message: 'Outbound webhook network delivery is disabled.',
      retryable: true,
    })
  }

  const allowHttp = usingFake && input.allowHttp === true
  const urlCheck = await validateOutboundWebhookUrl(destination.endpointUrl, {
    allowHttp,
  })
  if (!urlCheck.ok) {
    return rejectOutcome({
      companyId,
      intentId,
      destinationId,
      failureCode: urlCheck.failureCode,
      message: urlCheck.message,
    })
  }

  const envelope = buildOutboundWebhookEnvelope(intent)
  const rawBody = serializeOutboundWebhookEnvelope(envelope)
  const bodyBytes = Buffer.byteLength(rawBody, 'utf8')
  if (bodyBytes > OUTBOUND_WEBHOOK_LIMITS.MAX_REQUEST_BODY_BYTES) {
    return rejectOutcome({
      companyId,
      intentId,
      destinationId,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.INVALID_CONFIGURATION,
      message: 'Webhook request body exceeds size limit.',
    })
  }

  const secretResult = resolveOutboundWebhookSecretRef(destination.signingSecretRef)
  if (!secretResult.ok) {
    return rejectOutcome({
      companyId,
      intentId,
      destinationId,
      failureCode: secretResult.failureCode,
      message: secretResult.message,
    })
  }

  const signatureHeaders = buildOutboundWebhookSignatureHeaders({
    rawBody,
    secret: secretResult.secret,
    idempotencyKey: intent.id,
  })

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...destination.headers,
    ...signatureHeaders,
  }

  let response
  try {
    response = await transport.post({
      url: urlCheck.url || destination.endpointUrl,
      headers,
      body: rawBody,
      timeoutMs: destination.timeoutMs,
      redirect: 'error',
    })
  } catch {
    const outcome = persistOutcome({
      companyId,
      intentId,
      destinationId,
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      idempotencyKey: intent.id,
      httpStatus: null,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_FAILURE,
      retryable: true,
      truncatedError: 'Outbound webhook transport failed.',
    })
    return { ok: false, duplicate: false, outcome }
  }

  if (response?.ok === false && response.failureCode) {
    const outcome = persistOutcome({
      companyId,
      intentId,
      destinationId,
      status:
        response.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.REDIRECT_REJECTED
          ? OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED
          : OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      idempotencyKey: intent.id,
      httpStatus: null,
      failureCode: response.failureCode,
      retryable:
        response.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.TIMEOUT ||
        response.failureCode === OUTBOUND_WEBHOOK_FAILURE_CODE.NETWORK_FAILURE,
      truncatedError: response.message || 'Outbound webhook request failed.',
    })
    return { ok: false, duplicate: false, outcome }
  }

  if (response?.tooLarge) {
    const outcome = persistOutcome({
      companyId,
      intentId,
      destinationId,
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      idempotencyKey: intent.id,
      httpStatus: Number(response.status) || null,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.RESPONSE_TOO_LARGE,
      retryable: false,
      truncatedError: 'Webhook response exceeded size limit.',
    })
    return { ok: false, duplicate: false, outcome }
  }

  // Ensure response body is truncated and never stored on the outcome.
  truncateOutboundWebhookResponseBody(response || {})

  const httpStatus = Number(response?.status)
  if (httpStatus >= 300 && httpStatus < 400) {
    const outcome = persistOutcome({
      companyId,
      intentId,
      destinationId,
      status: OUTBOUND_WEBHOOK_OUTCOME_STATUS.FAILED,
      idempotencyKey: intent.id,
      httpStatus,
      failureCode: OUTBOUND_WEBHOOK_FAILURE_CODE.REDIRECT_REJECTED,
      retryable: false,
      truncatedError: 'Webhook redirects are rejected.',
    })
    return { ok: false, duplicate: false, outcome }
  }

  const classified = classifyHttpStatus(httpStatus)
  const outcome = persistOutcome({
    companyId,
    intentId,
    destinationId,
    status: classified.status,
    idempotencyKey: intent.id,
    httpStatus: Number.isFinite(httpStatus) ? httpStatus : null,
    failureCode: classified.failureCode,
    retryable: classified.retryable,
    truncatedError:
      classified.status === OUTBOUND_WEBHOOK_OUTCOME_STATUS.SUCCEEDED
        ? null
        : `Webhook delivery returned HTTP ${httpStatus}.`,
  })

  return {
    ok: classified.status === OUTBOUND_WEBHOOK_OUTCOME_STATUS.SUCCEEDED,
    duplicate: false,
    outcome,
  }
}
