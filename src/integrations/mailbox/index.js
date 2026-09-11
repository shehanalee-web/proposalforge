/**
 * H16.12 — Email mailbox source.
 *
 * Slice 12.1: vendor-neutral inbound envelope.
 * Slice 12.2: map envelope → createStudioActivity() only when the caller
 * supplies an existing Native Activity subject. Uncorrelated mail is not ingested.
 * Native Activity remains the write-side owner. No mailbox store, HTTP, or OAuth.
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
  MAILBOX_INGEST_STATUS,
  MAILBOX_INGEST_STATUSES,
} from './types.js'

export {
  makeMailboxIdempotencyKey,
  makeInboundMailboxMessage,
  cloneInboundMailboxMessage,
} from './schema.js'

export {
  isMailboxSubjectSupplied,
  makeNativeMailboxIdempotencyKey,
  mapMailboxMessageToStudioActivityInput,
} from './map.js'

export { ingestInboundMailboxMessage } from './ingest.js'
