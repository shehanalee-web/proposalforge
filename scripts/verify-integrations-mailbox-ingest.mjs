/**
 * H16.12 Slice 12.2 — Mailbox envelope → Native Activity ingest.
 *
 * Independent suite. Does not nest H16.7–H16.11. Uses the memory repository
 * only. Never writes data/proposals.json or activities.json.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_INTAKE_STATUS,
  INTEGRATION_CAPABILITIES,
  MAILBOX_ACTIVITY_KIND,
  MAILBOX_ACTIVITY_TYPE,
  MAILBOX_CONTENT_MEDIA_TYPE,
  MAILBOX_INGEST_STATUS,
  MAILBOX_LIMITS,
  MAILBOX_RECIPIENT_ROLE,
  MAILBOX_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  archiveStudioActivity,
  createMemoryActivityRepository,
  ingestInboundMailboxMessage,
  listAcceptedAutomationEventsForCompany,
  mapMailboxMessageToStudioActivityInput,
  makeInboundMailboxMessage,
  makeMailboxIdempotencyKey,
  makeNativeMailboxIdempotencyKey,
  onAutomationEventAccepted,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
  setAutomationEventAcceptedListener,
  updateStudioActivity,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const occurredAt = '2026-09-11T14:00:00.000Z'
const knownSubject = Object.freeze({
  type: ACTIVITY_SUBJECT_TYPE.CONTACT,
  id: 'contact-1',
})
const companyEntitySubject = Object.freeze({
  type: ACTIVITY_SUBJECT_TYPE.COMPANY,
  id: 'company-1',
})

let passed = 0
let failed = 0
let activities

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

async function caught(run) {
  try {
    await run()
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
    externalMessageId: 'ext-msg-200',
    threadId: 'ext-thread-12',
    rfcMessageId: '<200@example.test>',
    sender: { email: 'Alex@Client.test', displayName: 'Alex Client' },
    recipients: [
      {
        email: 'studio@proposalforge.test',
        displayName: 'Studio',
        role: MAILBOX_RECIPIENT_ROLE.TO,
      },
    ],
    subject: 'Follow up on the proposal',
    text: 'Thanks for sending this over. We can review on Tuesday.',
    snippet: 'Thanks for sending this over.',
    bodyRef: 'content:mailbox-studio-inbox:ext-msg-200',
    occurredAt,
    receivedAt: '2026-09-11T14:01:00.000Z',
    ...extra,
  }
}

function eventsFor(companyId = studio) {
  return listAcceptedAutomationEventsForCompany(companyId)
}

function resetNativeStore() {
  resetActivityRepository()
  activities = createMemoryActivityRepository()
  registerActivityRepository(activities)
}

async function ingestCorrelated(extra = {}, subject = knownSubject) {
  return ingestInboundMailboxMessage(envelope(extra), subject)
}

const mailboxDir = join(root, 'src', 'integrations', 'mailbox')
const mailboxSource = collectJs(mailboxDir)
const ingestSource = readFileSync(join(mailboxDir, 'ingest.js'), 'utf8')
const mapSource = readFileSync(join(mailboxDir, 'map.js'), 'utf8')
const authoringSource = readFileSync(
  join(root, 'src', 'integrations', 'activities', 'authoring.js'),
  'utf8',
)
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

resetNativeStore()
resetAutomationIntakeStore()
setAutomationEventAcceptedListener(onAutomationEventAccepted)

console.log('— A. correlated mailbox → native activity —')

{
  resetAutomationIntakeStore()
  const result = await ingestCorrelated()
  const created = result.activity
  const accepted = eventsFor(studio)
  assert(
    '1. correlated message creates exactly one native email Activity',
    result.ingested === true &&
      result.status === MAILBOX_INGEST_STATUS.INGESTED &&
      String(created.id).startsWith('act-') &&
      created.kind === ACTIVITY_KIND.EMAIL &&
      created.type === ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED &&
      MAILBOX_ACTIVITY_KIND === 'email' &&
      MAILBOX_ACTIVITY_TYPE === 'email.logged' &&
      accepted.length === 1,
  )
}

{
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-kind' })).activity
  assert(
    '2. resulting Activity has kind=email and type=email.logged',
    created.kind === 'email' && created.type === 'email.logged',
  )
}

{
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-company' })).activity
  assert(
    '3. tenant companyId is preserved separately from subject',
    created.companyId === studio &&
      created.subject.type === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      created.subject.id === 'contact-1' &&
      created.subject.id !== created.companyId,
  )
}

{
  const mapped = mapMailboxMessageToStudioActivityInput(envelope(), knownSubject)
  const companyMapped = mapMailboxMessageToStudioActivityInput(
    envelope({ externalMessageId: 'ext-msg-company-entity' }),
    companyEntitySubject,
  )
  const message = makeInboundMailboxMessage(envelope())
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-map' })).activity
  assert(
    '4. supplied subject is preserved exactly and is not mailbox identity',
    mapped.subject.type === knownSubject.type &&
      mapped.subject.id === knownSubject.id &&
      mapped.companyId === studio &&
      mapped.subject.id !== mapped.companyId &&
      mapped.subject.id !== message.mailboxId &&
      mapped.subject.id !== message.externalMessageId &&
      companyMapped.subject.type === ACTIVITY_SUBJECT_TYPE.COMPANY &&
      companyMapped.subject.id === 'company-1' &&
      companyMapped.subject.id !== companyMapped.companyId &&
      created.subject.type === knownSubject.type &&
      created.subject.id === knownSubject.id &&
      created.companyId === studio,
  )
}

{
  const mapped = mapMailboxMessageToStudioActivityInput(envelope(), knownSubject)
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-map-content' })).activity
  assert(
    '5. sender, recipient, and content mapping is deterministic',
    mapped.subjectLine === 'Follow up on the proposal' &&
      mapped.body === 'Thanks for sending this over. We can review on Tuesday.' &&
      mapped.participants[0].role === 'from' &&
      mapped.participants[0].id === 'alex@client.test' &&
      mapped.participants[0].type === 'email' &&
      mapped.participants[1].role === MAILBOX_RECIPIENT_ROLE.TO &&
      mapped.participants[1].id === 'studio@proposalforge.test' &&
      created.subjectLine === mapped.subjectLine &&
      created.body === mapped.body &&
      created.attributes.mailboxId === 'mailbox-studio-inbox' &&
      created.attributes.externalMessageId === 'ext-msg-map-content' &&
      created.attributes.threadId === 'ext-thread-12' &&
      created.attributes.bodyRef === 'content:mailbox-studio-inbox:ext-msg-200' &&
      created.attributes.senderEmail === 'alex@client.test' &&
      makeInboundMailboxMessage(envelope()).content.mediaType ===
        MAILBOX_CONTENT_MEDIA_TYPE.TEXT_PLAIN,
  )
}

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const first = (await ingestCorrelated({ externalMessageId: 'ext-msg-replay' })).activity
  const second = (await ingestCorrelated({ externalMessageId: 'ext-msg-replay' })).activity
  const accepted = eventsFor(studio)
  const mailboxKey = makeMailboxIdempotencyKey({
    companyId: studio,
    mailboxId: 'mailbox-studio-inbox',
    externalMessageId: 'ext-msg-replay',
  })
  assert(
    '6. same mailbox + externalMessageId replay is idempotent',
    first.id === second.id &&
      first.idempotencyKey === mailboxKey &&
      second.idempotencyKey === first.idempotencyKey &&
      makeNativeMailboxIdempotencyKey(
        makeInboundMailboxMessage(envelope({ externalMessageId: 'ext-msg-replay' })),
      ) === mailboxKey &&
      accepted.length === 1 &&
      accepted[0].sourceEventIdentity === first.id &&
      accepted[0].intake.status === AUTOMATION_INTAKE_STATUS.ACCEPTED,
  )
}

{
  const left = (await ingestCorrelated({ externalMessageId: 'ext-msg-a' })).activity
  const right = (await ingestCorrelated({ externalMessageId: 'ext-msg-b' })).activity
  assert(
    '7. different externalMessageIds create distinct Activities',
    left.id !== right.id &&
      left.attributes.externalMessageId === 'ext-msg-a' &&
      right.attributes.externalMessageId === 'ext-msg-b',
  )
}

{
  const studioRow = (await ingestCorrelated({ externalMessageId: 'ext-msg-tenant' })).activity
  const other = (
    await ingestInboundMailboxMessage(
      envelope({ companyId: otherCompany, externalMessageId: 'ext-msg-tenant' }),
      knownSubject,
    )
  ).activity
  assert(
    '8. different companyIds cannot collide',
    studioRow.id !== other.id &&
      studioRow.companyId === studio &&
      other.companyId === otherCompany &&
      studioRow.idempotencyKey !== other.idempotencyKey,
  )
}

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const result = await ingestCorrelated({ externalMessageId: 'ext-msg-intake' })
  const created = result.activity
  await ingestCorrelated({ externalMessageId: 'ext-msg-intake' })
  const accepted = eventsFor(studio)
  const event = accepted[0]
  assert(
    '9. correlated create uses createStudioActivity / H16.11; replay is not a second accepted event',
    ingestSource.includes('createStudioActivity') &&
      ingestSource.includes('mapMailboxMessageToStudioActivityInput') &&
      ingestSource.includes('createStudioActivity(mapMailboxMessageToStudioActivityInput') &&
      !ingestSource.includes('emitNativeActivityCreated') &&
      !ingestSource.includes('fanoutActivityEmission') &&
      !ingestSource.includes('ingestAutomationEvent') &&
      authoringSource.includes('emitNativeActivityCreated') &&
      accepted.length === 1 &&
      event?.type === 'activity.email.logged' &&
      event.source.domain === 'activity' &&
      event.sourceEventIdentity === created.id &&
      event.payload.kind === 'email' &&
      event.payload.type === 'email.logged',
  )
}

console.log('')
console.log('— B. uncorrelated mailbox is not ingested —')

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const listedBefore = await activities.list({ companyId: studio })
  const omitted = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-uncorrelated' }),
  )
  const explicitNull = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-uncorrelated-null' }),
    null,
  )
  const empty = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-uncorrelated-empty' }),
    {},
  )
  const listedAfter = await activities.list({ companyId: studio })
  assert(
    '10. missing subject returns uncorrelated and does not create a Native Activity',
    omitted.ingested === false &&
      omitted.status === MAILBOX_INGEST_STATUS.UNCORRELATED &&
      omitted.activity === null &&
      explicitNull.status === MAILBOX_INGEST_STATUS.UNCORRELATED &&
      empty.status === MAILBOX_INGEST_STATUS.UNCORRELATED &&
      listedBefore.entries.length === 0 &&
      listedAfter.entries.length === 0 &&
      eventsFor(studio).length === 0,
  )
}

{
  const result = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-no-fake-subject' }),
  )
  const serialized = JSON.stringify(result)
  assert(
    '11. uncorrelated result does not invent a subject or emit H16.11',
    result.ingested === false &&
      result.activity === null &&
      !Object.prototype.hasOwnProperty.call(result, 'subject') &&
      !serialized.includes('contact-1') &&
      !serialized.includes(studio) &&
      !serialized.includes('mailbox-studio-inbox') &&
      eventsFor(studio).length === 0,
  )
}

console.log('')
console.log('— rejection and sanitization —')

{
  const missing = threw(() =>
    mapMailboxMessageToStudioActivityInput(envelope({ companyId: '' }), knownSubject),
  )
  const vendor = threw(() =>
    mapMailboxMessageToStudioActivityInput(envelope({ gmailMessageId: 'gmsg-1' }), knownSubject),
  )
  const ingestFail = await caught(() =>
    ingestInboundMailboxMessage(envelope({ html: '<p>hi</p>' })),
  )
  const badType = threw(() =>
    mapMailboxMessageToStudioActivityInput(envelope(), {
      type: 'mailbox',
      id: 'mailbox-studio-inbox',
    }),
  )
  const incomplete = threw(() =>
    mapMailboxMessageToStudioActivityInput(envelope(), { type: ACTIVITY_SUBJECT_TYPE.CONTACT }),
  )
  assert(
    '12. malformed envelopes and invalid subjects fail deterministically',
    missing instanceof ValidationError &&
      missing.errors?.[0]?.field === 'companyId' &&
      vendor instanceof ValidationError &&
      vendor.errors?.[0]?.field === 'gmailMessageId' &&
      ingestFail instanceof ValidationError &&
      ingestFail.errors?.[0]?.field === 'html' &&
      badType instanceof ValidationError &&
      badType.errors?.[0]?.field === 'subject.type' &&
      incomplete instanceof ValidationError &&
      incomplete.errors?.[0]?.field === 'subject.id',
  )
}

{
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-neutral' })).activity
  const serialized = JSON.stringify(created)
  assert(
    '13. provider-specific fields cannot leak into the Activity',
    !Object.prototype.hasOwnProperty.call(created, 'gmailMessageId') &&
      !Object.prototype.hasOwnProperty.call(created, 'outlookId') &&
      !Object.prototype.hasOwnProperty.call(created, 'html') &&
      !Object.prototype.hasOwnProperty.call(created.attributes, 'gmailMessageId') &&
      !/gmail|outlook|graph|google|microsoft/i.test(serialized) &&
      created.source.domain === 'activity' &&
      created.source.entityType === 'activity' &&
      created.source.entityId === created.id,
  )
}

{
  const long = `Thanks ${'x'.repeat(2000)}`
  const created = (
    await ingestCorrelated({
      externalMessageId: 'ext-msg-bound',
      text: long,
      snippet: undefined,
    })
  ).activity
  assert(
    '14. content remains bounded and sanitized',
    created.body.length === MAILBOX_LIMITS.MAX_TEXT &&
      created.body === long.trim().slice(0, MAILBOX_LIMITS.MAX_TEXT) &&
      created.subjectLine.length <= MAILBOX_LIMITS.MAX_SUBJECT,
  )
}

console.log('')
console.log('— H16.11 emission and boundaries —')

{
  resetAutomationIntakeStore()
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-patch' })).activity
  const before = eventsFor(studio).length
  const patched = await updateStudioActivity(
    created.id,
    { subjectLine: 'Edited subject' },
    studio,
  )
  const archived = await archiveStudioActivity(created.id, studio)
  assert(
    '15. PATCH and archive remain unchanged and do not ingest',
    patched.id === created.id &&
      patched.subjectLine === 'Edited subject' &&
      archived.archivedAt != null &&
      eventsFor(studio).length === before,
  )
}

{
  assert(
    '16. no new TimelineSource is registered and capabilities stay honest',
    MAILBOX_SOURCE_ID === 'email_mailbox' &&
      !TIMELINE_SOURCE_IDS.includes(MAILBOX_SOURCE_ID) &&
      !mapSource.includes('registerTimelineSource') &&
      !ingestSource.includes('registerTimelineSource') &&
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
  const vendorSdk =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud)/i
  const httpPlugin = existsSync(join(root, 'server', 'integrationsMailboxPlugin.js'))
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-mailbox-ingest.mjs'), 'utf8')
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '17. mapper does not derive subject from tenant or mailbox identity; no H16.10 lookup',
    !/\bid:\s*message\.companyId\b/.test(mapSource) &&
      !/\bid:\s*message\.mailboxId\b/.test(mapSource) &&
      !/\bid:\s*message\.externalMessageId\b/.test(mapSource) &&
      !mapSource.includes('resolveActivityEntity') &&
      !ingestSource.includes('resolveActivityEntity') &&
      !mailboxSource.includes('upsertActivityEntity') &&
      !mailboxSource.includes('getActivityEntity'),
  )
  assert(
    '18. no vendor SDK, HTTP, mailbox store, or nested H16.7–H16.11 verifiers',
    !vendorSdk.test(mailboxSource) &&
      !httpPlugin &&
      !existsSync(join(mailboxDir, 'store.js')) &&
      !/spawnSync\([^)]*verify-integrations-(activities|persistence|activity-authoring|activity-authoring-http|entity-resolution|activity-intake|mailbox)\.mjs/.test(
        ownSource,
      ) &&
      dataBefore === dataAfter &&
      activitiesBefore === hashFile(join(root, 'data', 'activities.json')) &&
      proposalsBefore === hashFile(join(root, 'data', 'proposals.json')) &&
      dataStatus.status === 0 &&
      !(dataStatus.stdout || '').trim(),
  )
}

resetAutomationIntakeStore()
resetActivityRepository()
setAutomationEventAcceptedListener(onAutomationEventAccepted)

console.log('')
console.log(`H16.12 mailbox ingest checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
