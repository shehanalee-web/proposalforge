/**
 * H16.13 Slice 13.3 — Correlated calendar event on the native timeline.
 *
 * Independent suite. Does not nest H16.7–H16.13. Uses the memory repository
 * and the existing native_activity TimelineSource only. Never writes
 * data/proposals.json or activities.json. Does not register a calendar source.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_SOURCE_DOMAIN,
  CALENDAR_INGEST_STATUS,
  CALENDAR_SOURCE_ID,
  INTEGRATION_CAPABILITIES,
  INTEGRATION_KIND,
  MAILBOX_RECIPIENT_ROLE,
  NULL_INTEGRATION_ADAPTER_ID,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  createMemoryActivityRepository,
  createNativeActivityTimelineSource,
  createNullCalendarAdapter,
  getIntegrationAdapter,
  getTimelineSource,
  ingestInboundCalendarEvent,
  listAcceptedAutomationEventsForCompany,
  listRegisteredTimelineSources,
  listStudioTimeline,
  makeInboundMailboxMessage,
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
const startsAt = '2026-09-12T10:00:00.000Z'
const endsAt = '2026-09-12T11:00:00.000Z'
const knownSubject = Object.freeze({
  type: ACTIVITY_SUBJECT_TYPE.CONTACT,
  id: 'contact-1',
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
    externalEventId: 'ext-evt-timeline',
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

function resetNativeTimeline() {
  resetActivityRepository()
  activities = createMemoryActivityRepository()
  registerActivityRepository(activities)
  resetTimelineSources()
  registerTimelineSource(createNativeActivityTimelineSource())
  resetAutomationIntakeStore()
  setAutomationEventAcceptedListener(onAutomationEventAccepted)
}

async function ingestCorrelated(extra = {}, subject = knownSubject) {
  return ingestInboundCalendarEvent(envelope(extra), subject)
}

async function timelineFor(companyId, extra = {}) {
  return listStudioTimeline({
    companyId,
    kinds: [ACTIVITY_KIND.MEETING],
    ...extra,
  })
}

function matchingMeeting(page, externalEventId) {
  const entries = Array.isArray(page?.entries) ? page.entries : []
  return entries.filter(
    (entry) =>
      entry.kind === ACTIVITY_KIND.MEETING &&
      entry.attributes?.externalEventId === externalEventId,
  )
}

const calendarDir = join(root, 'src', 'integrations', 'calendar')
const calendarSource = collectJs(calendarDir)
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

resetNativeTimeline()

console.log('— H16.13.3 correlated calendar event on native timeline —')

{
  resetNativeTimeline()
  const result = await ingestCorrelated({ externalEventId: 'ext-evt-visible' })
  const created = result.activity
  const page = await timelineFor(studio)
  const rows = matchingMeeting(page, 'ext-evt-visible')
  const entry = rows[0]
  const listed = await activities.list({ companyId: studio })
  assert(
    '1. valid Calendar envelope can be ingested with a real existing subject',
    result.ingested === true &&
      result.status === CALENDAR_INGEST_STATUS.INGESTED &&
      created?.id &&
      created.subject.type === knownSubject.type &&
      created.subject.id === knownSubject.id,
  )
  assert(
    '2. exactly one Native Activity is created',
    listed.entries.length === 1 &&
      listed.entries[0].id === created.id &&
      eventsFor(studio).length === 1,
  )
  assert(
    '3. Activity kind is meeting',
    created.kind === ACTIVITY_KIND.MEETING && created.kind === 'meeting',
  )
  assert(
    '4. Activity type is meeting.logged',
    created.type === ACTIVITY_NATIVE_TYPE.MEETING_LOGGED &&
      created.type === 'meeting.logged',
  )
  assert(
    '5. the supplied subject is preserved exactly',
    created.subject.type === knownSubject.type &&
      created.subject.id === knownSubject.id &&
      entry.subject.type === knownSubject.type &&
      entry.subject.id === knownSubject.id &&
      created.subject.id !== studio &&
      created.subject.id !== created.attributes.calendarId &&
      created.subject.id !== created.attributes.externalEventId,
  )
  assert(
    '6. the activity belongs to the correct company/tenant',
    created.companyId === studio &&
      entry.companyId === studio &&
      listed.entries[0].companyId === studio,
  )
  assert(
    '7. Calendar identity survives in the activity attributes',
    created.attributes.calendarId === 'calendar-studio-primary' &&
      created.attributes.externalEventId === 'ext-evt-visible' &&
      entry.attributes.calendarId === 'calendar-studio-primary' &&
      entry.attributes.externalEventId === 'ext-evt-visible',
  )
  assert(
    '8. Native Activity source remains the canonical activity source',
    created.source.domain === 'activity' &&
      created.source.entityType === 'activity' &&
      created.source.entityId === created.id &&
      created.source.eventId === created.id &&
      entry.provenance.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      entry.provenance.entityId === created.id,
  )
  assert(
    '9. Calendar source identity does not become the Native Activity source',
    created.source.domain !== 'calendar' &&
      created.source.entityType !== 'calendar_event' &&
      created.source.entityId !== created.attributes.externalEventId &&
      created.source.entityId !== created.attributes.calendarId &&
      entry.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      entry.sourceId !== CALENDAR_SOURCE_ID &&
      entry.sourceId !== 'calendar',
  )
}

{
  resetNativeTimeline()
  const result = await ingestCorrelated({ externalEventId: 'ext-evt-intake' })
  await ingestCorrelated({ externalEventId: 'ext-evt-intake' })
  const accepted = eventsFor(studio)
  const event = accepted[0]
  assert(
    '10. H16.11 emission occurs as activity.meeting.logged',
    accepted.length === 1 &&
      event.type === 'activity.meeting.logged' &&
      event.source.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      event.sourceEventIdentity === result.activity.id &&
      event.payload.kind === 'meeting' &&
      event.payload.type === 'meeting.logged' &&
      event.type.startsWith('activity.') &&
      !String(event.type).startsWith('calendar.'),
  )
}

{
  resetNativeTimeline()
  const result = await ingestCorrelated({ externalEventId: 'ext-evt-once' })
  const page = await timelineFor(studio)
  const rows = matchingMeeting(page, 'ext-evt-once')
  const entry = rows[0]
  assert(
    '11. the resulting activity is readable through native_activity',
    result.ingested === true &&
      entry != null &&
      entry.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      entry.kind === 'meeting' &&
      entry.type === 'meeting.logged' &&
      entry.provenance.entityId === result.activity.id,
  )
  assert(
    '12. the result appears exactly once in the timeline',
    rows.length === 1 && page.entries.length === 1,
  )
}

{
  resetNativeTimeline()
  const first = await ingestCorrelated({ externalEventId: 'ext-evt-replay' })
  const second = await ingestCorrelated({ externalEventId: 'ext-evt-replay' })
  const page = await timelineFor(studio)
  const rows = matchingMeeting(page, 'ext-evt-replay')
  const listed = await activities.list({ companyId: studio })
  const stored = listed.entries.filter(
    (row) => row.attributes?.externalEventId === 'ext-evt-replay',
  )
  assert(
    '13. replaying the exact same Calendar event does not create a duplicate',
    first.activity.id === second.activity.id &&
      first.activity.idempotencyKey === second.activity.idempotencyKey &&
      rows.length === 1 &&
      stored.length === 1 &&
      stored[0].id === first.activity.id &&
      rows[0].provenance.entityId === first.activity.id &&
      eventsFor(studio).length === 1,
  )
}

{
  resetNativeTimeline()
  const studioResult = await ingestCorrelated({ externalEventId: 'ext-evt-tenant' })
  const otherResult = await ingestInboundCalendarEvent(
    envelope({ companyId: otherCompany, externalEventId: 'ext-evt-tenant' }),
    knownSubject,
  )
  const studioPage = await timelineFor(studio)
  const otherPage = await timelineFor(otherCompany)
  const studioRows = matchingMeeting(studioPage, 'ext-evt-tenant')
  const otherRows = matchingMeeting(otherPage, 'ext-evt-tenant')
  assert(
    '14. a different companyId remains tenant-isolated',
    studioResult.activity.id !== otherResult.activity.id &&
      studioResult.activity.companyId === studio &&
      otherResult.activity.companyId === otherCompany &&
      studioRows.length === 1 &&
      otherRows.length === 1 &&
      studioRows[0].companyId === studio &&
      otherRows[0].companyId === otherCompany &&
      studioRows[0].id !== otherRows[0].id &&
      studioPage.entries.every((entry) => entry.companyId === studio) &&
      otherPage.entries.every((entry) => entry.companyId === otherCompany),
  )
}

console.log('')
console.log('— uncorrelated calendar is not on the timeline —')

{
  resetNativeTimeline()
  const omitted = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated' }),
  )
  const listed = await activities.list({ companyId: studio })
  const page = await timelineFor(studio)
  assert(
    '15. a missing subject remains uncorrelated and is not persisted',
    omitted.ingested === false &&
      omitted.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      omitted.activity === null &&
      matchingMeeting(page, 'ext-evt-uncorrelated').length === 0 &&
      page.entries.length === 0 &&
      listed.entries.length === 0 &&
      eventsFor(studio).length === 0,
  )
}

{
  resetNativeTimeline()
  const explicitNull = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated-null' }),
    null,
  )
  const listed = await activities.list({ companyId: studio })
  const page = await timelineFor(studio)
  assert(
    '16. null subject remains uncorrelated and is not persisted',
    explicitNull.ingested === false &&
      explicitNull.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      explicitNull.activity === null &&
      matchingMeeting(page, 'ext-evt-uncorrelated-null').length === 0 &&
      listed.entries.length === 0 &&
      eventsFor(studio).length === 0,
  )
}

{
  resetNativeTimeline()
  const empty = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-uncorrelated-empty' }),
    {},
  )
  const listed = await activities.list({ companyId: studio })
  const page = await timelineFor(studio)
  assert(
    '17. empty object subject remains uncorrelated and is not persisted',
    empty.ingested === false &&
      empty.status === CALENDAR_INGEST_STATUS.UNCORRELATED &&
      empty.activity === null &&
      matchingMeeting(page, 'ext-evt-uncorrelated-empty').length === 0 &&
      listed.entries.length === 0 &&
      eventsFor(studio).length === 0,
  )
}

{
  resetNativeTimeline()
  const result = await ingestInboundCalendarEvent(
    envelope({ externalEventId: 'ext-evt-no-fake-company' }),
  )
  const created = (
    await ingestCorrelated({ externalEventId: 'ext-evt-not-company-subject' })
  ).activity
  const serialized = JSON.stringify(result)
  assert(
    '18. no fake company subject is generated from event.companyId',
    result.ingested === false &&
      result.activity === null &&
      !Object.prototype.hasOwnProperty.call(result, 'subject') &&
      !serialized.includes(ACTIVITY_SUBJECT_TYPE.COMPANY) &&
      created.subject.type === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      created.subject.id === 'contact-1' &&
      created.subject.id !== created.companyId &&
      created.subject.type !== ACTIVITY_SUBJECT_TYPE.COMPANY,
  )
}

{
  assert(
    '19. H16.10 entity resolution is not called',
    !calendarSource.includes('resolveActivityEntity') &&
      !calendarSource.includes('upsertActivityEntity') &&
      !calendarSource.includes('getActivityEntity') &&
      !calendarSource.includes('resolveContact') &&
      !calendarSource.includes('resolveCompany') &&
      !calendarSource.includes('resolveDeal'),
  )
}

console.log('')
console.log('— timeline source and capability boundaries —')

{
  const registered = listRegisteredTimelineSources()
  assert(
    '20. Calendar is not present in TIMELINE_SOURCE_IDS',
    TIMELINE_SOURCE_IDS.length === 9 && !TIMELINE_SOURCE_IDS.includes('calendar'),
  )
  assert(
    '21. inbound_calendar is not present in TIMELINE_SOURCE_IDS',
    !TIMELINE_SOURCE_IDS.includes('inbound_calendar') &&
      !TIMELINE_SOURCE_IDS.includes(CALENDAR_SOURCE_ID),
  )
  assert(
    '22. no Calendar TimelineSource is registered',
    CALENDAR_SOURCE_ID === 'inbound_calendar' &&
      getTimelineSource('calendar') == null &&
      getTimelineSource('inbound_calendar') == null &&
      getTimelineSource(CALENDAR_SOURCE_ID) == null &&
      registered.every((entry) => entry.id !== 'calendar' && entry.id !== CALENDAR_SOURCE_ID) &&
      !existsSync(join(calendarDir, 'timeline.js')) &&
      !existsSync(
        join(root, 'src', 'integrations', 'activities', 'sources', 'calendar.js'),
      ) &&
      !calendarSource.includes('registerTimelineSource'),
  )
  assert(
    '23. the TimelineSource count remains exactly 9',
    TIMELINE_SOURCE_IDS.length === 9 &&
      !TIMELINE_SOURCE_IDS.includes('calendar') &&
      !TIMELINE_SOURCE_IDS.includes('inbound_calendar'),
  )
  assert(
    '24. native_activity remains the canonical Activity TimelineSource',
    TIMELINE_SOURCE_IDS.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      registered.some((entry) => entry.id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      registered.length === 1 &&
      createNativeActivityTimelineSource().id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
  )
}

{
  const nullCalendar = createNullCalendarAdapter()
  const registered = getIntegrationAdapter(
    INTEGRATION_KIND.CALENDAR,
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR],
  )
  assert(
    '25. INTEGRATION_CAPABILITIES.calendar remains false',
    INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
      INTEGRATION_CAPABILITIES.activityTimeline === true,
  )
  assert(
    '26. null_calendar remains disabled',
    NULL_INTEGRATION_ADAPTER_ID[INTEGRATION_KIND.CALENDAR] === 'null_calendar' &&
      nullCalendar.id === 'null_calendar' &&
      nullCalendar.isEnabled({}) === false &&
      nullCalendar.describe().enabled === false &&
      nullCalendar.describe().oauth === false &&
      registered != null &&
      registered.isEnabled({}) === false,
  )
}

{
  const vendorSdk =
    /from\s+['"](?:googleapis|@microsoft\/microsoft-graph-client|gmail|outlook|@google-cloud|google-auth-library)/i
  assert(
    '27. no new Calendar persistence store exists',
    !existsSync(join(calendarDir, 'store.js')) &&
      !existsSync(join(calendarDir, 'memory.js')) &&
      !existsSync(join(calendarDir, 'repository.js')) &&
      !existsSync(join(calendarDir, 'postgres.js')),
  )
  assert(
    '28. no provider/OAuth/SDK/HTTP runtime exists',
    !vendorSdk.test(calendarSource) &&
      !existsSync(join(calendarDir, 'oauth.js')) &&
      !existsSync(join(calendarDir, 'provider.js')) &&
      !existsSync(join(calendarDir, 'calendarPlugin.js')) &&
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
  const mailboxMessage = makeInboundMailboxMessage({
    companyId: studio,
    mailboxId: 'mailbox-studio-inbox',
    externalMessageId: 'ext-msg-100',
    sender: { email: 'alex@client.test', displayName: 'Alex Client' },
    recipients: [
      {
        email: 'studio@proposalforge.test',
        displayName: 'Studio',
        role: MAILBOX_RECIPIENT_ROLE.TO,
      },
    ],
    subject: 'Follow up on the proposal',
    text: 'Thanks for sending this over.',
    occurredAt: '2026-09-11T13:00:00.000Z',
  })
  assert(
    '29. existing H16.12 mailbox behavior remains intact',
    mailboxDiff.status === 0 &&
      !(mailboxDiff.stdout || '').trim() &&
      mailboxMessage.mailboxId === 'mailbox-studio-inbox' &&
      mailboxMessage.activityType === 'email.logged' &&
      existsSync(join(root, 'src', 'integrations', 'mailbox', 'ingest.js')),
  )
}

{
  const ownSource = readFileSync(
    join(__dirname, 'verify-integrations-calendar-timeline.mjs'),
    'utf8',
  )
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '30. data files are unchanged and this suite does not nest other verifiers',
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
console.log(`H16.13 calendar timeline checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
