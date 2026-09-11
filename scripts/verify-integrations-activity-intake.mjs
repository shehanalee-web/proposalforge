/**
 * H16.11 — Native Activity → H16.2 intake verification.
 *
 * Independent suite. Does not nest H16.7–H16.10 authoring/persistence/entity
 * verifiers. Never writes data/proposals.json.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_KINDS,
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_CANONICAL_SOURCE,
  AUTOMATION_INTAKE_REASON,
  AUTOMATION_INTAKE_SOURCE_DOMAINS,
  AUTOMATION_INTAKE_STATUS,
  AUTOMATION_SOURCE_DOMAIN,
  archiveStudioActivity,
  configureAutomationIntakeStore,
  createMemoryActivityRepository,
  createStudioActivity,
  emitNativeActivityCreated,
  evaluateAutomationRulesForEvent,
  getAutomationEventById,
  listAcceptedAutomationEventsForCompany,
  normalizeDomainEvent,
  onAutomationEventAccepted,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
  resetAutomationRulesStore,
  setAutomationEventAcceptedListener,
  updateStudioActivity,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const occurredAt = '2026-09-11T16:00:00.000Z'

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

async function caught(run) {
  try {
    await run()
    return null
  } catch (error) {
    return error
  }
}

function nativeInput(overrides = {}) {
  return {
    companyId: studio,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h1611-a' },
    subjectLine: 'Intake note',
    body: 'Must not be copied into automation payload.',
    attributes: { secretish: 'nope', duration: 12 },
    participants: [{ type: 'contact', id: 'contact-1', role: 'attendee' }],
    occurredAt,
    ...overrides,
  }
}

function eventsFor(companyId = studio) {
  return listAcceptedAutomationEventsForCompany(companyId)
}

function payloadKeys(event) {
  return Object.keys(event?.payload ?? {}).sort()
}

resetActivityRepository()
registerActivityRepository(createMemoryActivityRepository())
resetAutomationIntakeStore()
resetAutomationRulesStore()

console.log('— H16.11 native activity intake —')

{
  const received = []
  setAutomationEventAcceptedListener((event) => {
    received.push(event)
    return onAutomationEventAccepted(event)
  })

  const note = await createStudioActivity(nativeInput())
  const call = await createStudioActivity(
    nativeInput({
      kind: ACTIVITY_NATIVE_KIND.CALL,
      subjectLine: 'Intake call',
    }),
  )
  const meeting = await createStudioActivity(
    nativeInput({
      kind: ACTIVITY_NATIVE_KIND.MEETING,
      subjectLine: 'Intake meeting',
    }),
  )
  const email = await createStudioActivity(
    nativeInput({
      kind: ACTIVITY_NATIVE_KIND.EMAIL,
      subjectLine: 'Intake email',
    }),
  )

  const accepted = eventsFor(studio)
  const byId = Object.fromEntries(accepted.map((event) => [event.sourceEventIdentity, event]))
  const noteEvent = byId[note.id]
  const callEvent = byId[call.id]
  const meetingEvent = byId[meeting.id]
  const emailEvent = byId[email.id]
  const ruleRuns = evaluateAutomationRulesForEvent(noteEvent)

  assert(
    '1. native note create is accepted into H16.2',
    noteEvent?.intake?.status === AUTOMATION_INTAKE_STATUS.ACCEPTED &&
      noteEvent.ok !== false,
  )
  assert(
    '2. native call create is accepted',
    callEvent?.type === 'activity.call.logged' &&
      callEvent.intake.status === AUTOMATION_INTAKE_STATUS.ACCEPTED,
  )
  assert(
    '3. native meeting create is accepted',
    meetingEvent?.type === 'activity.meeting.logged',
  )
  assert(
    '4. native email create is accepted',
    emailEvent?.type === 'activity.email.logged',
  )
  assert(
    '5. event types use the activity.* namespace',
    noteEvent?.type === 'activity.note.created' &&
      callEvent?.type === 'activity.call.logged' &&
      meetingEvent?.type === 'activity.meeting.logged' &&
      emailEvent?.type === 'activity.email.logged',
  )
  assert(
    '6. sourceDomain is activity',
    noteEvent?.source?.domain === AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      noteEvent.source.entityType === 'activity',
  )
  assert(
    '7. sourceEventIdentity is the NativeActivity id',
    noteEvent?.sourceEventIdentity === note.id &&
      noteEvent.source.eventId === note.id &&
      noteEvent.source.entityId === note.id &&
      String(note.id).startsWith('act-'),
  )
  assert('8. companyId is preserved', noteEvent?.companyId === studio)
  assert(
    '9. proposal subject sets correlation.proposalId',
    noteEvent?.correlation?.proposalId === 'prop-h1611-a',
  )
  assert(
    '11. payload is sanitized to the locked fields',
    payloadKeys(noteEvent).every((key) =>
      ['kind', 'type', 'subjectType', 'subjectLine'].includes(key),
    ) &&
      noteEvent.payload.kind === ACTIVITY_NATIVE_KIND.NOTE &&
      noteEvent.payload.type === ACTIVITY_NATIVE_TYPE.NOTE_CREATED &&
      noteEvent.payload.subjectType === ACTIVITY_SUBJECT_TYPE.PROPOSAL &&
      noteEvent.payload.subjectLine === 'Intake note',
  )
  assert('12. body is not copied', noteEvent?.payload?.body == null)
  assert(
    '13. attributes are not copied',
    noteEvent?.payload?.attributes == null && noteEvent?.payload?.duration == null,
  )
  assert('14. participants are not copied', noteEvent?.payload?.participants == null)
  assert(
    '15. entity objects are not copied',
    noteEvent?.payload?.entity == null && noteEvent?.payload?.displayName == null,
  )
  assert(
    '22. H16.3 listener receives the accepted event without a matching rule',
    received.some((event) => event.sourceEventIdentity === note.id) &&
      Array.isArray(ruleRuns) &&
      ruleRuns.length === 0,
  )

  setAutomationEventAcceptedListener(onAutomationEventAccepted)
}

{
  resetAutomationIntakeStore()
  const contact = await createStudioActivity(
    nativeInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' },
      subjectLine: 'Contact note',
    }),
  )
  const company = await createStudioActivity(
    nativeInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.COMPANY, id: 'company-1' },
      subjectLine: 'Company note',
    }),
  )
  const deal = await createStudioActivity(
    nativeInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.DEAL, id: 'deal-1' },
      subjectLine: 'Deal note',
    }),
  )
  const byId = Object.fromEntries(eventsFor(studio).map((event) => [event.sourceEventIdentity, event]))
  assert(
    '10. contact/company/deal subjects do not invent proposalId',
    byId[contact.id]?.correlation?.proposalId == null &&
      byId[company.id]?.correlation?.proposalId == null &&
      byId[deal.id]?.correlation?.proposalId == null &&
      byId[contact.id]?.payload?.subjectType === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      byId[company.id]?.payload?.subjectType === ACTIVITY_SUBJECT_TYPE.COMPANY &&
      byId[deal.id]?.payload?.subjectType === ACTIVITY_SUBJECT_TYPE.DEAL,
  )
}

{
  resetAutomationIntakeStore()
  const first = await createStudioActivity(
    nativeInput({ idempotencyKey: 'h1611-replay', subjectLine: 'Replay' }),
  )
  const second = await createStudioActivity(
    nativeInput({ idempotencyKey: 'h1611-replay', subjectLine: 'Replay' }),
  )
  const accepted = eventsFor(studio).filter((event) => event.sourceEventIdentity === first.id)
  const replay = emitNativeActivityCreated(first)
  assert(
    '16. replay produces DUPLICATE',
    first.id === second.id &&
      accepted.length === 1 &&
      replay?.duplicate === true &&
      replay.status === AUTOMATION_INTAKE_STATUS.DUPLICATE,
  )
}

{
  resetAutomationIntakeStore()
  const created = await createStudioActivity(nativeInput({ subjectLine: 'Isolation' }))
  const eventId = eventsFor(studio)[0]?.id
  let crossByEventId = null
  try {
    getAutomationEventById(otherCompany, eventId)
  } catch (error) {
    crossByEventId = error
  }
  assert(
    '17. company isolation remains intact',
    eventsFor(otherCompany).length === 0 &&
      eventId &&
      crossByEventId instanceof ForbiddenError &&
      !String(crossByEventId.message).includes(otherCompany) &&
      !String(crossByEventId.message).includes(created.id) &&
      !String(crossByEventId.message).includes(eventId),
  )
}

{
  resetAutomationIntakeStore()
  const created = await createStudioActivity(nativeInput({ subjectLine: 'Mutations' }))
  await updateStudioActivity(created.id, { subjectLine: 'Patched' }, studio)
  await archiveStudioActivity(created.id, studio)
  assert(
    '18. PATCH does not ingest',
    eventsFor(studio).length === 1 && eventsFor(studio)[0].sourceEventIdentity === created.id,
  )
  assert(
    '19. archive does not ingest',
    eventsFor(studio).length === 1 && eventsFor(studio)[0].payload.subjectLine === 'Mutations',
  )
}

{
  const close = normalizeDomainEvent({
    sourceDomain: AUTOMATION_SOURCE_DOMAIN.COMMERCIAL_CLOSE,
    companyId: studio,
    rawEvent: { id: 'close-1', type: 'status_changed', companyId: studio },
  })
  assert(
    '20. CLOSE remains ignored by intake',
    close.status === AUTOMATION_INTAKE_STATUS.IGNORED &&
      close.reason === AUTOMATION_INTAKE_REASON.CANONICAL_SOURCE_ELSEWHERE,
  )
}

{
  resetAutomationIntakeStore()
  const task = await caught(() => createStudioActivity(nativeInput({ kind: 'task' })))
  assert(
    '21. TASK remains absent and is rejected',
    task instanceof ValidationError &&
      !Object.prototype.hasOwnProperty.call(ACTIVITY_KIND, 'TASK') &&
      !ACTIVITY_KINDS.includes('task') &&
      eventsFor(studio).length === 0,
  )
}

{
  resetAutomationIntakeStore()
  const repo = createMemoryActivityRepository()
  registerActivityRepository(repo)
  const direct = await repo.create({
    companyId: studio,
    origin: 'user',
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    type: ACTIVITY_NATIVE_TYPE.NOTE_CREATED,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h1611-direct' },
    occurredAt,
    actor: { id: 'user-1', kind: 'user' },
    subjectLine: 'Direct create',
    body: 'Bypass',
  })
  assert(
    '23. repository direct-create bypass does not emit',
    String(direct.id).startsWith('act-') && eventsFor(studio).length === 0,
  )
  registerActivityRepository(createMemoryActivityRepository())
}

{
  resetAutomationIntakeStore()
  configureAutomationIntakeStore({
    persist() {
      throw new Error('intake persist failed')
    },
  })
  const created = await createStudioActivity(nativeInput({ subjectLine: 'Persist down' }))
  configureAutomationIntakeStore({})
  assert(
    '24. fan-out failure does not fail the Activity create',
    String(created.id).startsWith('act-') && created.subjectLine === 'Persist down',
  )
}

{
  const authoringPlugin = readFileSync(
    join(root, 'server', 'integrationsActivityAuthoringPlugin.js'),
    'utf8',
  )
  const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
  const productionSource = readFileSync(join(root, 'server', 'productionApi.js'), 'utf8')
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-activity-intake.mjs'), 'utf8')
  assert(
    '25. no /api/entities route is introduced',
    !/\/api\/entities/.test(authoringPlugin + viteSource + productionSource) &&
      !existsSync(join(root, 'server', 'integrationsEntitiesPlugin.js')),
  )
  assert(
    '26. ACTIVITY is self-canonical and this suite does not nest H16.7–H16.10',
    AUTOMATION_INTAKE_SOURCE_DOMAINS.includes(AUTOMATION_SOURCE_DOMAIN.ACTIVITY) &&
      AUTOMATION_CANONICAL_SOURCE[AUTOMATION_SOURCE_DOMAIN.ACTIVITY] ===
        AUTOMATION_SOURCE_DOMAIN.ACTIVITY &&
      !/spawnSync\([^)]*verify-integrations-(activities|persistence|activity-authoring|activity-authoring-http|entity-resolution)\.mjs/.test(
        ownSource,
      ),
  )
}

resetAutomationIntakeStore()
resetActivityRepository()
resetAutomationRulesStore()
setAutomationEventAcceptedListener(onAutomationEventAccepted)
configureAutomationIntakeStore({})

console.log('')
console.log(`H16.11 activity intake checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
