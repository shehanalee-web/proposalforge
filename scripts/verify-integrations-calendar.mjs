/**
 * H16.13 Slice 13.1 — Inbound calendar event envelope verification.
 *
 * Contract only. Does not nest H16.7–H16.12. Never writes data/proposals.json
 * or activities.json. No HTTP, OAuth, vendor SDK, ingest, or persistence.
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
  ACTIVITY_SUBJECT_TYPE,
  CALENDAR_ACTIVITY_KIND,
  CALENDAR_ACTIVITY_TYPE,
  CALENDAR_CONTENT_MEDIA_TYPE,
  CALENDAR_FORBIDDEN_FIELDS,
  CALENDAR_LIMITS,
  CALENDAR_SOURCE_DOMAIN,
  CALENDAR_SOURCE_ENTITY_TYPE,
  CALENDAR_SOURCE_ID,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  MAILBOX_RECIPIENT_ROLE,
  NULL_INTEGRATION_ADAPTER_ID,
  TIMELINE_SOURCE_IDS,
  cloneInboundCalendarEvent,
  createNullCalendarAdapter,
  getIntegrationAdapter,
  getTimelineSource,
  listRegisteredTimelineSources,
  makeCalendarIdempotencyKey,
  makeInboundCalendarEvent,
  makeInboundMailboxMessage,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const studio = DEFAULT_COMPANY_ID
const startsAt = '2026-09-11T14:00:00.000Z'
const endsAt = '2026-09-11T15:00:00.000Z'

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
    calendarId: 'calendar-studio-primary',
    externalEventId: 'ext-evt-100',
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

const calendarDir = join(root, 'src', 'integrations', 'calendar')
const mailboxDir = join(root, 'src', 'integrations', 'mailbox')
const calendarSource = collectJs(calendarDir)
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

console.log('— H16.13.1 calendar envelope —')

{
  const event = makeInboundCalendarEvent(envelope())
  const cloned = cloneInboundCalendarEvent(event)
  assert(
    '1. valid vendor-neutral Calendar envelope is accepted',
    event.companyId === studio &&
      event.calendarId === 'calendar-studio-primary' &&
      event.externalEventId === 'ext-evt-100' &&
      event.title === 'Kickoff with the client' &&
      event.content.mediaType === CALENDAR_CONTENT_MEDIA_TYPE.TEXT_PLAIN &&
      event.content.text === 'Align on scope and timeline for the proposal.' &&
      event.content.snippet === 'Align on scope and timeline.' &&
      event.startsAt === startsAt &&
      event.endsAt === endsAt &&
      event.occurredAt === startsAt &&
      event.timezone === 'UTC' &&
      event.organizer.email === 'studio@proposalforge.test' &&
      event.attendees[0].email === 'alex@client.test' &&
      event.source.domain === CALENDAR_SOURCE_DOMAIN &&
      event.source.entityType === CALENDAR_SOURCE_ENTITY_TYPE &&
      event.source.entityId === 'ext-evt-100' &&
      JSON.stringify(cloned) === JSON.stringify(event),
  )
}

{
  const missingCompany = threw(() =>
    makeInboundCalendarEvent(envelope({ companyId: '' })),
  )
  const missingCalendar = threw(() =>
    makeInboundCalendarEvent(envelope({ calendarId: '' })),
  )
  const missingExternal = threw(() =>
    makeInboundCalendarEvent(envelope({ externalEventId: '  ' })),
  )
  assert(
    '2. required identity fields are enforced',
    missingCompany instanceof ValidationError &&
      missingCompany.errors?.[0]?.field === 'companyId' &&
      missingCalendar instanceof ValidationError &&
      missingCalendar.errors?.[0]?.field === 'calendarId' &&
      missingExternal instanceof ValidationError &&
      missingExternal.errors?.[0]?.field === 'externalEventId',
  )
}

{
  const event = makeInboundCalendarEvent(envelope())
  const asCompanyEntity = threw(() =>
    makeInboundCalendarEvent(envelope({ companyRefId: 'company-crm-1' })),
  )
  const asSubject = threw(() =>
    makeInboundCalendarEvent(envelope({ subjectType: ACTIVITY_SUBJECT_TYPE.COMPANY })),
  )
  assert(
    '3. companyId is tenant/workspace identity, not CRM Company entity',
    event.companyId === DEFAULT_COMPANY_ID &&
      event.companyId === 'company-studio' &&
      event.source.entityId === event.externalEventId &&
      event.source.entityId !== event.companyId &&
      !Object.prototype.hasOwnProperty.call(event, 'subject') &&
      !Object.prototype.hasOwnProperty.call(event, 'companyRefId') &&
      asCompanyEntity instanceof ValidationError &&
      asCompanyEntity.errors?.[0]?.field === 'companyRefId' &&
      asSubject instanceof ValidationError &&
      asSubject.errors?.[0]?.field === 'subjectType',
  )
}

{
  const event = makeInboundCalendarEvent(envelope())
  assert(
    '4. calendarId + externalEventId provide provider-neutral external identity',
    event.calendarId === 'calendar-studio-primary' &&
      event.externalEventId === 'ext-evt-100' &&
      event.source.domain === 'calendar' &&
      event.source.entityType === 'calendar_event' &&
      event.source.eventId === 'ext-evt-100' &&
      !Object.prototype.hasOwnProperty.call(event, 'googleCalendarId') &&
      !Object.prototype.hasOwnProperty.call(event, 'googleEventId') &&
      !Object.prototype.hasOwnProperty.call(event, 'graphId'),
  )
}

{
  const event = makeInboundCalendarEvent(envelope())
  const derived = makeCalendarIdempotencyKey({
    companyId: studio,
    calendarId: 'calendar-studio-primary',
    externalEventId: 'ext-evt-100',
  })
  const again = makeCalendarIdempotencyKey({
    companyId: studio,
    calendarId: 'calendar-studio-primary',
    externalEventId: 'ext-evt-100',
  })
  assert(
    '5. deterministic idempotency key is produced',
    event.idempotencyKey === derived &&
      derived === again &&
      derived === `${studio}|calendar|calendar-studio-primary|ext-evt-100`,
  )
}

{
  const longId = 'c'.repeat(CALENDAR_LIMITS.MAX_ID)
  const key = makeCalendarIdempotencyKey({
    companyId: longId,
    calendarId: longId,
    externalEventId: longId,
  })
  const again = makeCalendarIdempotencyKey({
    companyId: longId,
    calendarId: longId,
    externalEventId: longId,
  })
  const composed = `${longId}|calendar|${longId}|${longId}`
  assert(
    '6. long idempotency keys are safely bounded',
    composed.length > CALENDAR_LIMITS.MAX_IDEMPOTENCY_KEY &&
      key === again &&
      key.startsWith('cal:') &&
      key.length <= CALENDAR_LIMITS.MAX_IDEMPOTENCY_KEY &&
      key.length < composed.length,
  )
}

{
  const event = makeInboundCalendarEvent(envelope())
  const typesSource = readFileSync(join(calendarDir, 'types.js'), 'utf8')
  const schemaSource = readFileSync(join(calendarDir, 'schema.js'), 'utf8')
  assert(
    '7. calendar event maps to meeting / meeting.logged metadata without persisting',
    CALENDAR_ACTIVITY_KIND === ACTIVITY_KIND.MEETING &&
      CALENDAR_ACTIVITY_TYPE === ACTIVITY_NATIVE_TYPE.MEETING_LOGGED &&
      event.activityKind === 'meeting' &&
      event.activityType === 'meeting.logged' &&
      !typesSource.includes('createStudioActivity') &&
      !schemaSource.includes('createStudioActivity') &&
      !typesSource.includes('getActivityRepository') &&
      !schemaSource.includes('getActivityRepository') &&
      !schemaSource.includes('ingestInboundCalendarEvent'),
  )
}

{
  const missingStarts = threw(() =>
    makeInboundCalendarEvent(envelope({ startsAt: 'not-a-date' })),
  )
  const missingRequired = threw(() =>
    makeInboundCalendarEvent(envelope({ startsAt: '' })),
  )
  const badEnds = threw(() =>
    makeInboundCalendarEvent(envelope({ endsAt: 'nope' })),
  )
  const inverted = threw(() =>
    makeInboundCalendarEvent(
      envelope({ startsAt: '2026-09-11T16:00:00.000Z', endsAt: '2026-09-11T15:00:00.000Z' }),
    ),
  )
  const badOccurred = threw(() =>
    makeInboundCalendarEvent(envelope({ occurredAt: 'not-a-date' })),
  )
  const defaultOccurred = makeInboundCalendarEvent(envelope({ occurredAt: undefined }))
  assert(
    '8. invalid timestamps are rejected',
    missingStarts instanceof ValidationError &&
      missingStarts.errors?.[0]?.field === 'startsAt' &&
      missingRequired instanceof ValidationError &&
      missingRequired.errors?.[0]?.field === 'startsAt' &&
      badEnds instanceof ValidationError &&
      badEnds.errors?.[0]?.field === 'endsAt' &&
      inverted instanceof ValidationError &&
      inverted.errors?.[0]?.field === 'endsAt' &&
      badOccurred instanceof ValidationError &&
      badOccurred.errors?.[0]?.field === 'occurredAt' &&
      defaultOccurred.occurredAt === startsAt,
  )
}

{
  const longTitle = threw(() =>
    makeInboundCalendarEvent(envelope({ title: `T${'x'.repeat(CALENDAR_LIMITS.MAX_TITLE)}` })),
  )
  const longText = threw(() =>
    makeInboundCalendarEvent(
      envelope({ description: `D${'x'.repeat(CALENDAR_LIMITS.MAX_TEXT)}` }),
    ),
  )
  const tooMany = threw(() =>
    makeInboundCalendarEvent(
      envelope({
        attendees: Array.from({ length: CALENDAR_LIMITS.MAX_ATTENDEES + 1 }, (_, i) => ({
          email: `guest${i}@client.test`,
        })),
      }),
    ),
  )
  const blob = threw(() =>
    makeInboundCalendarEvent(envelope({ description: { mime: 'multipart' } })),
  )
  const htmlMedia = threw(() =>
    makeInboundCalendarEvent(
      envelope({ content: { mediaType: 'text/html', text: '<p>hi</p>' } }),
    ),
  )
  assert(
    '9. invalid/oversized content is rejected according to declared limits',
    longTitle instanceof ValidationError &&
      longTitle.errors?.[0]?.field === 'title' &&
      longText instanceof ValidationError &&
      longText.errors?.[0]?.field === 'description' &&
      tooMany instanceof ValidationError &&
      tooMany.errors?.[0]?.field === 'attendees' &&
      blob instanceof ValidationError &&
      blob.errors?.[0]?.field === 'description' &&
      htmlMedia instanceof ValidationError &&
      htmlMedia.errors?.[0]?.field === 'content.mediaType',
  )
}

{
  const access = threw(() =>
    makeInboundCalendarEvent(envelope({ accessToken: 'ya29.tok' })),
  )
  const refresh = threw(() =>
    makeInboundCalendarEvent(envelope({ refreshToken: '1//refresh' })),
  )
  const secret = threw(() =>
    makeInboundCalendarEvent(envelope({ clientSecret: 'cs_live' })),
  )
  const code = threw(() =>
    makeInboundCalendarEvent(envelope({ authorizationCode: '4/code' })),
  )
  assert(
    '10. OAuth secrets/tokens are rejected',
    access instanceof ValidationError &&
      refresh instanceof ValidationError &&
      secret instanceof ValidationError &&
      code instanceof ValidationError &&
      CALENDAR_FORBIDDEN_FIELDS.includes('accessToken') &&
      CALENDAR_FORBIDDEN_FIELDS.includes('refreshToken') &&
      CALENDAR_FORBIDDEN_FIELDS.includes('clientSecret') &&
      CALENDAR_FORBIDDEN_FIELDS.includes('authorizationCode') &&
      CALENDAR_FORBIDDEN_FIELDS.includes('oauth'),
  )
}

{
  const google = threw(() =>
    makeInboundCalendarEvent(envelope({ hangoutLink: 'https://meet.google.com/abc' })),
  )
  const googleApis = threw(() =>
    makeInboundCalendarEvent(envelope({ googleapis: { events: {} } })),
  )
  const googleEvent = threw(() =>
    makeInboundCalendarEvent(envelope({ googleEventId: 'gcal-evt-1' })),
  )
  const graph = threw(() =>
    makeInboundCalendarEvent(envelope({ microsoftGraph: { id: 'AAMkAG' } })),
  )
  const webLink = threw(() =>
    makeInboundCalendarEvent(envelope({ webLink: 'https://outlook.office.com/item' })),
  )
  assert(
    '11. Google/Microsoft/provider-specific fields are rejected',
    google instanceof ValidationError &&
      google.errors?.[0]?.field === 'hangoutLink' &&
      googleApis instanceof ValidationError &&
      googleApis.errors?.[0]?.field === 'googleapis' &&
      googleEvent instanceof ValidationError &&
      googleEvent.errors?.[0]?.field === 'googleEventId' &&
      graph instanceof ValidationError &&
      graph.errors?.[0]?.field === 'microsoftGraph' &&
      webLink instanceof ValidationError &&
      webLink.errors?.[0]?.field === 'webLink',
  )
}

{
  const ics = threw(() =>
    makeInboundCalendarEvent(
      envelope({ ics: 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nEND:VEVENT\nEND:VCALENDAR' }),
    ),
  )
  const mime = threw(() =>
    makeInboundCalendarEvent(envelope({ rawMime: 'From: a\r\n\r\nHi' })),
  )
  const payload = threw(() =>
    makeInboundCalendarEvent(envelope({ providerPayload: { raw: true } })),
  )
  const nestedIcs = threw(() =>
    makeInboundCalendarEvent(
      envelope({ content: { mediaType: 'text/plain', text: 'ok', rawIcs: 'BEGIN:VCALENDAR' } }),
    ),
  )
  assert(
    '12. raw ICS/MIME/provider payloads are rejected',
    ics instanceof ValidationError &&
      ics.errors?.[0]?.field === 'ics' &&
      mime instanceof ValidationError &&
      mime.errors?.[0]?.field === 'rawMime' &&
      payload instanceof ValidationError &&
      payload.errors?.[0]?.field === 'providerPayload' &&
      nestedIcs instanceof ValidationError &&
      nestedIcs.errors?.[0]?.field === 'content.rawIcs',
  )
}

console.log('')
console.log('— boundaries —')

{
  const vendorSdk =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud)/i
  const network = /\bfetch\s*\(|\baxios\b|\bnode:https\b|\bnode:http\b|XMLHttpRequest/
  const writeOps =
    /writeFileSync|appendFileSync|createWriteStream|mkdirSync|writeFile\s*\(/
  const forbiddenPersistenceApi =
    /\b(getActivityRepository|registerActivityRepository|createMemoryActivityRepository|createPostgresActivityRepository|createNullActivityRepository|resetActivityRepository|resetMemoryActivityRepository|resetPostgresActivityRepository|ingestAutomationEvent|fanoutActivityEmission|emitNativeActivityCreated|resolveActivityEntity|upsertActivityEntity)\b/
  const forbiddenAdapterFrom =
    /from\s+['"][^'"]*persistence\/activities(?:\.js)?['"]|from\s+['"][^'"]*persistence\/activities\/(?:memory|postgres|null|port|index)(?:\.js)?['"]/
  const allowedTypesFrom =
    /from\s+['"][^'"]*persistence\/activities\/types(?:\.js)?['"]/
  const approvedFacadeImport =
    /import\s*\{\s*createStudioActivity\s*\}\s*from\s*['"]\.\.\/activities\/authoring\.js['"]/
  const importLines = (source) =>
    source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line))
      .join('\n')

  const typesSource = readFileSync(join(calendarDir, 'types.js'), 'utf8')
  const schemaSource = readFileSync(join(calendarDir, 'schema.js'), 'utf8')
  const indexSource = readFileSync(join(calendarDir, 'index.js'), 'utf8')
  const mapPath = join(calendarDir, 'map.js')
  const ingestPath = join(calendarDir, 'ingest.js')
  const mapSource = existsSync(mapPath) ? readFileSync(mapPath, 'utf8') : ''
  const ingestSource = existsSync(ingestPath) ? readFileSync(ingestPath, 'utf8') : ''
  const allImports = importLines(calendarSource)
  const persistenceImports = allImports
    .split('\n')
    .filter((line) => line.includes('persistence/activities'))
  const nonIngestImports = importLines(
    typesSource + '\n' + schemaSource + '\n' + indexSource + '\n' + mapSource,
  )
  const httpPlugin = existsSync(join(root, 'server', 'integrationsCalendarPlugin.js'))
  const calendarStoreFiles = [
    'store.js',
    'memory.js',
    'postgres.js',
    'repository.js',
    'port.js',
    'provider.js',
    'oauth.js',
    'calendarPlugin.js',
  ].filter((name) => existsSync(join(calendarDir, name)))

  assert(
    '13. no ActivityRepository write occurs',
    !vendorSdk.test(calendarSource) &&
      !network.test(calendarSource) &&
      !writeOps.test(calendarSource) &&
      !forbiddenPersistenceApi.test(calendarSource) &&
      !forbiddenAdapterFrom.test(allImports) &&
      persistenceImports.every((line) => allowedTypesFrom.test(line)) &&
      !nonIngestImports.includes('createStudioActivity') &&
      (!ingestSource ||
        (approvedFacadeImport.test(importLines(ingestSource)) &&
          ingestSource.includes('createStudioActivity(mapCalendarEventToStudioActivityInput') &&
          !forbiddenPersistenceApi.test(ingestSource) &&
          !importLines(ingestSource).includes('getActivityRepository') &&
          !importLines(ingestSource).includes('persistence/activities'))) &&
      calendarStoreFiles.length === 0 &&
      !httpPlugin,
  )
}

{
  const registered = listRegisteredTimelineSources()
  assert(
    '14. no TimelineSource is registered',
    CALENDAR_SOURCE_ID === 'inbound_calendar' &&
      getTimelineSource(CALENDAR_SOURCE_ID) == null &&
      getTimelineSource('calendar') == null &&
      !registered.some((item) => item.id === CALENDAR_SOURCE_ID || item.id === 'calendar') &&
      !calendarSource.includes('registerTimelineSource'),
  )
}

{
  assert(
    '15. TIMELINE_SOURCE_IDS remains unchanged',
    TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes('native_activity') &&
      !TIMELINE_SOURCE_IDS.includes(CALENDAR_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('calendar') &&
      !TIMELINE_SOURCE_IDS.includes('inbound_calendar'),
  )
}

{
  assert(
    '16. INTEGRATION_CAPABILITIES.calendar remains false',
    INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
      INTEGRATION_CAPABILITIES.emailDelivery === false &&
      !Object.prototype.hasOwnProperty.call(INTEGRATION_CAPABILITIES, 'emailMailbox'),
  )
}

{
  const nullCalendar = createNullCalendarAdapter()
  const registered = getIntegrationAdapter(
    INTEGRATION_KIND.CALENDAR,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR],
  )
  assert(
    '17. null_calendar remains disabled',
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR] === 'null_calendar' &&
      nullCalendar.id === 'null_calendar' &&
      nullCalendar.isEnabled({}) === false &&
      nullCalendar.describe().enabled === false &&
      nullCalendar.describe().oauth === false &&
      nullCalendar.describe().network === false &&
      registered != null &&
      registered.isEnabled({}) === false,
  )
}

{
  const vendorFiles = [
    'provider.js',
    'adapters.js',
    'oauth.js',
    'store.js',
    'repository.js',
    'memory.js',
    'calendarPlugin.js',
  ].filter((name) => existsSync(join(calendarDir, name)))
  const vendorSdkImport =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud|google-auth-library|@azure\/identity)/i
  assert(
    '18. no vendor SDK/provider files are introduced',
    vendorFiles.length === 0 &&
      existsSync(join(calendarDir, 'types.js')) &&
      existsSync(join(calendarDir, 'schema.js')) &&
      existsSync(join(calendarDir, 'index.js')) &&
      !vendorSdkImport.test(calendarSource),
  )
}

{
  const mailboxDiff = spawnSync(
    'git',
    ['diff', '--', 'src/integrations/mailbox', 'scripts/verify-integrations-mailbox.mjs'],
    {
      encoding: 'utf8',
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const mailboxMessage = makeInboundMailboxMessage({
    companyId: studio,
    mailboxId: 'mailbox-studio-inbox',
    externalMessageId: 'ext-msg-100',
    sender: { email: 'alex@client.test', displayName: 'Alex Client' },
    recipients: [
      { email: 'studio@proposalforge.test', displayName: 'Studio', role: MAILBOX_RECIPIENT_ROLE.TO },
    ],
    subject: 'Follow up on the proposal',
    text: 'Thanks for sending this over.',
    occurredAt: '2026-09-11T13:00:00.000Z',
  })
  assert(
    '19. existing H16.12 mailbox behavior remains untouched',
    mailboxDiff.status === 0 &&
      !(mailboxDiff.stdout || '').trim() &&
      mailboxMessage.mailboxId === 'mailbox-studio-inbox' &&
      mailboxMessage.activityType === 'email.logged' &&
      existsSync(join(mailboxDir, 'ingest.js')),
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
    '20. data files remain unchanged',
    dataBefore === dataAfter &&
      activitiesBefore === activitiesAfter &&
      proposalsBefore === proposalsAfter &&
      dataStatus.status === 0 &&
      !(dataStatus.stdout || '').trim(),
  )
}

{
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-calendar.mjs'), 'utf8')
  assert(
    '21. this suite does not nest other H16 verifiers',
    !/spawnSync\(\s*process\.execPath/.test(ownSource) &&
      !/node\s+scripts\/verify-integrations-/.test(ownSource),
  )
}

console.log('')
console.log(`H16.13 calendar envelope checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
