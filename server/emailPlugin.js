import { projectRoot } from './dataPaths.js'
import { readJson, writeJson } from './runtimeStore.js'
import { ACTIVITY_EVENT_TYPE, ACTIVITY_USER, makeActivityEventRow } from '../src/models/activityEvent.js'
import {
  EMAIL_DELIVERY_STATUS,
  MAIL_ERROR_CODE,
  advanceEmailStatus,
  emailActivityKey,
  makeEmailDeliverySummary,
  makeEmailMessage,
} from '../src/models/emailDelivery.js'
import { createMailProvider } from '../src/services/email/mailProvider.js'
import { MailError } from '../src/services/errors.js'

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

const WEBHOOK_STATUS = {
  'email.sent': EMAIL_DELIVERY_STATUS.SENT,
  'email.delivered': EMAIL_DELIVERY_STATUS.DELIVERED,
  'email.opened': EMAIL_DELIVERY_STATUS.OPENED,
  'email.clicked': EMAIL_DELIVERY_STATUS.OPENED,
  'email.bounced': EMAIL_DELIVERY_STATUS.BOUNCED,
  'email.failed': EMAIL_DELIVERY_STATUS.FAILED,
  'email.complained': EMAIL_DELIVERY_STATUS.BOUNCED,
}

const WEBHOOK_ACTIVITY = {
  [EMAIL_DELIVERY_STATUS.DELIVERED]: ACTIVITY_EVENT_TYPE.EMAIL_DELIVERED,
  [EMAIL_DELIVERY_STATUS.OPENED]: ACTIVITY_EVENT_TYPE.EMAIL_OPENED,
  [EMAIL_DELIVERY_STATUS.BOUNCED]: ACTIVITY_EVENT_TYPE.EMAIL_BOUNCED,
  [EMAIL_DELIVERY_STATUS.FAILED]: ACTIVITY_EVENT_TYPE.EMAIL_FAILED,
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(payload))
  res.end(payload)
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

function originFromReq(req, fallback) {
  const host = req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'http'
  if (host) return `${proto}://${host}`
  return String(fallback || '').replace(/\/$/, '')
}

function resolveRedirect(url, req) {
  const target = String(url || '').trim() || '/'
  if (/^https?:\/\//i.test(target)) return target
  return `${originFromReq(req)}${target.startsWith('/') ? target : `/${target}`}`
}

export function emailPlugin() {
  const root = projectRoot()

  async function loadMessages() {
    const records = await readJson('emailMessages.json', [])
    return Array.isArray(records) ? records.map((row) => makeEmailMessage(row)) : []
  }

  async function saveMessages(records) {
    await writeJson('emailMessages.json', records)
  }

  async function loadActivity() {
    const records = await readJson('activityEvents.json', [])
    return Array.isArray(records) ? records : []
  }

  async function saveActivity(records) {
    await writeJson('activityEvents.json', records)
  }

  async function upsertMessage(next) {
    const records = await loadMessages()
    const index = records.findIndex((row) => row.id === next.id)
    if (index >= 0) records[index] = next
    else records.push(next)
    await saveMessages(records)
    return next
  }

  async function findMessage(id) {
    return (await loadMessages()).find((row) => row.id === id) ?? null
  }

  async function findByProviderId(providerMessageId) {
    if (!providerMessageId) return null
    return (
      (await loadMessages()).find((row) => row.providerMessageId === providerMessageId) ?? null
    )
  }

  async function recordActivity(proposalId, eventType, metadata) {
    const records = await loadActivity()
    const messageId = metadata.emailMessageId
    if (messageId) {
      const key = emailActivityKey(messageId, eventType)
      const exists = records.some(
        (row) =>
          row.proposal_id === proposalId &&
          row.event_type === eventType &&
          row.metadata?.emailMessageId === messageId,
      )
      if (exists) return null
      metadata.dedupeKey = key
    }

    const event = makeActivityEventRow({
      proposal_id: proposalId,
      user_id:
        eventType === ACTIVITY_EVENT_TYPE.EMAIL_SENT ||
        eventType === ACTIVITY_EVENT_TYPE.EMAIL_FAILED
          ? ACTIVITY_USER.STUDIO
          : ACTIVITY_USER.CLIENT,
      event_type: eventType,
      metadata,
    })
    records.push(event)
    await saveActivity(records)
    return event
  }

  async function applyStatus(message, status, extra = {}) {
    const next = makeEmailMessage({
      ...message,
      ...extra,
      status: advanceEmailStatus(message.status, status),
      updatedAt: new Date().toISOString(),
    })
    await upsertMessage(next)
    await patchProposalLastEmail(next)
    return next
  }

  async function patchProposalLastEmail(message) {
    if (!message?.proposalId) return
    const proposals = await readJson('proposals.json', [])
    if (!Array.isArray(proposals)) return
    const index = proposals.findIndex((row) => row.id === message.proposalId)
    if (index < 0) return
    const current = proposals[index].lastEmail
    if (current?.id && current.id !== message.id) return
    proposals[index] = {
      ...proposals[index],
      lastEmail: makeEmailDeliverySummary({
        ...current,
        ...message,
      }),
    }
    await writeJson('proposals.json', proposals)
  }

  async function handle(req, res, next, env) {
    const url = req.url || '/'
    const method = req.method || 'GET'
    const provider = createMailProvider(env)

    try {
      if (method === 'POST' && matchRoute(url, '/api/email/send')) {
        const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        try {
          const result = await provider.send(payload)
          const message = makeEmailMessage({
            id: payload.id,
            proposalId: payload.proposalId,
            provider: result.provider,
            providerMessageId: result.providerMessageId,
            status: result.status,
            fromName: payload.fromName,
            fromEmail: payload.fromEmail,
            to: payload.to,
            cc: payload.cc,
            bcc: payload.bcc,
            subject: payload.subject,
            message: payload.personalMessage || '',
            proposalUrl: payload.proposalUrl || payload.headers?.['X-Proposal-Url'] || '',
            trackingUrl: '',
            expiresAt: payload.scheduledAt ? null : undefined,
            scheduledAt: payload.scheduledAt,
            sentAt: new Date().toISOString(),
          })
          await upsertMessage(message)
          await patchProposalLastEmail(message)
          return json(res, 200, {
            id: message.id,
            provider: result.provider,
            providerMessageId: result.providerMessageId,
            status: result.status,
          })
        } catch (error) {
          const mail = error instanceof MailError ? error : new MailError(error.message, {
            code: MAIL_ERROR_CODE.REJECTED,
            retryable: true,
          })
          return json(res, mail.status && mail.status >= 400 ? mail.status : 502, {
            message: mail.message,
            code: mail.code,
            retryable: mail.retryable,
            errors: mail.errors,
          })
        }
      }

      const click = matchRoute(url, '/api/email/click/:id')
      if (method === 'GET' && click) {
        const message = await findMessage(click.id)
        if (message) {
          await applyStatus(message, EMAIL_DELIVERY_STATUS.OPENED)
          await recordActivity(message.proposalId, ACTIVITY_EVENT_TYPE.EMAIL_CLICKED, {
            emailMessageId: message.id,
            clientName: message.to[0],
            description: 'Client clicked View Proposal',
          })
        }
        const target = resolveRedirect(message?.proposalUrl, req)
        res.statusCode = 302
        res.setHeader('Location', target)
        res.end()
        return
      }

      const open = matchRoute(url, '/api/email/open/:id')
      if (method === 'GET' && open) {
        const message = await findMessage(open.id)
        if (message) {
          await applyStatus(message, EMAIL_DELIVERY_STATUS.OPENED)
          await recordActivity(message.proposalId, ACTIVITY_EVENT_TYPE.EMAIL_OPENED, {
            emailMessageId: message.id,
            clientName: message.to[0],
            description: 'Client opened the proposal email',
          })
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'image/gif')
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
        res.end(PIXEL)
        return
      }

      if (method === 'GET' && matchRoute(url, '/api/email/messages')) {
        const query = new URL(url, 'http://local').searchParams
        const proposalId = query.get('proposalId')
        let records = await loadMessages()
        if (proposalId) {
          records = records.filter((row) => row.proposalId === proposalId)
        }
        return json(res, 200, { records })
      }

      if (method === 'POST' && matchRoute(url, '/api/email/webhooks/resend')) {
        const payload = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        const type = payload.type || payload.event
        const data = payload.data || {}
        const status = WEBHOOK_STATUS[type]
        const providerId = data.email_id || data.id
        let message = await findByProviderId(providerId)
        if (!message && data.headers?.['X-Email-Message-Id']) {
          message = await findMessage(data.headers['X-Email-Message-Id'])
        }
        if (message && status) {
          await applyStatus(message, status)
          const eventType =
            type === 'email.clicked'
              ? ACTIVITY_EVENT_TYPE.EMAIL_CLICKED
              : WEBHOOK_ACTIVITY[status]
          if (eventType) {
            await recordActivity(message.proposalId, eventType, {
              emailMessageId: message.id,
              clientName: message.to[0],
              description: `Provider event: ${type}`,
            })
          }
        }
        return json(res, 200, { ok: true })
      }
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : 500)
      return json(res, status, { message: error.message || 'Email request failed.' })
    }

    return next()
  }

  function attach(server) {
    server.middlewares.use((req, res, next) => {
      import('vite')
        .then(({ loadEnv }) => handle(req, res, next, loadEnv(server.config.mode, root, '')))
        .catch(next)
    })
  }

  return {
    name: 'proposalforge-email',
    configureServer: attach,
    configurePreviewServer: attach,
    handle: (req, res, next) => handle(req, res, next, process.env),
  }
}
