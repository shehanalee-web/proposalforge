/**
 * H16.12 — Email mailbox source (Slice 12.1).
 *
 * Neutral inbound envelope only. Does not persist, ingest, poll, or
 * authenticate. Native Activity remains the write-side owner.
 */

export {
  MAILBOX_SCHEMA_VERSION,
  MAILBOX_SOURCE_ID,
  MAILBOX_SOURCE_DOMAIN,
  MAILBOX_SOURCE_ENTITY_TYPE,
  MAILBOX_ACTIVITY_KIND,
  MAILBOX_ACTIVITY_TYPE,
  MAILBOX_DIRECTION,
  MAILBOX_DIRECTIONS,
  MAILBOX_RECIPIENT_ROLE,
  MAILBOX_RECIPIENT_ROLES,
  MAILBOX_CONTENT_MEDIA_TYPE,
  MAILBOX_CONTENT_MEDIA_TYPES,
  MAILBOX_LIMITS,
  MAILBOX_FORBIDDEN_FIELDS,
  MAILBOX_FORBIDDEN_CONTENT_FIELDS,
} from './types.js'

export {
  makeMailboxIdempotencyKey,
  makeInboundMailboxMessage,
  cloneInboundMailboxMessage,
} from './schema.js'
