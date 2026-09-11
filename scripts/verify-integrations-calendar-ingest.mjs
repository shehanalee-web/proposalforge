/**
 * H16.13 Slice 13.2 — Calendar envelope → Native Activity ingest.
 *
 * Independent suite. Does not nest H16.7–H16.12. Uses the memory repository
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
  AUTOMATION_SOURCE_DOMAIN,
  CALENDAR_ACTIVITY_KIND,
  CALENDAR_ACTIVITY_TYPE,
  CALENDAR_INGEST_STATUS,
  CALENDAR_SOURCE_ID,
  INTEGRATION_CAPABILITIES,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  createMemoryActivityRepository,
  createNativeActivityTimelineSource,
  ingestInboundCalendarEvent,
  listAcceptedAutomationEventsForCompany,
  listRegisteredTimelineSources,
  listStudioTimeline,
  mapCalendarEventToStudioActivityInput,
  makeCalendarIdempotencyKey,
  makeInboundCalendarEvent,
  makeNativeCalendarIdempotencyKey,
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
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const startsAt = '2026-09-11T16:00:00.000Z'
const endsAt = '2026-09-11T17:00:00.000Z'
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
    calendarId: 'calendar-studio-primary',
    externalEventId: 'ext-evt-200',
    title: 'Kickoff with the client',
    description: 'Align on scope and timeline for the proposal.',
    snippet: 'Align on scope and timeline.',
    startsAt,
    endsAt,
    timezone: 'UTC',
    organizer: { email: 'Studio@Proposalforge.test', displayName: 'Studio' },
    attendees: [{ email: 'Alex@Client.test', displayName: 'Alex Client' }],
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
  return ingestInboundCalendarEvent(envelope(extra), subject)
}

const calendarDir = join(root, 'src', 'integrations', 'calendar')
const calendarSource = collectJs(calendarDir)
const ingestSource = readFileSync(join(calendarDir, 'ingest.js'), 'utf8')
const mapSource = readFileSync(join(calendarDir, 'map.js'), 'utf8')
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

console.log('— A. correlated calendar → native activity —')

{
  resetAutomationIntakeStore()
  const result = await ingestCorrelated()
  const created = result.activity
  const accepted = eventsFor(studio)
  assert(
    '1. valid Calendar envelope + valid supplied subject is accepted',
    result.ingested === true &&
      result.status === CALENDAR_INGEST_STATUS.INGESTED &&
      String(created.id).startsWith('act-') &&
      created.kind === ACTIVITY_KIND.MEETING &&
      created.type === ACTIVITY_NATIVE_TYPE.MEETING_LOGGED,
  )
  assert(
    '2. correlated ingest creates exactly one Native Activity',
    accepted.length === 1 && created.id === accepted[0].sourceEventIdentity,
  )
  assert(
    '3. Activity kind is meeting',
    created.kind === 'meeting' && CALENDAR_ACTIVITY_KIND === 'meeting',
  )
  assert(
    '4. Activity type is meeting.logged',
    created.type === 'meeting.logged' && CALENDAR_ACTIVITY_TYPE === 'meeting.logged',
  )
}

{
  const mapped = mapCalendarEventToStudioActivityInput(envelope(), knownSubject)
  const companyMapped = mapCalendarEventToStudioActivityInput(
    envelope({ externalEventId: 'ext-evt-company-entity' }),
    companyEntitySubject,
  )
  const event = makeInboundCalendarEvent(envelope())
  const created = (await ingestCorrelated({ externalEventId: 'ext-evt-subject' })).activity
  assert(
    '5. supplied subject is preserved exactly',
    mapped.subject.type === knownSubject.type &&
      mapped.subject.id === knownSubject.id &&
      created.subject.type === knownSubject.type &&
      created.subject.id === knownSubject.id &&
      companyMapped.subject.type === ACTIVITY_SUBJECT_TYPE.COMPANY &&
      companyMapped.subject.id === 'company-1',
  )
  assert(
    '6. companyId remains tenant identity and is NOT converted into a Company subject',
    created.companyId === studio &&
      created.subject.type === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      created.subject.id === 'contact-1' &&
      created.subject.id !== created.companyId &&
      mapped.subject.id !== mapped.companyId &&
      mapped.subject.id !== event.calendarId &&
      mapped.subject.id !== event.externalEventId &&
      companyMapped.subject.id !== companyMapped.companyId &&
      !/\bid:\s*event\.companyId\b/.test(mapSource),
  )
  assert(
    '7. calendarId is preserved as external Calendar identity',
    created.attributes.calendarId === 'calendar-studio-primary' &&
      mapped.attributes.calendarId === event.calendarId,
  )
  assert(
    '8. externalEventId is preserved as external Calendar identity',
    created.attributes.externalEventId === 'ext-evt-subject' &&
      created.subjectLine === 'Kickoff with the client' &&
      created.body === 'Align on scope and timeline for the proposal.' &&
      created.occurredAt === startsAt &&
      created.attributes.startsAt === startsAt &&
      created.attributes.endsAt === endsAt &&
      created.attributes.timezone === 'UTC',
  )
  assert(
    '9. Native Activity source remains the canonical activity source',
    created.source.domain === 'activity' &&
      created.source.entityType === 'activity' &&
      created.source.entityId === created.id &&
      created.source.eventId === created.id,
  )
  assert(
    '10. Calendar source identity does not become the Native Activity source',
    created.source.domain !== 'calendar' &&
      created.source.entityType !== 'calendar_event' &&
      created.source.entityId !== created.attributes.externalEventId &&
      created.source.entityId !== created.attributes.calendarId,
  )
}

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const created = (await ingestCorrelated({ externalEventId: 'ext-evt-intake' })).activity
  await ingestCorrelated({ externalEventId: 'ext-evt-intake' })
  const accepted = eventsFor(studio)
  const event = accepted[0]
  assert(
    '11. H16.11 emits activity.meeting.logged',
    ingestSource.includes('createStudioActivity') &&
      ingestSource.includes('mapCalendarEventToStudioActivityInput') &&
      ingestSource.includes('createStudioActivity(mapCalendarEventToStudioActivityInput') &&
      !ingestSource.includes('emitNativeActivityCreated') &&
      !ingestSource.includes('fanoutActivityEmission') &&
      !ingestSource.includes('ingestAutomationEvent') &&
      authoringSource.includes('emitNativeActivityCreated') &&
      accepted.length === 1 &&
      event?.type === 'activity.meeting.logged' &&
      event.source.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      event.sourceEventIdentity === created.id &&
      event.payload.kind === 'meeting' &&
      event.payload.type === 'meeting.logged' &&
      event.intake.status === AUTOMATION_INTAKE_STATUS.ACCEPTED,
  )
}

{
  resetNativeStore()
  resetAutomationIntakeStore()
  resetTimelineSources()
  registerTimelineSource(createNativeActivityTimelineSource())
  const result = await ingestCorrelated({ externalEventId: 'ext-evt-timeline' })
  const page = await listStudioTimeline({
    companyId: studio,
    kinds: [ACTIVITY_KIND.MEETING],
  })
  const rows = (page?.entries ?? []).filter(
    (entry) => entry.attributes?.externalEventId === 'ext-evt-timeline',
  )
  const entry = rows[0]
  assert(
    '12. the resulting activity appears through native_activity',
    result.ingested === true &&
      rows.length === 1 &&
      entry.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      entry.sourceId !== CALENDAR_SOURCE_ID &&
      entry.sourceId !== 'calendar' &&
      entry.kind === 'meeting' &&
      entry.type === 'meeting.logged' &&
      entry.subject.type === knownSubject.type &&
      entry.subject.id === knownSubject.id &&
      entry.provenance.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      entry.provenance.entityId === result.activity.id,
  )
  resetTimelineSources()
}

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const first = (await ingestCorrelated({ externalEventId: 'ext-evt-replay' })).activity
  const second = (await ingestCorrelated({ externalEventId: 'ext-evt-replay' })).activity
  const accepted = eventsFor(studio)
  const calendarKey = makeCalendarIdempotencyKey({
    companyId: studio,
    calendarId: 'calendar-studio-primary',
    externalEventId: 'ext-evt-replay',
  })
  assert(
    '13. replaying the same event does not create a duplicate',
    first.id === second.id &&
      first.idempotencyKey === calendarKey &&
      second.idempotencyKey === first.idempotencyKey &&
      makeNativeCalendarIdempotencyKey(
        makeInboundCalendarEvent(envelope({ externalEventId: 'ext-evt-replay' })),
      ) === calendarKey &&
      accepted.length === 1,
  )
}

{
  const studioRow = (await ingestCorrelated({ externalEventId: 'ext-evt-tenant' })).activity
  const other = (
    await ingestInboundCalendarEvent(
      envelope({ companyId: otherCompany, externalEventId: 'ext-evt-tenant' }),
      knownSubject,
    )
  ).activity
  assert(
    '14. different companyId values remain isolated',
    studioRow.id !== other.id &&
      studioRow.companyId === studio &&
      other.companyId === otherCompany &&
      studioRow.idempotencyKey !== other.idempotencyKey,
  )
}

console.log('')
console.log('— B. uncorrelated calendar is not ingested —')

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const listedBefore = await activities.list({ companyId: studio })
  const omitted = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated' }),
  )
  const explicitNull = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated-null' }),
    null,
  )
  const empty = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated-empty' }),
    {},
  )
  const listedAfter = await activities.list({ companyId: studio })
  assert(
    '15. missing subject returns uncorrelated without persistence',
    omitted.ingested === false &&
      omitted.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      omitted.activity === null &&
      listedBefore.entries.length === 0 &&
      listedAfter.entries.length === 0 &&
      eventsFor(studio).length === 0,
  )
  assert(
    '16. null subject returns uncorrelated without persistence',
    explicitNull.ingested === false &&
      explicitNull.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      explicitNull.activity === null,
  )
  assert(
    '17. empty object subject returns uncorrelated without persistence',
    empty.ingested === false &&
      empty.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      empty.activity === null &&
      listedAfter.entries.length === 0,
  )
}

{
  const badType = threw(() =>
    mapCalendarEventToStudioActivityInput(envelope(), {
      type: 'calendar',
      id: 'calendar-studio-primary',
    }),
  )
  const incomplete = threw(() =>
    mapCalendarEventToStudioActivityInput(envelope(), {
      type: ACTIVITY_SUBJECT_TYPE.CONTACT,
    }),
  )
  const calendarEventSubject = threw(() =>
    mapCalendarEventToStudioActivityInput(envelope(), {
      type: 'calendar_event',
      id: 'ext-evt-200',
    }),
  )
  const ingestBad = await caught(() =>
    ingestInboundCalendarEvent(envelope({ externalEventId: 'ext-evt-bad-subject' }), {
      type: 'calendar',
      id: 'calendar-studio-primary',
    }),
  )
  assert(
    '18. invalid subject is rejected according to the Native Activity contract',
    badType instanceof ValidationError &&
      badType.errors?.[0]?.field === 'subject.type' &&
      incomplete instanceof ValidationError &&
      incomplete.errors?.[0]?.field === 'subject.id' &&
      calendarEventSubject instanceof ValidationError &&
      calendarEventSubject.errors?.[0]?.field === 'subject.type' &&
      ingestBad instanceof ValidationError &&
      ingestBad.errors?.[0]?.field === 'subject.type',
  )
}

{
  const missing = threw(() =>
    mapCalendarEventToStudioActivityInput(envelope({ companyId: '' }), knownSubject),
  )
  const vendor = threw(() =>
    mapCalendarEventToStudioActivityInput(
      envelope({ hangoutLink: 'https://meet.google.com/abc' }),
      knownSubject,
    ),
  )
  const ingestFail = await caught(() =>
    ingestInboundCalendarEvent(envelope({ html: '<p>hi</p>' })),
  )
  assert(
    '19. malformed Calendar envelope still throws ValidationError',
    missing instanceof ValidationError &&
      missing.errors?.[0]?.field === 'companyId' &&
      vendor instanceof ValidationError &&
      vendor.errors?.[0]?.field === 'hangoutLink' &&
      ingestFail instanceof ValidationError &&
      ingestFail.errors?.[0]?.field === 'html',
  )
}

{
  assert(
    '20. no H16.10 entity resolution is invoked',
    !mapSource.includes('resolveActivityEntity') &&
      !ingestSource.includes('resolveActivityEntity') &&
      !calendarSource.includes('upsertActivityEntity') &&
      !calendarSource.includes('getActivityEntity') &&
      !calendarSource.includes('resolveContact') &&
      !calendarSource.includes('resolveCompany') &&
      !calendarSource.includes('resolveDeal'),
  )
}

{
  resetNativeStore()
  resetAutomationIntakeStore()
  const result = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-no-fake-subject' }),
  )
  const serialized = JSON.stringify(result)
  assert(
    '21. no fake subject is generated',
    result.ingested === false &&
      result.activity === null &&
      !Object.prototype.hasOwnProperty.call(result, 'subject') &&
      !serialized.includes('contact-1') &&
      !serialized.includes(studio) &&
      !serialized.includes('calendar-studio-primary') &&
      eventsFor(studio).length === 0,
  )
}

{
  const registered = listRegisteredTimelineSources()
  assert(
    '22. no Calendar TimelineSource is registered',
    CALENDAR_SOURCE_ID === 'inbound_calendar' &&
      !registered.some((item) => item.id === CALENDAR_SOURCE_ID || item.id === 'calendar') &&
      !mapSource.includes('registerTimelineSource') &&
      !ingestSource.includes('registerTimelineSource') &&
      !existsSync(join(calendarDir, 'timeline.js')),
  )
}

{
  assert(
    '23. TIMELINE_SOURCE_IDS remains unchanged',
    TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes('native_activity') &&
      !TIMELINE_SOURCE_IDS.includes(CALENDAR_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('calendar'),
  )
}

{
  assert(
    '24. INTEGRATION_CAPABILITIES.calendar remains false',
    INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
      INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false,
  )
}

{
  const vendorSdk =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud|google-auth-library)/i
  const created = (await ingestCorrelated({ externalEventId: 'ext-evt-neutral' })).activity
  const serialized = JSON.stringify(created)
  assert(
    '25. no OAuth/provider SDK behavior exists',
    !vendorSdk.test(calendarSource) &&
      !existsSync(join(calendarDir, 'oauth.js')) &&
      !existsSync(join(calendarDir, 'provider.js')) &&
      !Object.prototype.hasOwnProperty.call(created.attributes, 'accessToken') &&
      !Object.prototype.hasOwnProperty.call(created.attributes, 'hangoutLink') &&
      !/gmail|outlook|graph|google|microsoft|oauth/i.test(serialized),
  )
}

{
  assert(
    '26. no calendar-specific persistence store exists',
    !existsSync(join(calendarDir, 'store.js')) &&
      !existsSync(join(calendarDir, 'memory.js')) &&
      !existsSync(join(calendarDir, 'repository.js')) &&
      !existsSync(join(calendarDir, 'postgres.js')) &&
      !existsSync(join(root, 'server', 'integrationsCalendarPlugin.js')),
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
  const ownSource = readFileSync(
    join(__dirname, 'verify-integrations-calendar-ingest.mjs'),
    'utf8',
  )
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '27. H16.12 mailbox files remain untouched by this slice',
    mailboxDiff.status === 0 &&
      !(mailboxDiff.stdout || '').trim() &&
      existsSync(join(root, 'src', 'integrations', 'mailbox', 'ingest.js')),
  )
  assert(
    '28. this suite does not nest other H16 verifiers or write data files',
    !/spawnSync\(\s*process\.execPath/.test(ownSource) &&
      !/node\s+scripts\/verify-integrations-/.test(ownSource) &&
      dataBefore === dataAfter &&
      activitiesBefore === hashFile(join(root, 'data', 'activities.json')) &&
      proposalsBefore === hashFile(join(root, 'data', 'proposals.json')) &&
      dataStatus.status === 0 &&
      !(dataStatus.stdout || '').trim(),
  )
  assert(
    '29. ingest writes only through createStudioActivity',
    ingestSource.includes("from '../activities/authoring.js'") &&
      ingestSource.includes('createStudioActivity(mapCalendarEventToStudioActivityInput') &&
      !ingestSource.includes('getActivityRepository') &&
      !mapSource.includes("from '../activities/authoring.js'"),
  )
  assert(
    '30. calendar identity is not used as a Native Activity subject',
    !/\bid:\s*event\.calendarId\b/.test(mapSource) &&
      !/\bid:\s*event\.externalEventId\b/.test(mapSource) &&
      !mapSource.includes("type: 'calendar'") &&
      !mapSource.includes("type: 'calendar_event'"),
  )
}

resetAutomationIntakeStore()
resetActivityRepository()
resetTimelineSources()
setAutomationEventAcceptedListener(onAutomationEventAccepted)

console.log('')
console.log(`H16.13 calendar ingest checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
