/**
 * H16.12 Slice 12.1 — Vendor-neutral inbound mailbox envelope.
 *
 * Represents a mailbox message *before* it becomes a NativeActivity.
 * Not a TimelineSource, not outbound mail delivery, not Gmail/Outlook.
 * Later slices map this envelope onto kind=email / type=email.logged.
 */

import { ACTIVITY_KIND } from '../activities/types.js'
import { ACTIVITY_NATIVE_TYPE } from '../../persistence/activities/types.js'

export const MAILBOX_SCHEMA_VERSION = 1

/** Architectural source id. Must never be registered as a TimelineSource. */
export const MAILBOX_SOURCE_ID = 'email_mailbox'

export const MAILBOX_SOURCE_DOMAIN = 'mailbox'
export const MAILBOX_SOURCE_ENTITY_TYPE = 'mailbox_message'

/** Locked native Activity mapping. Slice 12.1 does not persist. */
export const MAILBOX_ACTIVITY_KIND = ACTIVITY_KIND.EMAIL
export const MAILBOX_ACTIVITY_TYPE = ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED

/**
 * Slice 12.2 ingest outcomes. Uncorrelated mail is not a Native Activity
 * and is not stored. H16.12 does not invent a subject.
 */
export const MAILBOX_INGEST_STATUS = Object.freeze({
  INGESTED: 'ingested',
  UNCORRELATED: 'uncorrelated',
})

export const MAILBOX_INGEST_STATUSES = Object.freeze(Object.values(MAILBOX_INGEST_STATUS))

export const MAILBOX_DIRECTION = Object.freeze({
  INBOUND: 'inbound',
})

export const MAILBOX_DIRECTIONS = Object.freeze(Object.values(MAILBOX_DIRECTION))

export const MAILBOX_RECIPIENT_ROLE = Object.freeze({
  TO: 'to',
  CC: 'cc',
  BCC: 'bcc',
})

export const MAILBOX_RECIPIENT_ROLES = Object.freeze(
  Object.values(MAILBOX_RECIPIENT_ROLE),
)

/**
 * Neutral content is always plain text plus an optional opaque reference.
 * HTML, MIME, and vendor payload types are not part of the envelope.
 */
export const MAILBOX_CONTENT_MEDIA_TYPE = Object.freeze({
  TEXT_PLAIN: 'text/plain',
})

export const MAILBOX_CONTENT_MEDIA_TYPES = Object.freeze(
  Object.values(MAILBOX_CONTENT_MEDIA_TYPE),
)

export const MAILBOX_LIMITS = Object.freeze({
  MAX_ID: 128,
  MAX_EMAIL: 200,
  MAX_NAME: 120,
  MAX_SUBJECT: 200,
  MAX_TEXT: 1000,
  MAX_SNIPPET: 200,
  MAX_BODY_REF: 256,
  MAX_RFC_MESSAGE_ID: 200,
  MAX_RECIPIENTS: 16,
  MAX_IDEMPOTENCY_KEY: 256,
})

/**
 * Vendor, secret, monetary, entity-resolution, and raw MIME/HTML fields.
 * Presence of a non-empty value is a hard reject so the envelope cannot
 * smuggle Gmail/Outlook/Graph payloads, Contact/Deal ids, or unbounded
 * blobs. Bounded plain text belongs on `content`, not these keys.
 */
export const MAILBOX_FORBIDDEN_FIELDS = Object.freeze([
  'gmailId',
  'gmailMessageId',
  'gmailThreadId',
  'historyId',
  'outlookId',
  'outlookConversationId',
  'graphId',
  'microsoftGraph',
  'google',
  'provider',
  'oauth',
  'accessToken',
  'refreshToken',
  'apiKey',
  'html',
  'raw',
  'rawMime',
  'rfc822',
  'mime',
  'contactId',
  'companyRefId',
  'dealId',
  'subjectType',
  'amount',
  'value',
  'price',
  'total',
  'currency',
])

/** Nested `content` keys that would reintroduce HTML/MIME/vendor payloads. */
export const MAILBOX_FORBIDDEN_CONTENT_FIELDS = Object.freeze([
  'html',
  'raw',
  'rawMime',
  'rfc822',
  'mime',
  'gmailAttachmentId',
  'outlookAttachmentId',
  'graphId',
])
