/**
 * H16.13 Slice 13.4 — Calendar source boundary completion.
 *
 * Independent suite. Does not nest H16.7–H16.13 verifiers. Proves the
 * inbound calendar contract is complete without a provider, store,
 * TimelineSource, HTTP plugin, OAuth, or outbound-mail rewrite.
 * Never writes data/proposals.json or activities.json.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import * as calendarApi from '../src/integrations/calendar/index.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_SOURCE_DOMAIN,
  CALENDAR_INGEST_STATUS,
  CALENDAR_SOURCE_ID,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  INTEGRATION_KINDS,
  MAILBOX_INGEST_STATUS,
  MAILBOX_RECIPIENT_ROLE,
  MAILBOX_SOURCE_ID,
  NULL_INTEGRATION_ADAPTER_ID,
  NULL_INTEGRATION_ADAPTER_IDS,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  createMemoryActivityRepository,
  createNativeActivityTimelineSource,
  createNullCalendarAdapter,
  getIntegrationAdapter,
  getTimelineSource,
  ingestInboundCalendarEvent,
  ingestInboundMailboxMessage,
  listAcceptedAutomationEventsForCompany,
  listIntegrationAdapters,
  listStudioTimeline,
  mapCalendarEventToStudioActivityInput,
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
const startsAt = '2026-09-12T14:00:00.000Z'
const endsAt = '2026-09-12T15:00:00.000Z'
const knownSubject = Object.freeze({
  type: ACTIVITY_SUBJECT_TYPE.CONTACT,
  id: 'contact-1',
})
const allowedCalendarExports = Object.freeze([
  'CALENDAR_SCHEMA_VERSION',
  'CALENDAR_SOURCE_ID',
  'CALENDAR_SOURCE_DOMAIN',
  'CALENDAR_SOURCE_ENTITY_TYPE',
  'CALENDAR_ACTIVITY_KIND',
  'CALENDAR_ACTIVITY_TYPE',
  'CALENDAR_CONTENT_MEDIA_TYPE',
  'CALENDAR_CONTENT_MEDIA_TYPES',
  'CALENDAR_LIMITS',
  'CALENDAR_FORBIDDEN_FIELDS',
  'CALENDAR_FORBIDDEN_CONTENT_FIELDS',
  'CALENDAR_INGEST_STATUS',
  'CALENDAR_INGEST_STATUSES',
  'makeCalendarIdempotencyKey',
  'makeInboundCalendarEvent',
  'cloneInboundCalendarEvent',
  'isCalendarSubjectSupplied',
  'makeNativeCalendarIdempotencyKey',
  'mapCalendarEventToStudioActivityInput',
  'ingestInboundCalendarEvent',
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

function gitDiff(paths) {
  return spawnSync('git', ['diff', '--', ...paths], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function envelope(extra = {}) {
  return {
    companyId: studio,
    calendarId: 'calendar-studio-primary',
    externalEventId: 'ext-evt-complete',
    title: 'Kickoff with the client',
    snippet: 'Align on scope and timeline.',
    description: 'Align on scope and timeline for the proposal.',
    startsAt,
    endsAt,
    timezone: 'UTC',
    organizer: { email: 'Studio@Proposalforge.test', displayName: 'Studio' },
    attendees: [
      { email: 'Alex@Client.test', displayName: 'Alex Client' },
    ],
    ...extra,
  }
}

function mailboxEnvelope(extra = {}) {
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
    occurredAt: startsAt,
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

const calendarDir = join(root, 'src', 'integrations', 'calendar')
const mailboxDir = join(root, 'src', 'integrations', 'mailbox')
const calendarSource = collectJs(calendarDir)
const calendarImports = importLines(calendarSource)
const ingestSource = readFileSync(join(calendarDir, 'ingest.js'), 'utf8')
const mapSource = readFileSync(join(calendarDir, 'map.js'), 'utf8')
const authoringSource = readFileSync(
  join(root, 'src', 'integrations', 'activities', 'authoring.js'),
  'utf8',
)
const calendarFiles = readdirSync(calendarDir)
  .filter((name) => name.endsWith('.js'))
  .sort()
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))
const vendorSdk =
  /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud|google-auth-library|@azure\/identity)/i
const network =
  /\bfetch\s*\(|\baxios\b|\bnode:https\b|\bnode:http\b|XMLHttpRequest/
const writeOps =
  /writeFileSync|appendFileSync|createWriteStream|mkdirSync|writeFile\s*\(/
const approvedFacadeImport =
  /import\s*\{\s*createStudioActivity\s*\}\s*from\s*['"]\.\.\/activities\/authoring\.js['"]/

resetNativePath()

console.log('— H16.13.4 calendar source boundary —')

{
  assert(
    '1. calendar does not import or modify outbound src/services/email',
    !/from\s+['"][^'"]*services\/email/.test(calendarImports) &&
      !calendarImports.includes('mailProvider') &&
      !calendarImports.includes('sendProposalEmail') &&
      !calendarSource.includes('MAIL_PROVIDER') &&
      !calendarSource.includes('sendProposalEmail') &&
      !calendarImports.includes('/mailbox/') &&
      gitDiff(['src/services/email']).status === 0 &&
      !(gitDiff(['src/services/email']).stdout || '').trim(),
  )
}

{
  assert(
    '2. no OAuth implementation',
    INTEGRATION_CAPABILITIES.oauth === false &&
      !existsSync(join(calendarDir, 'oauth.js')) &&
      !/\boauth2?\b/i.test(calendarImports) &&
      !/from\s+['"][^'"]*(?:google-auth-library|@azure\/identity|openid-client)['"]/.test(
        calendarImports,
      ) &&
      createNullCalendarAdapter().describe().oauth === false,
  )
}

{
  assert(
    '3. no real provider SDK or runtime',
    !vendorSdk.test(calendarSource) &&
      !existsSync(join(calendarDir, 'provider.js')) &&
      !existsSync(join(calendarDir, 'adapters.js')) &&
      !existsSync(join(calendarDir, 'google.js')) &&
      !existsSync(join(calendarDir, 'graph.js')) &&
      !existsSync(join(root, 'server', 'integrationsCalendarPlugin.js')) &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false,
  )
}

{
  assert(
    '4. no provider credentials, tokens, HTTP client, or external calendar API calls',
    !network.test(calendarSource) &&
      !writeOps.test(calendarSource) &&
      !network.test(ingestSource) &&
      !network.test(mapSource) &&
      createNullCalendarAdapter().describe().network === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false,
  )
}

{
  const calendarAdapters = listIntegrationAdapters(INTEGRATION_KIND.CALENDAR)
  const registered = getIntegrationAdapter(
    INTEGRATION_KIND.CALENDAR,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR],
  )
  assert(
    '5. INTEGRATION_CAPABILITIES.calendar remains false',
    INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.emailDelivery === false &&
      !Object.prototype.hasOwnProperty.call(INTEGRATION_CAPABILITIES, 'emailMailbox') &&
      INTEGRATION_KIND.CALENDAR === 'calendar' &&
      INTEGRATION_KINDS.includes('calendar') &&
      NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR] === 'null_calendar' &&
      NULL_INTEGRATION_ADAPTER_IDS.includes('null_calendar') &&
      calendarAdapters.length === 1 &&
      calendarAdapters[0].id === 'null_calendar' &&
      calendarAdapters[0].isEnabled({}) === false &&
      registered != null &&
      registered.isEnabled({}) === false,
  )
}

{
  const exported = Object.keys(calendarApi).sort()
  assert(
    '6. no Calendar TimelineSource may be introduced',
    CALENDAR_SOURCE_ID === 'inbound_calendar' &&
      getTimelineSource(CALENDAR_SOURCE_ID) == null &&
      getTimelineSource('calendar') == null &&
      getTimelineSource('inbound_calendar') == null &&
      createNativeActivityTimelineSource().id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      !existsSync(join(calendarDir, 'timeline.js')) &&
      !existsSync(join(root, 'src', 'integrations', 'activities', 'sources', 'calendar.js')) &&
      !existsSync(
        join(root, 'src', 'integrations', 'activities', 'sources', 'inboundCalendar.js'),
      ) &&
      !calendarSource.includes('registerTimelineSource') &&
      exported.join(',') === [...allowedCalendarExports].sort().join(',') &&
      !exported.includes('createCalendarAdapter') &&
      !exported.includes('registerCalendarProvider') &&
      !exported.includes('pollCalendar'),
  )
}

{
  assert(
    '7. TIMELINE_SOURCE_IDS remains unchanged; native_activity is canonical',
    TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      !TIMELINE_SOURCE_IDS.includes(CALENDAR_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('calendar') &&
      !TIMELINE_SOURCE_IDS.includes('inbound_calendar') &&
      !TIMELINE_SOURCE_IDS.includes(MAILBOX_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('mailbox'),
  )
}

{
  const calendarStoreFiles = [
    'store.js',
    'memory.js',
    'postgres.js',
    'repository.js',
    'port.js',
  ].filter((name) => existsSync(join(calendarDir, name)))
  assert(
    '8. no calendar persistence store or calendar-specific data file',
    calendarStoreFiles.length === 0 &&
      calendarFiles.join(',') === 'index.js,ingest.js,map.js,schema.js,types.js' &&
      !calendarSource.includes('createMemoryActivityRepository') &&
      !calendarSource.includes('createPostgresActivityRepository') &&
      !existsSync(join(root, 'data', 'calendar.json')) &&
      !existsSync(join(root, 'data', 'calendar_events.json')) &&
      !existsSync(join(root, 'data', 'inbound_calendar.json')),
  )
}

{
  const persistenceImports = calendarImports
    .split('\n')
    .filter((line) => line.includes('persistence/activities'))
  const allowedTypesFrom =
    /from\s+['"][^'"]*persistence\/activities\/types(?:\.js)?['"]/
  assert(
    '9. no direct ActivityRepository access from calendar ingest/map',
    approvedFacadeImport.test(importLines(ingestSource)) &&
      !importLines(ingestSource).includes('getActivityRepository') &&
      !importLines(mapSource).includes('getActivityRepository') &&
      !importLines(ingestSource).includes('persistence/activities') &&
      persistenceImports.every((line) => allowedTypesFrom.test(line)) &&
      !ingestSource.includes('createMemoryActivityRepository') &&
      !mapSource.includes('createMemoryActivityRepository'),
  )
}

{
  assert(
    '10. createStudioActivity remains the sole write seam',
    approvedFacadeImport.test(importLines(ingestSource)) &&
      ingestSource.includes('createStudioActivity(mapCalendarEventToStudioActivityInput') &&
      !importLines(mapSource).includes('createStudioActivity') &&
      typeof calendarApi.ingestInboundCalendarEvent === 'function' &&
      typeof calendarApi.mapCalendarEventToStudioActivityInput === 'function',
  )
}

{
  assert(
    '11. calendar does not directly invoke H16.11 fanout/emission',
    !calendarSource.includes('emitNativeActivityCreated') &&
      !calendarSource.includes('fanoutActivityEmission') &&
      !calendarSource.includes('ingestAutomationEvent') &&
      !calendarSource.includes('onAutomationEventAccepted') &&
      authoringSource.includes('emitNativeActivityCreated'),
  )
}

{
  assert(
    '12. calendar does not import or invoke H16.10 entity resolution',
    !calendarSource.includes('resolveActivityEntity') &&
      !calendarSource.includes('upsertActivityEntity') &&
      !calendarSource.includes('getActivityEntity') &&
      !calendarSource.includes('resolveContact') &&
      !calendarSource.includes('resolveCompany') &&
      !calendarSource.includes('resolveDeal') &&
      !calendarImports.includes('entity-resolution') &&
      !calendarImports.includes('/entities/'),
  )
}

{
  resetNativePath()
  const mapped = mapCalendarEventToStudioActivityInput(
    envelope({ externalEventId: 'ext-evt-boundary' }),
    knownSubject,
  )
  const result = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-boundary' }),
    knownSubject,
  )
  const created = result.activity
  const page = await listStudioTimeline({
    companyId: studio,
    kinds: [ACTIVITY_KIND.MEETING],
  })
  const entry = page.entries.find(
    (row) => row.attributes?.externalEventId === 'ext-evt-boundary',
  )
  const accepted = listAcceptedAutomationEventsForCompany(studio)
  assert(
    '13. companyId remains tenant identity and is never a CRM Company subject',
    result.ingested === true &&
      created.companyId === studio &&
      created.subject.type === knownSubject.type &&
      created.subject.id === knownSubject.id &&
      created.subject.type !== ACTIVITY_SUBJECT_TYPE.COMPANY &&
      created.subject.id !== created.companyId &&
      mapped.subject.id !== mapped.companyId &&
      mapped.subject.id !== 'calendar-studio-primary' &&
      mapped.subject.id !== 'ext-evt-boundary' &&
      !Object.prototype.hasOwnProperty.call(created.attributes, 'accessToken') &&
      !/\bid:\s*event\.companyId\b/.test(mapSource) &&
      !/\bid:\s*event\.calendarId\b/.test(mapSource) &&
      !/\bid:\s*event\.externalEventId\b/.test(mapSource),
  )
  assert(
    '14. correlated calendar events continue through Native Activity',
    created.kind === ACTIVITY_KIND.MEETING &&
      created.type === ACTIVITY_NATIVE_TYPE.MEETING_LOGGED &&
      created.source.domain === 'activity' &&
      created.source.entityType === 'activity' &&
      created.source.entityId === created.id &&
      entry?.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      accepted.length === 1 &&
      accepted[0].type === 'activity.meeting.logged' &&
      accepted[0].source.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      !String(accepted[0].type).startsWith('calendar.'),
  )

  resetNativePath()
  const uncorrelated = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated' }),
  )
  const listed = await activities.list({ companyId: studio })
  const uncorrelatedPage = await listStudioTimeline({
    companyId: studio,
    kinds: [ACTIVITY_KIND.MEETING],
  })
  const serialized = JSON.stringify(uncorrelated)
  assert(
    '15. uncorrelated calendar events invent no subject and write no activity',
    uncorrelated.ingested === false &&
      uncorrelated.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      uncorrelated.activity === null &&
      !Object.prototype.hasOwnProperty.call(uncorrelated, 'subject') &&
      !serialized.includes('contact-1') &&
      !serialized.includes(ACTIVITY_SUBJECT_TYPE.COMPANY) &&
      listed.entries.length === 0 &&
      uncorrelatedPage.entries.length === 0 &&
      listAcceptedAutomationEventsForCompany(studio).length === 0,
  )
  assert(
    '16. calendar source identity stays separate from Native Activity source',
    CALENDAR_SOURCE_ID === 'inbound_calendar' &&
      created.source.domain !== 'calendar' &&
      created.source.entityType !== 'calendar_event' &&
      created.source.entityId !== created.attributes.externalEventId &&
      created.source.entityId !== created.attributes.calendarId &&
      entry?.sourceId !== CALENDAR_SOURCE_ID &&
      entry?.sourceId !== 'calendar' &&
      created.attributes.calendarId === 'calendar-studio-primary' &&
      created.attributes.externalEventId === 'ext-evt-boundary',
  )
}

{
  resetNativePath()
  const mailboxResult = await ingestInboundMailboxMessage(
    mailboxEnvelope({ externalMessageId: 'ext-msg-boundary' }),
    knownSubject,
  )
  const mailboxPage = await listStudioTimeline({
    companyId: studio,
    kinds: [ACTIVITY_KIND.EMAIL],
  })
  const mailboxEntry = mailboxPage.entries.find(
    (row) => row.attributes?.externalMessageId === 'ext-msg-boundary',
  )
  const mailboxDiff = gitDiff([
    'src/integrations/mailbox',
    'scripts/verify-integrations-mailbox.mjs',
    'scripts/verify-integrations-mailbox-ingest.mjs',
    'scripts/verify-integrations-mailbox-timeline.mjs',
    'scripts/verify-integrations-mailbox-complete.mjs',
  ])
  assert(
    '17. no mailbox boundary regressions',
    mailboxDiff.status === 0 &&
      !(mailboxDiff.stdout || '').trim() &&
      existsSync(join(mailboxDir, 'ingest.js')) &&
      MAILBOX_SOURCE_ID === 'email_mailbox' &&
      getTimelineSource(MAILBOX_SOURCE_ID) == null &&
      mailboxResult.ingested === true &&
      mailboxResult.status === MAILBOX_INGEST_STATUS.INGESTED &&
      mailboxResult.activity.kind === ACTIVITY_KIND.EMAIL &&
      mailboxResult.activity.type === ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED &&
      mailboxEntry?.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      mailboxEntry?.sourceId !== MAILBOX_SOURCE_ID,
  )
}

{
  const priorDiff = gitDiff([
    'src/integrations/calendar',
    'src/integrations/activities',
    'src/integrations/mailbox',
    'src/persistence/activities',
    'scripts/verify-integrations-activities.mjs',
    'scripts/verify-integrations-activity-authoring.mjs',
    'scripts/verify-integrations-entity-resolution.mjs',
    'scripts/verify-integrations-activity-intake.mjs',
    'scripts/verify-integrations-mailbox-complete.mjs',
  ])
  assert(
    '18. no changes to completed H16.7/H16.9/H16.10/H16.11/H16.12/H16.13 runtime',
    priorDiff.status === 0 &&
      !(priorDiff.stdout || '').trim() &&
      TIMELINE_SOURCE_IDS.length === 9 &&
      INTEGRATION_CAPABILITIES.activityTimeline === true &&
      INTEGRATION_CAPABILITIES.activityAuthoring === true,
  )
}

console.log('')
console.log('— inspection boundaries —')

{
  const ownSource = readFileSync(
    join(__dirname, 'verify-integrations-calendar-complete.mjs'),
    'utf8',
  )
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '19. this suite is independent and does not nest other verifiers',
    !/spawnSync\([^)]*verify-integrations-(activities|persistence|activity-authoring|activity-authoring-http|entity-resolution|activity-intake|mailbox|mailbox-ingest|mailbox-timeline|mailbox-complete|calendar|calendar-ingest|calendar-timeline)\.mjs/.test(
      ownSource,
    ) &&
      !/spawnSync\(\s*process\.execPath/.test(ownSource) &&
      !/node\s+scripts\/verify-integrations-/.test(ownSource) &&
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
console.log(`H16.13 calendar complete checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
