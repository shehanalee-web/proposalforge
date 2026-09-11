/**
 * H16.12 Slice 12.1 — Inbound mailbox envelope schema.
 *
 * Pure normalization. No store, no HTTP, no OAuth, no vendor SDK, no
 * ActivityRepository write, no entity resolution, no intake fan-out.
 */

import { EMAIL_PATTERN } from '../../models/ids.js'
import { ValidationError } from '../../services/errors.js'
import { assertNoSecretValues } from '../schema.js'
import {
  MAILBOX_ACTIVITY_KIND,
  MAILBOX_ACTIVITY_TYPE,
  MAILBOX_CONTENT_MEDIA_TYPE,
  MAILBOX_DIRECTION,
  MAILBOX_FORBIDDEN_CONTENT_FIELDS,
  MAILBOX_FORBIDDEN_FIELDS,
  MAILBOX_LIMITS,
  MAILBOX_RECIPIENT_ROLES,
  MAILBOX_SCHEMA_VERSION,
  MAILBOX_SOURCE_DOMAIN,
  MAILBOX_SOURCE_ENTITY_TYPE,
} from './types.js'

function asString(value) {
  return value == null ? '' : String(value)
}

function asTrimmed(value) {
  return asString(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

function nowIso() {
  return new Date().toISOString()
}

function asRequiredId(value, field) {
  const id = asTrimmed(value).slice(0, MAILBOX_LIMITS.MAX_ID)
  if (!id) {
    throw invalid(`${field} is required.`, field)
  }
  return id
}

function asOptionalId(value, max = MAILBOX_LIMITS.MAX_ID) {
  const id = asTrimmed(value).slice(0, max)
  return id || null
}

function asIso(value, fallback = null) {
  if (value == null || value === '') return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function assertNoForbiddenFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of MAILBOX_FORBIDDEN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid('Mailbox envelope cannot carry vendor, secret, or raw MIME fields.', key)
  }
}

function makeAddress(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid(`${field} is required.`, field)
  }
  const email = asTrimmed(input.email).slice(0, MAILBOX_LIMITS.MAX_EMAIL).toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw invalid(`${field} email is not valid.`, `${field}.email`)
  }
  const displayName =
    asTrimmed(input.displayName).slice(0, MAILBOX_LIMITS.MAX_NAME) || null
  return Object.freeze({ email, displayName })
}

function makeRecipients(input) {
  if (input == null) {
    throw invalid('recipients are required.', 'recipients')
  }
  if (!Array.isArray(input)) {
    throw invalid('recipients must be an array.', 'recipients')
  }
  if (input.length === 0) {
    throw invalid('At least one recipient is required.', 'recipients')
  }
  if (input.length > MAILBOX_LIMITS.MAX_RECIPIENTS) {
    throw invalid(
      `Mailbox envelope permits at most ${MAILBOX_LIMITS.MAX_RECIPIENTS} recipients.`,
      'recipients',
    )
  }
  return Object.freeze(
    input.map((row, index) => {
      const address = makeAddress(row, `recipients.${index}`)
      const role = asTrimmed(row?.role)
      if (!MAILBOX_RECIPIENT_ROLES.includes(role)) {
        throw invalid(
          'Each recipient requires role to, cc, or bcc.',
          `recipients.${index}.role`,
        )
      }
      return Object.freeze({
        email: address.email,
        displayName: address.displayName,
        role,
      })
    }),
  )
}

function assertNoForbiddenContentFields(input, field) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  for (const key of MAILBOX_FORBIDDEN_CONTENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    if (input[key] == null || input[key] === '') continue
    throw invalid(
      'Mailbox content cannot carry HTML, MIME, or vendor payload fields.',
      `${field}.${key}`,
    )
  }
}

function asBoundedText(value, field, max) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') {
    throw invalid(`${field} must be plain text.`, field)
  }
  return value.trim().slice(0, max)
}

/**
 * Provider-neutral content: bounded text/plain plus an optional opaque ref.
 * Top-level `text` / `body` / `snippet` / `bodyRef` are aliases.
 *
 * @param {object} input
 */
function makeContent(input) {
  const nested = input.content
  if (nested != null && (typeof nested !== 'object' || Array.isArray(nested))) {
    throw invalid('content must be an object.', 'content')
  }
  const source = nested && typeof nested === 'object' ? nested : {}
  assertNoSecretValues(source)
  assertNoForbiddenContentFields(source, 'content')

  const mediaType =
    asTrimmed(source.mediaType) || MAILBOX_CONTENT_MEDIA_TYPE.TEXT_PLAIN
  if (mediaType !== MAILBOX_CONTENT_MEDIA_TYPE.TEXT_PLAIN) {
    throw invalid('Mailbox content mediaType must be text/plain.', 'content.mediaType')
  }

  if (input.body != null && typeof input.body !== 'string') {
    throw invalid('body must be plain text.', 'body')
  }

  const text = asBoundedText(
    source.text ?? input.text ?? input.body,
    nested?.text != null ? 'content.text' : input.text != null ? 'text' : 'body',
    MAILBOX_LIMITS.MAX_TEXT,
  )
  const snippet =
    asBoundedText(
      source.snippet ?? input.snippet,
      nested?.snippet != null ? 'content.snippet' : 'snippet',
      MAILBOX_LIMITS.MAX_SNIPPET,
    ) || text.slice(0, MAILBOX_LIMITS.MAX_SNIPPET)
  const ref = asOptionalId(
    source.ref ?? source.bodyRef ?? input.bodyRef,
    MAILBOX_LIMITS.MAX_BODY_REF,
  )

  return Object.freeze({
    mediaType: MAILBOX_CONTENT_MEDIA_TYPE.TEXT_PLAIN,
    text,
    snippet,
    ref,
  })
}

/**
 * Stable intake identity for a mailbox message.
 * `companyId|mailbox|<mailboxId>|<externalMessageId>`
 *
 * @param {object} input
 * @returns {string}
 */
export function makeMailboxIdempotencyKey(input = {}) {
  const companyId = asRequiredId(input.companyId, 'companyId')
  const mailboxId = asRequiredId(input.mailboxId, 'mailboxId')
  const externalMessageId = asRequiredId(input.externalMessageId, 'externalMessageId')
  const key = `${companyId}|mailbox|${mailboxId}|${externalMessageId}`
  if (key.length > MAILBOX_LIMITS.MAX_IDEMPOTENCY_KEY) {
    throw invalid('Idempotency key exceeds the bound.', 'idempotencyKey')
  }
  return key
}

/**
 * Normalize an inbound mailbox message envelope.
 *
 * @param {object} [input]
 * @returns {object}
 */
export function makeInboundMailboxMessage(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Mailbox envelope must be an object.', 'message')
  }
  assertNoSecretValues(input)
  assertNoForbiddenFields(input)

  const companyId = asRequiredId(input.companyId, 'companyId')
  const mailboxId = asRequiredId(input.mailboxId, 'mailboxId')
  const externalMessageId = asRequiredId(input.externalMessageId, 'externalMessageId')
  const threadId = asOptionalId(input.threadId)
  const rfcMessageId = asOptionalId(input.rfcMessageId, MAILBOX_LIMITS.MAX_RFC_MESSAGE_ID)
  const sender = makeAddress(input.sender, 'sender')
  const recipients = makeRecipients(input.recipients)
  const subject = asTrimmed(input.subject).slice(0, MAILBOX_LIMITS.MAX_SUBJECT)
  const content = makeContent(input)
  const occurredAt = asIso(input.occurredAt)
  if (!occurredAt) {
    throw invalid('Mailbox envelope requires occurredAt.', 'occurredAt')
  }
  const receivedAt = asIso(input.receivedAt, occurredAt)
  const recordedAt = asIso(input.recordedAt, nowIso())
  const derivedKey = makeMailboxIdempotencyKey({
    companyId,
    mailboxId,
    externalMessageId,
  })
  const providedKey = asTrimmed(input.idempotencyKey)
  if (providedKey && providedKey !== derivedKey) {
    throw invalid('Idempotency key must match mailbox identity.', 'idempotencyKey')
  }

  return Object.freeze({
    companyId,
    mailboxId,
    externalMessageId,
    threadId,
    rfcMessageId,
    direction: MAILBOX_DIRECTION.INBOUND,
    sender,
    recipients,
    subject,
    content,
    occurredAt,
    receivedAt,
    recordedAt,
    source: Object.freeze({
      domain: MAILBOX_SOURCE_DOMAIN,
      entityType: MAILBOX_SOURCE_ENTITY_TYPE,
      entityId: externalMessageId,
      eventId: externalMessageId,
    }),
    activityKind: MAILBOX_ACTIVITY_KIND,
    activityType: MAILBOX_ACTIVITY_TYPE,
    idempotencyKey: derivedKey,
    schemaVersion:
      Number.isInteger(input.schemaVersion) && input.schemaVersion > 0
        ? input.schemaVersion
        : MAILBOX_SCHEMA_VERSION,
  })
}

/**
 * @param {object} [message]
 * @returns {object}
 */
export function cloneInboundMailboxMessage(message) {
  return makeInboundMailboxMessage(message ?? {})
}
