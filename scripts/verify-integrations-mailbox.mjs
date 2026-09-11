/**
 * H16.12 Slice 12.1 — Inbound mailbox envelope verification.
 *
 * Contract only. Does not nest H16.7–H16.11. Never writes data/proposals.json
 * or activities.json. No HTTP, OAuth, vendor SDK, or persistence.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_NATIVE_TYPE,
  INTEGRATION_CAPABILITIES,
  MAILBOX_ACTIVITY_KIND,
  MAILBOX_ACTIVITY_TYPE,
  MAILBOX_CONTENT_MEDIA_TYPE,
  MAILBOX_DIRECTION,
  MAILBOX_FORBIDDEN_FIELDS,
  MAILBOX_LIMITS,
  MAILBOX_RECIPIENT_ROLE,
  MAILBOX_SOURCE_DOMAIN,
  MAILBOX_SOURCE_ENTITY_TYPE,
  MAILBOX_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  cloneInboundMailboxMessage,
  makeInboundMailboxMessage,
  makeMailboxIdempotencyKey,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const studio = DEFAULT_COMPANY_ID
const occurredAt = '2026-09-11T13:00:00.000Z'

let passed = 0
let failed = 0

function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function collectJs(dir) {
  let text = ''
  if (!existsSync(dir)) return text
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, entry.name)
    if (entry.isDirectory()) text += collectJs(next)
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      text += readFileSync(next, 'utf8')
    }
  }
  return text
}

function hashFile(path) {
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function dataFingerprint() {
  const dir = join(root, 'data')
  if (!existsSync(dir)) return ''
  const names = readdirSync(dir).sort()
  return names
    .map((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return `${name}/`
      return `${name}:${hashFile(path)}`
    })
    .join('|')
}

function envelope(extra = {}) {
  return {
    companyId: studio,
    mailboxId: 'mailbox-studio-inbox',
    externalMessageId: 'ext-msg-100',
    threadId: 'ext-thread-9',
    rfcMessageId: '<100@example.test>',
    sender: { email: 'Alex@Client.test', displayName: 'Alex Client' },
    recipients: [
      { email: 'studio@proposalforge.test', displayName: 'Studio', role: MAILBOX_RECIPIENT_ROLE.TO },
    ],
    subject: 'Follow up on the proposal',
    snippet: 'Thanks for sending this over.',
    bodyRef: 'content:mailbox-studio-inbox:ext-msg-100',
    text: 'Thanks for sending this over. We can review on Tuesday.',
    occurredAt,
    receivedAt: '2026-09-11T13:01:00.000Z',
    ...extra,
  }
}

const mailboxDir = join(root, 'src', 'integrations', 'mailbox')
const mailboxSource = collectJs(mailboxDir)
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

console.log('— H16.12.1 mailbox envelope —')

{
  const message = makeInboundMailboxMessage(envelope())
  assert(
    '1. valid inbound envelope is accepted',
    message.companyId === studio &&
      message.mailboxId === 'mailbox-studio-inbox' &&
      message.externalMessageId === 'ext-msg-100' &&
      message.threadId === 'ext-thread-9' &&
      message.direction === MAILBOX_DIRECTION.INBOUND &&
      message.sender.email === 'alex@client.test' &&
      message.recipients[0].role === MAILBOX_RECIPIENT_ROLE.TO &&
      message.subject === 'Follow up on the proposal' &&
      message.content.mediaType === MAILBOX_CONTENT_MEDIA_TYPE.TEXT_PLAIN &&
      message.content.text === 'Thanks for sending this over. We can review on Tuesday.' &&
      message.content.snippet === 'Thanks for sending this over.' &&
      message.content.ref === 'content:mailbox-studio-inbox:ext-msg-100' &&
      message.occurredAt === occurredAt &&
      message.receivedAt === '2026-09-11T13:01:00.000Z' &&
      message.source.domain === MAILBOX_SOURCE_DOMAIN &&
      message.source.entityType === MAILBOX_SOURCE_ENTITY_TYPE &&
      message.source.entityId === 'ext-msg-100',
  )
}

{
  const message = makeInboundMailboxMessage(envelope({ receivedAt: undefined }))
  const cloned = cloneInboundMailboxMessage(message)
  assert(
    '2. clone round-trips and receivedAt defaults to occurredAt',
    message.receivedAt === occurredAt &&
      JSON.stringify(cloned) === JSON.stringify(message),
  )
}

{
  const message = makeInboundMailboxMessage(envelope())
  const derived = makeMailboxIdempotencyKey({
    companyId: studio,
    mailboxId: 'mailbox-studio-inbox',
    externalMessageId: 'ext-msg-100',
  })
  assert(
    '3. idempotency identity is companyId|mailbox|mailboxId|externalMessageId',
    message.idempotencyKey === derived &&
      derived === `${studio}|mailbox|mailbox-studio-inbox|ext-msg-100`,
  )
}

{
  const message = makeInboundMailboxMessage(envelope())
  assert(
    '4. envelope declares native email.logged mapping without persisting',
    MAILBOX_ACTIVITY_KIND === ACTIVITY_KIND.EMAIL &&
      MAILBOX_ACTIVITY_TYPE === ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED &&
      message.activityKind === 'email' &&
      message.activityType === 'email.logged',
  )
}

{
  const message = makeInboundMailboxMessage(
    envelope({
      gmailMessageId: '',
      outlookId: null,
    }),
  )
  const keys = Object.keys(message).sort()
  assert(
    '5. provider-neutral shape has no vendor or raw MIME fields',
    !keys.includes('provider') &&
      !keys.includes('gmailMessageId') &&
      !keys.includes('outlookId') &&
      !keys.includes('html') &&
      !keys.includes('rawMime') &&
      !keys.includes('contactId') &&
      message.content.mediaType === 'text/plain' &&
      typeof message.content.text === 'string' &&
      message.source.domain === 'mailbox' &&
      !/gmail|outlook|graph|google|microsoft/i.test(JSON.stringify(message)),
  )
}

console.log('')
console.log('— required identity —')

{
  const missingCompany = threw(() =>
    makeInboundMailboxMessage(envelope({ companyId: '' })),
  )
  const missingMailbox = threw(() =>
    makeInboundMailboxMessage(envelope({ mailboxId: '' })),
  )
  const missingExternal = threw(() =>
    makeInboundMailboxMessage(envelope({ externalMessageId: '  ' })),
  )
  assert(
    '6. companyId, mailboxId, and externalMessageId are required',
    missingCompany instanceof ValidationError &&
      missingCompany.errors?.[0]?.field === 'companyId' &&
      missingMailbox instanceof ValidationError &&
      missingMailbox.errors?.[0]?.field === 'mailboxId' &&
      missingExternal instanceof ValidationError &&
      missingExternal.errors?.[0]?.field === 'externalMessageId',
  )
}

{
  const missingSender = threw(() =>
    makeInboundMailboxMessage(envelope({ sender: null })),
  )
  const badEmail = threw(() =>
    makeInboundMailboxMessage(envelope({ sender: { email: 'not-an-email' } })),
  )
  const missingRecipients = threw(() =>
    makeInboundMailboxMessage(envelope({ recipients: [] })),
  )
  const missingOccurred = threw(() =>
    makeInboundMailboxMessage(envelope({ occurredAt: 'not-a-date' })),
  )
  assert(
    '7. sender, recipients, and occurredAt are enforced',
    missingSender instanceof ValidationError &&
      badEmail instanceof ValidationError &&
      badEmail.errors?.[0]?.field === 'sender.email' &&
      missingRecipients instanceof ValidationError &&
      missingOccurred instanceof ValidationError &&
      missingOccurred.errors?.[0]?.field === 'occurredAt',
  )
}

console.log('')
console.log('— malformed rejection —')

{
  const notObject = threw(() => makeInboundMailboxMessage(null))
  const array = threw(() => makeInboundMailboxMessage([]))
  const vendor = threw(() =>
    makeInboundMailboxMessage(envelope({ gmailMessageId: 'gmsg-1' })),
  )
  const outlook = threw(() =>
    makeInboundMailboxMessage(envelope({ outlookConversationId: 'aaMkAG' })),
  )
  const inline = threw(() =>
    makeInboundMailboxMessage(envelope({ html: '<p>hi</p>' })),
  )
  const mime = threw(() =>
    makeInboundMailboxMessage(envelope({ rawMime: 'From: a\r\n\r\nHi' })),
  )
  const htmlContent = threw(() =>
    makeInboundMailboxMessage(
      envelope({ content: { mediaType: 'text/html', text: '<p>hi</p>' } }),
    ),
  )
  const resolved = threw(() =>
    makeInboundMailboxMessage(envelope({ contactId: 'contact-1' })),
  )
  const spoofedKey = threw(() =>
    makeInboundMailboxMessage(envelope({ idempotencyKey: 'other-key' })),
  )
  assert(
    '8. malformed and vendor payloads are rejected deterministically',
    notObject instanceof ValidationError &&
      array instanceof ValidationError &&
      vendor instanceof ValidationError &&
      vendor.errors?.[0]?.field === 'gmailMessageId' &&
      outlook instanceof ValidationError &&
      outlook.errors?.[0]?.field === 'outlookConversationId' &&
      inline instanceof ValidationError &&
      inline.errors?.[0]?.field === 'html' &&
      mime instanceof ValidationError &&
      mime.errors?.[0]?.field === 'rawMime' &&
      htmlContent instanceof ValidationError &&
      htmlContent.errors?.[0]?.field === 'content.mediaType' &&
      resolved instanceof ValidationError &&
      resolved.errors?.[0]?.field === 'contactId' &&
      spoofedKey instanceof ValidationError &&
      spoofedKey.errors?.[0]?.field === 'idempotencyKey',
  )
}

{
  const secret = threw(() =>
    makeInboundMailboxMessage(envelope({ accessToken: 'tok_live' })),
  )
  assert(
    '9. raw secrets are forbidden',
    secret instanceof ValidationError &&
      MAILBOX_FORBIDDEN_FIELDS.includes('accessToken') &&
      MAILBOX_FORBIDDEN_FIELDS.includes('oauth') &&
      MAILBOX_FORBIDDEN_FIELDS.includes('html') &&
      MAILBOX_FORBIDDEN_FIELDS.includes('rawMime') &&
      !MAILBOX_FORBIDDEN_FIELDS.includes('text') &&
      !MAILBOX_FORBIDDEN_FIELDS.includes('body'),
  )
}

console.log('')
console.log('— boundaries —')

{
  const vendorSdk =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud)/i
  const network = /\bfetch\s*\(|\baxios\b|\bnode:https\b|\bnode:http\b|XMLHttpRequest/
  const persist =
    /writeFileSync|createStudioActivity|getActivityRepository|ingestAutomationEvent|fanoutActivityEmission|resolveActivityEntity|upsertActivityEntity/
  const httpPlugin = existsSync(join(root, 'server', 'integrationsMailboxPlugin.js'))
  assert(
    '10. no vendor SDK, network, persistence, or HTTP plugin',
    !vendorSdk.test(mailboxSource) &&
      !network.test(mailboxSource) &&
      !persist.test(mailboxSource) &&
      !httpPlugin &&
      !existsSync(join(root, 'src', 'integrations', 'mailbox', 'store.js')),
  )
}

{
  assert(
    '11. mailbox is not a TimelineSource and capabilities stay honest',
    MAILBOX_SOURCE_ID === 'email_mailbox' &&
      !TIMELINE_SOURCE_IDS.includes(MAILBOX_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('mailbox') &&
      INTEGRATION_CAPABILITIES.emailDelivery === false &&
      INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
      INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
      !Object.prototype.hasOwnProperty.call(INTEGRATION_CAPABILITIES, 'emailMailbox'),
  )
}

{
  const dataAfter = dataFingerprint()
  const activitiesAfter = hashFile(join(root, 'data', 'activities.json'))
  const proposalsAfter = hashFile(join(root, 'data', 'proposals.json'))
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '12. making envelopes has no persistence side effects',
    dataBefore === dataAfter &&
      activitiesBefore === activitiesAfter &&
      proposalsBefore === proposalsAfter &&
      dataStatus.status === 0 &&
      !(dataStatus.stdout || '').trim(),
  )
}

{
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-mailbox.mjs'), 'utf8')
  assert(
    '13. this suite does not nest H16.7–H16.11 verifiers',
    !/spawnSync\([^)]*verify-integrations-(activities|persistence|activity-authoring|activity-authoring-http|entity-resolution|activity-intake)\.mjs/.test(
      ownSource,
    ),
  )
}

{
  const long = `Thanks ${'x'.repeat(2000)}`
  const fromText = makeInboundMailboxMessage(envelope({ text: long, snippet: undefined }))
  const fromBody = makeInboundMailboxMessage(
    envelope({ text: undefined, snippet: undefined, body: 'Plain body alias.' }),
  )
  const nested = makeInboundMailboxMessage(
    envelope({
      text: undefined,
      snippet: undefined,
      bodyRef: undefined,
      content: {
        mediaType: MAILBOX_CONTENT_MEDIA_TYPE.TEXT_PLAIN,
        text: 'Nested plain text.',
        snippet: 'Nested',
        ref: 'content:ref-2',
      },
    }),
  )
  const blob = threw(() =>
    makeInboundMailboxMessage(envelope({ body: { mime: 'multipart' } })),
  )
  assert(
    '14. bounded plain-text content is accepted and raw blobs are rejected',
    fromText.content.text.length === MAILBOX_LIMITS.MAX_TEXT &&
      fromText.content.snippet.length === MAILBOX_LIMITS.MAX_SNIPPET &&
      fromText.content.snippet === fromText.content.text.slice(0, MAILBOX_LIMITS.MAX_SNIPPET) &&
      fromBody.content.text === 'Plain body alias.' &&
      nested.content.text === 'Nested plain text.' &&
      nested.content.ref === 'content:ref-2' &&
      blob instanceof ValidationError &&
      blob.errors?.[0]?.field === 'body',
  )
}

console.log('')
console.log(`H16.12 mailbox envelope checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
