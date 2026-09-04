import { MAIL_ERROR_CODE } from '../../models/emailDelivery.js'
import { MailError } from '../errors.js'

/**
 * Provider-agnostic mail contract.
 *
 * Callers send through `mailProvider.send()`. They never import Resend,
 * Postmark, SendGrid, or SES. Swap MAIL_PROVIDER to change the backend.
 *
 * @typedef {object} MailMessage
 * @property {string} id
 * @property {string} [proposalId]
 * @property {string} fromName
 * @property {string} fromEmail
 * @property {string[]} to
 * @property {string[]} [cc]
 * @property {string[]} [bcc]
 * @property {string} subject
 * @property {string} html
 * @property {string} text
 * @property {string | null} [replyTo]
 * @property {string | null} [scheduledAt]
 * @property {Record<string, string>} [headers]
 * @property {Record<string, string>} [tags]
 */

function asList(value) {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

export function formatFromHeader(name, email) {
  const address = String(email ?? '').trim()
  const label = String(name ?? '').trim()
  if (!address) return ''
  if (!label) return address
  const safe = label.replace(/[<>"]/g, '')
  return `${safe} <${address}>`
}

export function mapProviderHttpError(status, body, fallback) {
  const message =
    body?.message ||
    body?.error ||
    (typeof body === 'string' ? body : '') ||
    fallback

  if (status === 429) {
    return new MailError(message || 'The email provider is rate limiting sends.', {
      code: MAIL_ERROR_CODE.RATE_LIMIT,
      retryable: true,
      status,
    })
  }

  if (status === 400 || status === 422) {
    return new MailError(message || 'The email could not be accepted.', {
      code: MAIL_ERROR_CODE.INVALID_EMAIL,
      retryable: false,
      status,
    })
  }

  if (status === 401 || status === 403) {
    return new MailError('The email provider rejected the API key.', {
      code: MAIL_ERROR_CODE.PROVIDER_UNAVAILABLE,
      retryable: false,
      status,
    })
  }

  if (status >= 500) {
    return new MailError(message || 'The email provider is unavailable.', {
      code: MAIL_ERROR_CODE.PROVIDER_UNAVAILABLE,
      retryable: true,
      status,
    })
  }

  return new MailError(message || 'The email could not be sent.', {
    code: MAIL_ERROR_CODE.REJECTED,
    retryable: true,
    status,
  })
}

export function mapFetchFailure(error) {
  if (error instanceof MailError) return error

  const name = error?.name || ''
  const message = error?.message || 'The email could not be sent.'

  if (name === 'AbortError' || /timeout|timed out|aborted/i.test(message)) {
    return new MailError('The email provider timed out. Try again.', {
      code: MAIL_ERROR_CODE.TIMEOUT,
      retryable: true,
    })
  }

  if (/network|fetch|ECONN|ENOTFOUND|Failed to fetch/i.test(message) || name === 'TypeError') {
    return new MailError('Could not reach the email provider. Check the network and try again.', {
      code: MAIL_ERROR_CODE.NETWORK,
      retryable: true,
    })
  }

  return new MailError(message, {
    code: MAIL_ERROR_CODE.REJECTED,
    retryable: true,
  })
}

async function fetchJson(url, options, timeoutMs = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const body = await response.json().catch(() => ({}))
    return { response, body }
  } finally {
    clearTimeout(timer)
  }
}

function createMockProvider() {
  return {
    id: 'mock',

    async send(message) {
      const id = message.id || `mock-${Date.now().toString(36)}`
      return {
        provider: 'mock',
        providerMessageId: `mock-${id}`,
        status: message.scheduledAt ? 'queued' : 'delivered',
      }
    },
  }
}

function createResendProvider(env) {
  const apiKey = env.RESEND_API_KEY || env.MAIL_API_KEY || ''
  const defaultFrom = env.MAIL_FROM_EMAIL || ''
  const defaultName = env.MAIL_FROM_NAME || 'ProposalForge'

  return {
    id: 'resend',

    async send(message) {
      if (!apiKey) {
        throw new MailError(
          'Email is not configured. Add RESEND_API_KEY to the environment.',
          { code: MAIL_ERROR_CODE.PROVIDER_UNAVAILABLE, retryable: false },
        )
      }

      const fromEmail = defaultFrom || message.fromEmail
      if (!fromEmail) {
        throw new MailError(
          'A verified from address is required. Set MAIL_FROM_EMAIL.',
          { code: MAIL_ERROR_CODE.PROVIDER_UNAVAILABLE, retryable: false },
        )
      }

      const payload = {
        from: formatFromHeader(message.fromName || defaultName, fromEmail),
        to: asList(message.to),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }

      if (asList(message.cc).length) payload.cc = asList(message.cc)
      if (asList(message.bcc).length) payload.bcc = asList(message.bcc)
      const replyTo = message.replyTo || message.fromEmail
      if (replyTo) payload.reply_to = replyTo
      if (message.scheduledAt) payload.scheduled_at = message.scheduledAt
      if (message.headers) payload.headers = message.headers
      if (message.tags) {
        payload.tags = Object.entries(message.tags).map(([name, value]) => ({
          name,
          value: String(value).slice(0, 256),
        }))
      }

      try {
        const { response, body } = await fetchJson('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw mapProviderHttpError(response.status, body, 'Resend rejected the send.')
        }

        return {
          provider: 'resend',
          providerMessageId: body.id ?? null,
          status: message.scheduledAt ? 'queued' : 'sent',
        }
      } catch (error) {
        throw mapFetchFailure(error)
      }
    },
  }
}

function createUnimplementedProvider(id) {
  return {
    id,
    async send() {
      throw new MailError(
        `${id} is registered but not connected yet. Use MAIL_PROVIDER=mock, or MAIL_PROVIDER=resend when a key is available.`,
        { code: MAIL_ERROR_CODE.PROVIDER_UNAVAILABLE, retryable: false },
      )
    },
  }
}

function createHttpMailProvider() {
  return {
    id: 'gateway',

    async send(message) {
      try {
        const { response, body } = await fetchJson('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })

        if (!response.ok) {
          throw new MailError(body.message || 'The email could not be sent.', {
            code: body.code || MAIL_ERROR_CODE.REJECTED,
            retryable: body.retryable !== false,
            status: response.status,
            errors: body.errors,
          })
        }

        return {
          provider: body.provider,
          providerMessageId: body.providerMessageId ?? null,
          status: body.status || 'sent',
          id: body.id,
        }
      } catch (error) {
        throw mapFetchFailure(error)
      }
    },
  }
}

const EMAIL_DEFAULT_PROVIDER = 'mock'

/**
 * Server-side factory. Reads env; never used from the browser.
 *
 * @param {Record<string, string | undefined>} env
 */
export function createMailProvider(env = {}) {
  const name = String(env.MAIL_PROVIDER || EMAIL_DEFAULT_PROVIDER).toLowerCase()

  if (name === 'mock' || name === 'none' || name === 'local') return createMockProvider()
  if (name === 'resend') {
    if (!(env.RESEND_API_KEY || env.MAIL_API_KEY)) return createMockProvider()
    return createResendProvider(env)
  }
  if (name === 'postmark') return createUnimplementedProvider('postmark')
  if (name === 'sendgrid') return createUnimplementedProvider('sendgrid')
  if (name === 'ses') return createUnimplementedProvider('ses')

  throw new MailError(`Unknown mail provider "${name}".`, {
    code: MAIL_ERROR_CODE.PROVIDER_UNAVAILABLE,
    retryable: false,
  })
}

/**
 * App-facing provider. The browser talks to `/api/email/send`; Node uses env.
 */
export function getMailProvider(env) {
  if (typeof window !== 'undefined') return createHttpMailProvider()
  return createMailProvider(env || (typeof process !== 'undefined' ? process.env : {}))
}
