/**
 * H16.8 Slice 8.1 — Activity persistence contracts.
 *
 * Types, native Activity schema, capability flags, and the authoring AND
 * durable-health gate. No adapters, migrations, HTTP writes, or nested H16.7.
 * Never writes data/proposals.json.
 */
import { ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { ACTIVITY_KIND, ACTIVITY_ORIGIN, ACTIVITY_SUBJECT_TYPE } from '../src/integrations/activities/types.js'
import {
  INTEGRATION_CAPABILITIES,
  getActivityCapabilities,
  isActivityAuthoringEnabled,
  setActivityAuthoringCapabilityOverrideForTests,
  clearActivityAuthoringCapabilityOverrideForTests,
  describeActivityRepository,
  isDurableActivityRepositoryHealthy,
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_NATIVE_ID_PREFIX,
  makeNativeActivity,
  cloneNativeActivity,
} from '../src/integrations/index.js'

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

function validNote(overrides = {}) {
  return {
    companyId: DEFAULT_COMPANY_ID,
    origin: ACTIVITY_ORIGIN.USER,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    type: ACTIVITY_NATIVE_TYPE.NOTE_CREATED,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h168-a' },
    occurredAt: '2026-09-10T12:00:00.000Z',
    actor: { id: 'user-1', kind: 'user' },
    subjectLine: 'Kickoff notes',
    body: 'Discussed scope.',
    ...overrides,
  }
}

console.log('— H16.8.1 capabilities —')

assert(
  '1. activityPersistence === true',
  INTEGRATION_CAPABILITIES.activityPersistence === true,
)
assert(
  '2. activityAuthoring === false',
  INTEGRATION_CAPABILITIES.activityAuthoring === false &&
    isActivityAuthoringEnabled() === false,
)
assert(
  '3. authoring stays false without a healthy durable adapter',
  (() => {
    setActivityAuthoringCapabilityOverrideForTests(true)
    const enabled = isActivityAuthoringEnabled()
    clearActivityAuthoringCapabilityOverrideForTests()
    return enabled === false
  })(),
)
assert(
  '4. repository descriptor is the null stub',
  describeActivityRepository().id === ACTIVITY_REPOSITORY_ID.NULL &&
    describeActivityRepository().durable === false &&
    describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL &&
    isDurableActivityRepositoryHealthy() === false,
)
{
  const caps = getActivityCapabilities()
  assert(
    '5. capabilities derive durablePersistence from the stub',
    caps.activityPersistence === true &&
      caps.activityAuthoring === false &&
      caps.durablePersistence === false &&
      caps.repository.id === ACTIVITY_REPOSITORY_ID.NULL &&
      caps.repository.durable === false &&
      caps.repository.healthy === false,
  )
}

console.log('')
console.log('— H16.8.1 native Activity schema —')

{
  const record = makeNativeActivity(validNote())
  assert(
    '6. a valid note persists as a native record',
    record.id.startsWith(`${ACTIVITY_NATIVE_ID_PREFIX}-`) &&
      record.companyId === DEFAULT_COMPANY_ID &&
      record.kind === ACTIVITY_NATIVE_KIND.NOTE &&
      record.type === ACTIVITY_NATIVE_TYPE.NOTE_CREATED &&
      record.origin === ACTIVITY_ORIGIN.USER &&
      record.state === null &&
      record.source.domain === 'activity' &&
      record.source.entityId === record.id,
  )
  assert(
    '7. cloneNativeActivity round-trips',
    cloneNativeActivity(record).id === record.id &&
      cloneNativeActivity(record).subjectLine === record.subjectLine,
  )
}

assert(
  '8. missing companyId is rejected',
  threw(() => makeNativeActivity(validNote({ companyId: '' }))) instanceof ValidationError,
)
assert(
  '9. system_event kind is rejected',
  threw(() =>
    makeNativeActivity(
      validNote({ kind: ACTIVITY_KIND.SYSTEM_EVENT, type: 'proposal.viewed' }),
    ),
  ) instanceof ValidationError,
)
assert(
  '10. origin system is rejected',
  threw(() => makeNativeActivity(validNote({ origin: ACTIVITY_ORIGIN.SYSTEM }))) instanceof
    ValidationError,
)
assert(
  '11. task kind is rejected',
  threw(() => makeNativeActivity(validNote({ kind: 'task', type: 'task.created' }))) instanceof
    ValidationError,
)
assert(
  '12. kind/type mismatch is rejected',
  threw(() =>
    makeNativeActivity(validNote({ kind: ACTIVITY_NATIVE_KIND.CALL })),
  ) instanceof ValidationError,
)
assert(
  '13. non-null state is rejected',
  threw(() => makeNativeActivity(validNote({ state: 'open' }))) instanceof ValidationError,
)
assert(
  '14. Contact subjects are stored without resolution',
  makeNativeActivity(
    validNote({ subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' } }),
  ).subject.type === ACTIVITY_SUBJECT_TYPE.CONTACT,
)
assert(
  '15. credential-shaped attributes are dropped',
  makeNativeActivity(
    validNote({ attributes: { summary: 'ok', apiKey: 'secret', token: 'x' } }),
  ).attributes.summary === 'ok' &&
    !('apiKey' in
      makeNativeActivity(
        validNote({ attributes: { summary: 'ok', apiKey: 'secret', token: 'x' } }),
      ).attributes),
)
assert(
  '16. raw secret fields on the record are rejected',
  threw(() => makeNativeActivity(validNote({ password: 'nope' }))) instanceof ValidationError,
)

clearActivityAuthoringCapabilityOverrideForTests()

console.log('')
console.log(`H16.8.1 persistence contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
