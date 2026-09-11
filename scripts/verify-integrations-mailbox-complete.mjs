/**
 * H16.12 Slice 12.4 — Email mailbox source boundary completion.
 *
 * Independent suite. Does not nest H16.7–H16.12 verifiers. Proves the
 * inbound mailbox contract is complete without a provider, store,
 * TimelineSource, HTTP plugin, or outbound-mail rewrite.
 * Never writes data/proposals.json or activities.json.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import * as mailboxApi from '../src/integrations/mailbox/index.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_SOURCE_DOMAIN,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  INTEGRATION_KINDS,
  MAILBOX_INGEST_STATUS,
  MAILBOX_RECIPIENT_ROLE,
  MAILBOX_SOURCE_ID,
  NULL_INTEGRATION_ADAPTER_IDS,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  createMemoryActivityRepository,
  createNativeActivityTimelineSource,
  getTimelineSource,
  ingestInboundMailboxMessage,
  listAcceptedAutomationEventsForCompany,
  listStudioTimeline,
  mapMailboxMessageToStudioActivityInput,
  onAutomationEventAccepted,
  registerActivityRepository,
  registerTimelineSource,
  resetActivityRepository,
  resetAutomationIntakeStore,
  resetTimelineSources,
  setAutomationEventAcceptedListener,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const studio = DEFAULT_COMPANY_ID
const occurredAt = '2026-09-11T16:00:00.000Z'
const knownSubject = Object.freeze({
  type: ACTIVITY_SUBJECT_TYPE.CONTACT,
  id: 'contact-1',
})
const allowedMailboxExports = Object.freeze([
  'MAILBOX_SCHEMA_VERSION',
  'MAILBOX_SOURCE_ID',
  'MAILBOX_SOURCE_DOMAIN',
  'MAILBOX_SOURCE_ENTITY_TYPE',
  'MAILBOX_ACTIVITY_KIND',
  'MAILBOX_ACTIVITY_TYPE',
  'MAILBOX_DIRECTION',
  'MAILBOX_DIRECTIONS',
  'MAILBOX_RECIPIENT_ROLE',
  'MAILBOX_RECIPIENT_ROLES',
  'MAILBOX_CONTENT_MEDIA_TYPE',
  'MAILBOX_CONTENT_MEDIA_TYPES',
  'MAILBOX_LIMITS',
  'MAILBOX_FORBIDDEN_FIELDS',
  'MAILBOX_FORBIDDEN_CONTENT_FIELDS',
  'MAILBOX_INGEST_STATUS',
  'MAILBOX_INGEST_STATUSES',
  'makeMailboxIdempotencyKey',
  'makeInboundMailboxMessage',
  'cloneInboundMailboxMessage',
  'isMailboxSubjectSupplied',
  'makeNativeMailboxIdempotencyKey',
  'mapMailboxMessageToStudioActivityInput',
  'ingestInboundMailboxMessage',
])

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

function importLines(source) {
  return source
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line))
    .join('\n')
}

function envelope(extra = {}) {
  return {
    companyId: studio,
    mailboxId: 'mailbox-studio-inbox',
    externalMessageId: 'ext-msg-complete',
    threadId: 'ext-thread-complete',
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
    occurredAt,
    ...extra,
  }
}

function resetNativePath() {
  resetActivityRepository()
  activities = createMemoryActivityRepository()
  registerActivityRepository(activities)
  resetTimelineSources()
  registerTimelineSource(createNativeActivityTimelineSource())
  resetAutomationIntakeStore()
  setAutomationEventAcceptedListener(onAutomationEventAccepted)
}

const mailboxDir = join(root, 'src', 'integrations', 'mailbox')
const mailboxSource = collectJs(mailboxDir)
const mailboxImports = importLines(mailboxSource)
const ingestSource = readFileSync(join(mailboxDir, 'ingest.js'), 'utf8')
const mapSource = readFileSync(join(mailboxDir, 'map.js'), 'utf8')
const mailboxFiles = readdirSync(mailboxDir).filter((name) => name.endsWith('.js')).sort()
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

resetNativePath()

console.log('— H16.12.4 mailbox source boundary —')

{
  assert(
    '1. mailbox does not import outbound src/services/email',
    !/from\s+['"][^'"]*services\/email/.test(mailboxImports) &&
      !mailboxImports.includes('mailProvider') &&
      !mailboxImports.includes('sendProposalEmail') &&
      !mailboxSource.includes('MAIL_PROVIDER'),
  )
}

{
  assert(
    '2. no emailMailbox capability; delivery/oauth/calendar/SDK/workers stay false',
    !Object.prototype.hasOwnProperty.call(INTEGRATION_CAPABILITIES, 'emailMailbox') &&
      !Object.prototype.hasOwnProperty.call(INTEGRATION_CAPABILITIES, 'mailbox') &&
      INTEGRATION_CAPABILITIES.emailDelivery === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
      INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false,
  )
}

{
  assert(
    '3. email_mailbox is not a TimelineSource; native_activity remains the read path',
    MAILBOX_SOURCE_ID === 'email_mailbox' &&
      TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      !TIMELINE_SOURCE_IDS.includes(MAILBOX_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('mailbox') &&
      getTimelineSource(MAILBOX_SOURCE_ID) == null &&
      getTimelineSource('mailbox') == null &&
      createNativeActivityTimelineSource().id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      !existsSync(join(root, 'src', 'integrations', 'activities', 'sources', 'emailMailbox.js')),
  )
}

{
  const mailboxStoreFiles = [
    'store.js',
    'memory.js',
    'postgres.js',
    'repository.js',
    'port.js',
  ].filter((name) => existsSync(join(mailboxDir, name)))
  assert(
    '4. no mailbox store or second ActivityRepository',
    mailboxStoreFiles.length === 0 &&
      mailboxFiles.join(',') === 'index.js,ingest.js,map.js,schema.js,types.js' &&
      !mailboxSource.includes('createMemoryActivityRepository') &&
      !mailboxSource.includes('createPostgresActivityRepository') &&
      !existsSync(join(root, 'data', 'mailbox.json')) &&
      !existsSync(join(root, 'data', 'mailbox_messages.json')),
  )
}

{
  const vendorSdk =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud)/i
  assert(
    '5. no mailbox HTTP plugin, vendor SDK, OAuth, or null_mailbox adapter',
    !existsSync(join(root, 'server', 'integrationsMailboxPlugin.js')) &&
      !existsSync(join(mailboxDir, 'adapters.js')) &&
      !existsSync(join(mailboxDir, 'provider.js')) &&
      !existsSync(join(mailboxDir, 'oauth.js')) &&
      !vendorSdk.test(mailboxSource) &&
      !/\bfetch\s*\(|\baxios\b|\bnode:https\b/.test(mailboxSource) &&
      !NULL_INTEGRATION_ADAPTER_IDS.includes('null_mailbox') &&
      !Object.values(NULL_INTEGRATION_ADAPTER_IDS).includes('null_mailbox'),
  )
}

{
  assert(
    '6. no mailbox INTEGRATION_KIND or adapter registration',
    !Object.prototype.hasOwnProperty.call(INTEGRATION_KIND, 'MAILBOX') &&
      !INTEGRATION_KINDS.includes('mailbox') &&
      !INTEGRATION_KINDS.includes('email_mailbox') &&
      INTEGRATION_KIND.CALENDAR === 'calendar' &&
      INTEGRATION_KIND.DELIVERY === 'delivery',
  )
}

{
  const exported = Object.keys(mailboxApi).sort()
  assert(
    '7. mailbox barrel exports only the envelope/ingest surface',
    exported.join(',') === [...allowedMailboxExports].sort().join(',') &&
      typeof mailboxApi.ingestInboundMailboxMessage === 'function' &&
      typeof mailboxApi.makeInboundMailboxMessage === 'function' &&
      typeof mailboxApi.mapMailboxMessageToStudioActivityInput === 'function' &&
      !exported.includes('createMailboxAdapter') &&
      !exported.includes('registerMailboxProvider') &&
      !exported.includes('pollMailbox'),
  )
}

{
  const approvedFacadeImport =
    /import\s*\{\s*createStudioActivity\s*\}\s*from\s*['"]\.\.\/activities\/authoring\.js['"]/
  assert(
    '8. createStudioActivity remains the only correlated mailbox write seam',
    approvedFacadeImport.test(importLines(ingestSource)) &&
      ingestSource.includes('createStudioActivity(mapMailboxMessageToStudioActivityInput') &&
      !importLines(ingestSource).includes('getActivityRepository') &&
      !importLines(mapSource).includes('createStudioActivity') &&
      !mailboxSource.includes('emitNativeActivityCreated') &&
      !mailboxSource.includes('ingestAutomationEvent'),
  )
}

{
  resetNativePath()
  const mapped = mapMailboxMessageToStudioActivityInput(
    envelope({ externalMessageId: 'ext-msg-boundary' }),
    knownSubject,
  )
  const result = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-boundary' }),
    knownSubject,
  )
  const created = result.activity
  const page = await listStudioTimeline({
    companyId: studio,
    kinds: [ACTIVITY_KIND.EMAIL],
  })
  const entry = page.entries.find(
    (row) => row.attributes?.externalMessageId === 'ext-msg-boundary',
  )
  const accepted = listAcceptedAutomationEventsForCompany(studio)
  assert(
    '9. correlated mail is Native Activity → H16.11 → native_activity; tenant is not the subject',
    result.ingested === true &&
      created.kind === ACTIVITY_KIND.EMAIL &&
      created.type === ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED &&
      created.companyId === studio &&
      created.subject.type === knownSubject.type &&
      created.subject.id === knownSubject.id &&
      created.subject.id !== created.companyId &&
      mapped.subject.id !== mapped.companyId &&
      mapped.subject.id !== 'mailbox-studio-inbox' &&
      mapped.subject.id !== 'ext-msg-boundary' &&
      entry?.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      entry?.sourceId !== MAILBOX_SOURCE_ID &&
      accepted.length === 1 &&
      accepted[0].type === 'activity.email.logged' &&
      accepted[0].source.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      !String(accepted[0].type).startsWith('mailbox.'),
  )
}

{
  resetNativePath()
  const result = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-uncorrelated' }),
  )
  const listed = await activities.list({ companyId: studio })
  const page = await listStudioTimeline({
    companyId: studio,
    kinds: [ACTIVITY_KIND.EMAIL],
  })
  assert(
    '10. uncorrelated mail is not stored, not projected, and invents no subject',
    result.ingested === false &&
      result.status === MAILBOX_INGEST_STATUS.UNCORRELATED &&
      result.activity === null &&
      !Object.prototype.hasOwnProperty.call(result, 'subject') &&
      listed.entries.length === 0 &&
      page.entries.length === 0 &&
      listAcceptedAutomationEventsForCompany(studio).length === 0,
  )
}

console.log('')
console.log('— inspection boundaries —')

{
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-mailbox-complete.mjs'), 'utf8')
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '11. mailbox does not resolve H16.10 entities or use tenant/mailbox ids as CRM subjects',
    !mailboxSource.includes('resolveActivityEntity') &&
      !mailboxSource.includes('upsertActivityEntity') &&
      !mailboxSource.includes('getActivityEntity') &&
      !/\bid:\s*message\.companyId\b/.test(mapSource) &&
      !/\bid:\s*message\.mailboxId\b/.test(mapSource) &&
      !/\bid:\s*message\.externalMessageId\b/.test(mapSource),
  )
  assert(
    '12. this suite is independent and does not nest other verifiers',
    !/spawnSync\([^)]*verify-integrations-(activities|persistence|activity-authoring|activity-authoring-http|entity-resolution|activity-intake|mailbox|mailbox-ingest|mailbox-timeline)\.mjs/.test(
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
resetTimelineSources()
setAutomationEventAcceptedListener(onAutomationEventAccepted)

console.log('')
console.log(`H16.12 mailbox complete checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
