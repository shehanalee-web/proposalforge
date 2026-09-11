/**
 * H16.12 Slice 12.2 — Map a mailbox envelope onto createStudioActivity input.
 *
 * Pure. Does not persist, emit, look up H16.10 entities, or register sources.
 * Caller supplies an existing Native Activity subject. This mapper does not
 * derive subject from tenant companyId or mailbox identity.
 * Native Activity remains canonical; mailbox identity lives in attributes
 * and the repository idempotency key because Native Activity persistence
 * overwrites `source` with the activity record id.
 */

import { ValidationError } from '../../services/errors.js'
import { ACTIVITY_SUBJECT_TYPES } from '../activities/types.js'
import { NATIVE_ACTIVITY_LIMITS } from '../../persistence/activities/types.js'
import { stableHash } from '../activities/schema.js'
import { MAILBOX_ACTIVITY_KIND, MAILBOX_LIMITS } from './types.js'
import { makeInboundMailboxMessage } from './schema.js'

function asTrimmed(value) {
  return value == null ? '' : String(value).trim()
}

function invalid(message, field) {
  return new ValidationError(message, [{ field, message }])
}

/**
 * Absent subject is ingest's uncorrelated path. Mapper requires a subject.
 *
 * @param {unknown} subject
 * @returns {boolean}
 */
export function isMailboxSubjectSupplied(subject) {
  if (subject == null || subject === '') return false
  if (typeof subject !== 'object' || Array.isArray(subject)) return true
  return Boolean(asTrimmed(subject.type) || asTrimmed(subject.id))
}

/**
 * Pass through type+id. Does not look up entities or rewrite ids.
 *
 * @param {unknown} subject
 * @returns {{ type: string, id: string }}
 */
function asSuppliedSubject(subject) {
  if (!isMailboxSubjectSupplied(subject)) {
    throw invalid('Native activity subject is required.', 'subject')
  }
  if (typeof subject !== 'object' || Array.isArray(subject)) {
    throw invalid('Native activity subject must be an object.', 'subject')
  }
  const type = asTrimmed(subject.type)
  const id = asTrimmed(subject.id)
  if (!ACTIVITY_SUBJECT_TYPES.includes(type)) {
    throw invalid('Native activity subject type is not recognized.', 'subject.type')
  }
  if (!id) {
    throw invalid('Native activity requires a subject id.', 'subject.id')
  }
  return Object.freeze({ type, id })
}

/**
 * Native idempotency is company-scoped and capped at 128 chars.
 * Prefer the Slice 12.1 mailbox key; hash only when it cannot fit.
 *
 * @param {object} message
 * @returns {string}
 */
export function makeNativeMailboxIdempotencyKey(message) {
  const key = asTrimmed(message?.idempotencyKey)
  if (!key) {
    throw invalid('Mailbox envelope requires idempotencyKey.', 'idempotencyKey')
  }
  if (key.length <= NATIVE_ACTIVITY_LIMITS.MAX_IDEMPOTENCY_KEY) return key
  return `mbx:${stableHash(key)}`.slice(0, NATIVE_ACTIVITY_LIMITS.MAX_IDEMPOTENCY_KEY)
}

function makeParticipants(message) {
  const rows = [
    {
      type: 'email',
      id: message.sender.email,
      role: 'from',
    },
    ...message.recipients.map((row) => ({
      type: 'email',
      id: row.email,
      role: row.role,
    })),
  ]
  return rows.slice(0, NATIVE_ACTIVITY_LIMITS.MAX_PARTICIPANTS)
}

function makeAttributes(message) {
  const attributes = {
    mailboxId: message.mailboxId,
    externalMessageId: message.externalMessageId,
    direction: message.direction,
    senderEmail: message.sender.email,
  }
  if (message.threadId) attributes.threadId = message.threadId
  if (message.rfcMessageId) attributes.rfcMessageId = message.rfcMessageId
  if (message.content?.ref) attributes.bodyRef = message.content.ref
  return attributes
}

/**
 * @param {object} [input]
 * @param {{ type?: string, id?: string }} subject
 * @returns {object}
 */
export function mapMailboxMessageToStudioActivityInput(input = {}, subject) {
  const message = makeInboundMailboxMessage(input)
  return Object.freeze({
    companyId: message.companyId,
    kind: MAILBOX_ACTIVITY_KIND,
    subject: asSuppliedSubject(subject),
    subjectLine: message.subject.slice(0, MAILBOX_LIMITS.MAX_SUBJECT),
    body: message.content.text,
    occurredAt: message.occurredAt,
    participants: Object.freeze(makeParticipants(message)),
    attributes: Object.freeze(makeAttributes(message)),
    idempotencyKey: makeNativeMailboxIdempotencyKey(message),
  })
}
