/**
 * H16.12 Slice 12.3 — Correlated mailbox email on the native timeline.
 *
 * Independent suite. Does not nest H16.7–H16.12. Uses the memory repository
 * and the existing native_activity TimelineSource only. Never writes
 * data/proposals.json or activities.json. Does not register a mailbox source.
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
  INTEGRATION_CAPABILITIES,
  MAILBOX_INGEST_STATUS,
  MAILBOX_RECIPIENT_ROLE,
  MAILBOX_SOURCE_ID,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  createMemoryActivityRepository,
  createNativeActivityTimelineSource,
  getTimelineSource,
  ingestInboundMailboxMessage,
  listAcceptedAutomationEventsForCompany,
  listRegisteredTimelineSources,
  listStudioTimeline,
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
const occurredAt = '2026-09-11T15:00:00.000Z'
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
    externalMessageId: 'ext-msg-timeline',
    threadId: 'ext-thread-timeline',
    rfcMessageId: '<timeline@example.test>',
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
    bodyRef: 'content:mailbox-studio-inbox:ext-msg-timeline',
    occurredAt,
    receivedAt: '2026-09-11T15:01:00.000Z',
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
  return ingestInboundMailboxMessage(envelope(extra), subject)
}

async function timelineFor(companyId, extra = {}) {
  return listStudioTimeline({
    companyId,
    kinds: [ACTIVITY_KIND.EMAIL],
    ...extra,
  })
}

function matchingEmail(page, externalMessageId) {
  const entries = Array.isArray(page?.entries) ? page.entries : []
  return entries.filter(
    (entry) =>
      entry.kind === ACTIVITY_KIND.EMAIL &&
      entry.attributes?.externalMessageId === externalMessageId,
  )
}

const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

resetNativeTimeline()

console.log('— H16.12.3 correlated mailbox email on native timeline —')

{
  resetNativeTimeline()
  const result = await ingestCorrelated({ externalMessageId: 'ext-msg-visible' })
  const created = result.activity
  const page = await timelineFor(studio)
  const rows = matchingEmail(page, 'ext-msg-visible')
  const entry = rows[0]
  assert(
    '1. correlated mailbox email appears once on the native timeline',
    result.ingested === true &&
      result.status === MAILBOX_INGEST_STATUS.INGESTED &&
      created?.id &&
      rows.length === 1 &&
      entry.companyId === studio &&
      entry.kind === ACTIVITY_KIND.EMAIL &&
      entry.type === ACTIVITY_NATIVE_TYPE.EMAIL_LOGGED &&
      entry.subject.type === knownSubject.type &&
      entry.subject.id === knownSubject.id &&
      entry.subject.id !== studio &&
      entry.subject.id !== 'mailbox-studio-inbox' &&
      entry.subject.id !== 'ext-msg-visible' &&
      entry.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      entry.sourceId !== MAILBOX_SOURCE_ID &&
      entry.attributes.mailboxId === 'mailbox-studio-inbox' &&
      entry.attributes.externalMessageId === 'ext-msg-visible' &&
      entry.subjectLine === 'Follow up on the proposal' &&
      entry.body === 'Thanks for sending this over. We can review on Tuesday.' &&
      entry.provenance.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      entry.provenance.entityId === created.id,
  )
}

{
  resetNativeTimeline()
  const first = await ingestCorrelated({ externalMessageId: 'ext-msg-replay' })
  const second = await ingestCorrelated({ externalMessageId: 'ext-msg-replay' })
  const page = await timelineFor(studio)
  const rows = matchingEmail(page, 'ext-msg-replay')
  const listed = await activities.list({ companyId: studio })
  const stored = listed.entries.filter(
    (row) => row.attributes?.externalMessageId === 'ext-msg-replay',
  )
  assert(
    '2. replay reuses the same Activity and does not duplicate the timeline row',
    first.activity.id === second.activity.id &&
      first.activity.idempotencyKey === second.activity.idempotencyKey &&
      rows.length === 1 &&
      stored.length === 1 &&
      stored[0].id === first.activity.id &&
      rows[0].provenance.entityId === first.activity.id,
  )
}

{
  resetNativeTimeline()
  const result = await ingestCorrelated({ externalMessageId: 'ext-msg-tenant' })
  const studioPage = await timelineFor(studio)
  const otherPage = await timelineFor(otherCompany)
  assert(
    '3. other tenants cannot see the mailbox Activity',
    matchingEmail(studioPage, 'ext-msg-tenant').length === 1 &&
      matchingEmail(studioPage, 'ext-msg-tenant')[0].companyId === studio &&
      matchingEmail(studioPage, 'ext-msg-tenant')[0].subject.id !== studio &&
      matchingEmail(otherPage, 'ext-msg-tenant').length === 0 &&
      otherPage.entries.length === 0 &&
      result.activity.companyId === studio,
  )
}

{
  resetNativeTimeline()
  const result = await ingestInboundMailboxMessage(
    envelope({ externalMessageId: 'ext-msg-uncorrelated' }),
  )
  const page = await timelineFor(studio)
  const listed = await activities.list({ companyId: studio })
  assert(
    '4. uncorrelated mail is not ingested and does not appear on the timeline',
    result.ingested === false &&
      result.status === MAILBOX_INGEST_STATUS.UNCORRELATED &&
      result.activity === null &&
      matchingEmail(page, 'ext-msg-uncorrelated').length === 0 &&
      page.entries.length === 0 &&
      listed.entries.length === 0 &&
      eventsFor(studio).length === 0,
  )
}

{
  const registered = listRegisteredTimelineSources()
  assert(
    '5. email_mailbox remains unregistered; native_activity is the read path',
    MAILBOX_SOURCE_ID === 'email_mailbox' &&
      TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      !TIMELINE_SOURCE_IDS.includes(MAILBOX_SOURCE_ID) &&
      !TIMELINE_SOURCE_IDS.includes('mailbox') &&
      getTimelineSource(MAILBOX_SOURCE_ID) == null &&
      getTimelineSource('mailbox') == null &&
      registered.every((entry) => entry.id !== MAILBOX_SOURCE_ID) &&
      registered.some((entry) => entry.id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      createNativeActivityTimelineSource().id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
  )
}

{
  assert(
    '6. no emailMailbox capability is introduced',
    !Object.prototype.hasOwnProperty.call(INTEGRATION_CAPABILITIES, 'emailMailbox') &&
      INTEGRATION_CAPABILITIES.emailDelivery === false &&
      INTEGRATION_CAPABILITIES.calendar === false &&
      INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
      INTEGRATION_CAPABILITIES.thirdPartyIntegrations === false &&
      INTEGRATION_CAPABILITIES.activityTimeline === true,
  )
}

{
  resetNativeTimeline()
  const created = (await ingestCorrelated({ externalMessageId: 'ext-msg-neutral' })).activity
  const entry = matchingEmail(await timelineFor(studio), 'ext-msg-neutral')[0]
  const serialized = JSON.stringify(entry)
  assert(
    '7. timeline visibility uses provider-neutral mailbox identity',
    created.attributes.mailboxId === 'mailbox-studio-inbox' &&
      created.attributes.externalMessageId === 'ext-msg-neutral' &&
      created.companyId === studio &&
      entry.attributes.mailboxId === 'mailbox-studio-inbox' &&
      entry.attributes.externalMessageId === 'ext-msg-neutral' &&
      !Object.prototype.hasOwnProperty.call(entry.attributes, 'gmailMessageId') &&
      !Object.prototype.hasOwnProperty.call(entry.attributes, 'outlookId') &&
      !/gmail|outlook|graph|google|microsoft|resend|postmark|sendgrid|\bses\b|oauth/i.test(
        serialized,
      ),
  )
}

{
  resetNativeTimeline()
  const result = await ingestCorrelated({ externalMessageId: 'ext-msg-intake' })
  await ingestCorrelated({ externalMessageId: 'ext-msg-intake' })
  const accepted = eventsFor(studio)
  const event = accepted[0]
  assert(
    '8. correlated create follows Native Activity → H16.11; no mailbox.* event',
    accepted.length === 1 &&
      event.type === 'activity.email.logged' &&
      event.source.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      event.sourceEventIdentity === result.activity.id &&
      event.payload.kind === 'email' &&
      event.payload.type === 'email.logged' &&
      event.type.startsWith('activity.') &&
      !String(event.type).startsWith('mailbox.'),
  )
}

console.log('')
console.log('— boundaries —')

{
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-mailbox-timeline.mjs'), 'utf8')
  const httpPlugin = existsSync(join(root, 'server', 'integrationsMailboxPlugin.js'))
  const mailboxDir = join(root, 'src', 'integrations', 'mailbox')
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '9. this suite is independent and does not add a mailbox store, HTTP, or nested verifiers',
    !httpPlugin &&
      !existsSync(join(mailboxDir, 'store.js')) &&
      !existsSync(join(root, 'src', 'integrations', 'activities', 'sources', 'emailMailbox.js')) &&
      !/spawnSync\([^)]*verify-integrations-(activities|persistence|activity-authoring|activity-authoring-http|entity-resolution|activity-intake|mailbox|mailbox-ingest)\.mjs/.test(
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
console.log(`H16.12 mailbox timeline checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
