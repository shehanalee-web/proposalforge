/**
 * H16.8 persistence verification.
 *
 * Slice 8.1: contracts, native schema, authoring AND durable-health gate.
 * Slice 8.2: port registry, null/memory adapters, shared conformance.
 * Slice 8.3: numbered SQL migrations, runner, secret-ref DSN.
 * No Postgres ActivityRepository, HTTP writes, or nested H16.7.
 * Never writes data/proposals.json.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { ACTIVITY_KIND, ACTIVITY_ORIGIN, ACTIVITY_SUBJECT_TYPE } from '../src/integrations/activities/types.js'
import {
  ACTIVITY_DATABASE_POOL_MAX_DEFAULT,
  ACTIVITY_DATABASE_URL_ENV,
  ACTIVITY_DATABASE_URL_REF_ENV,
} from '../src/persistence/types.js'
import {
  ACTIVITY_DATABASE_DEFAULT_REF,
  activityDatabaseSslOption,
  assertActivityPersistenceConfig,
  clearActivityPersistenceTestSecrets,
  isActivityPostgresConnectionString,
  readActivityDatabaseUrlRef,
  resolveActivityDatabasePoolMax,
  resolveActivityDatabaseUrl,
  setActivityPersistenceTestSecrets,
} from '../src/persistence/secrets.js'
import {
  ACTIVITY_MIGRATE_EXIT,
  expectedActivityMigrationIds,
  listActivityMigrationFiles,
  migrateActivities,
} from '../src/persistence/migrate.js'
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
  registerActivityRepository,
  getActivityRepository,
  resetActivityRepository,
  createMemoryActivityRepository,
  createNullActivityRepository,
  assertActivityRepositoryContract,
  assertActivityRepositoryConformance,
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

async function threwAsync(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

function asyncMethods() {
  return {
    async health() {
      return { ok: false, durable: false, migrated: null, message: 'x' }
    },
    async create() {},
    async get() {},
    async list() {},
    async update() {},
    async archive() {},
  }
}

console.log('')
console.log('— H16.8.2 port + null/memory —')

assert(
  '17. default registry is the null adapter',
  getActivityRepository().id === ACTIVITY_REPOSITORY_ID.NULL &&
    describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL,
)

{
  const repo = getActivityRepository()
  const createError = await threwAsync(() => repo.create(validNote()))
  const getError = await threwAsync(() => repo.get('act-x', DEFAULT_COMPANY_ID))
  const listError = await threwAsync(() => repo.list({ companyId: DEFAULT_COMPANY_ID }))
  const updateError = await threwAsync(() => repo.update('act-x', { body: 'x' }, DEFAULT_COMPANY_ID))
  const archiveError = await threwAsync(() => repo.archive('act-x', DEFAULT_COMPANY_ID))
  assert(
    '18. null adapter refuses reads and writes',
    [createError, getError, listError, updateError, archiveError].every(
      (error) =>
        error instanceof ForbiddenError && error.message === 'Activity persistence is not enabled.',
    ),
  )
}

{
  const error = threw(() =>
    registerActivityRepository({
      id: ACTIVITY_REPOSITORY_ID.MEMORY,
      describe() {
        return {
          id: ACTIVITY_REPOSITORY_ID.MEMORY,
          durable: true,
          mode: ACTIVITY_REPOSITORY_MODE.MEMORY,
        }
      },
      ...asyncMethods(),
    }),
  )
  assert('19. memory adapter cannot declare durable', error instanceof ValidationError)
}

{
  const error = threw(() =>
    registerActivityRepository({
      id: ACTIVITY_REPOSITORY_ID.POSTGRES,
      describe() {
        return {
          id: ACTIVITY_REPOSITORY_ID.POSTGRES,
          durable: false,
          mode: ACTIVITY_REPOSITORY_MODE.POSTGRES,
        }
      },
      ...asyncMethods(),
    }),
  )
  assert('20. postgres adapter without durable is refused', error instanceof ValidationError)
}

{
  const memory = createMemoryActivityRepository()
  registerActivityRepository(memory)
  assert(
    '21. memory describe is not durable',
    describeActivityRepository().id === ACTIVITY_REPOSITORY_ID.MEMORY &&
      describeActivityRepository().durable === false &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false &&
      getActivityCapabilities().durablePersistence === false,
  )
  await assertActivityRepositoryConformance(
    memory,
    { studio: DEFAULT_COMPANY_ID, other: 'company-harborline' },
    assert,
  )
}

resetActivityRepository()
assert(
  '22. reset returns to the null adapter',
  getActivityRepository().id === ACTIVITY_REPOSITORY_ID.NULL &&
    describeActivityRepository().durable === false,
)

assert(
  '23. null factory still satisfies the contract',
  assertActivityRepositoryContract(createNullActivityRepository()).mode ===
    ACTIVITY_REPOSITORY_MODE.NULL,
)

clearActivityAuthoringCapabilityOverrideForTests()
resetActivityRepository()

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function withEnv(overrides, fn) {
  const previous = new Map()
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined)
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).finally(restore)
    }
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

console.log('')
console.log('— H16.8.3 migrations + secret-ref DSN —')

{
  const files = listActivityMigrationFiles()
  const ids = expectedActivityMigrationIds()
  const names = readdirSync(join(root, 'src', 'persistence', 'sql')).filter((name) =>
    name.endsWith('.sql'),
  )
  assert(
    '24. numbered SQL files are 0001 then 0002',
    names.sort().join(',') === '0001_schema_migrations.sql,0002_activities.sql' &&
      ids.join(',') === '0001_schema_migrations,0002_activities' &&
      files[0].id === '0001_schema_migrations' &&
      files[1].id === '0002_activities',
  )
}

{
  const sql1 = readFileSync(
    join(root, 'src', 'persistence', 'sql', '0001_schema_migrations.sql'),
    'utf8',
  )
  assert(
    '25. 0001 creates schema_migrations',
    sql1.includes('CREATE TABLE IF NOT EXISTS schema_migrations') &&
      sql1.includes('id TEXT PRIMARY KEY') &&
      sql1.includes('applied_at TIMESTAMPTZ NOT NULL'),
  )
}

{
  const sql2 = readFileSync(join(root, 'src', 'persistence', 'sql', '0002_activities.sql'), 'utf8')
  assert(
    '26. 0002 creates activities with isolation indexes and checks',
    sql2.includes('CREATE TABLE IF NOT EXISTS activities') &&
      sql2.includes("kind IN ('note', 'call', 'meeting', 'email')") &&
      sql2.includes("origin IN ('user', 'agent')") &&
      sql2.includes('CONSTRAINT activities_state_null_check CHECK (state IS NULL)') &&
      sql2.includes('activities_company_occurred_idx') &&
      sql2.includes('activities_company_idempotency_uidx') &&
      sql2.includes('WHERE idempotency_key IS NOT NULL') &&
      !/pgvector|vector\s*\(/i.test(sql2) &&
      !/ROW LEVEL SECURITY/i.test(sql2),
  )
}

assert(
  '27. default DSN ref is env:ACTIVITY_DATABASE_URL',
  withEnv({ [ACTIVITY_DATABASE_URL_REF_ENV]: null }, () => readActivityDatabaseUrlRef()) ===
    ACTIVITY_DATABASE_DEFAULT_REF &&
    ACTIVITY_DATABASE_DEFAULT_REF === `env:${ACTIVITY_DATABASE_URL_ENV}`,
)

{
  const missing = withEnv(
    { [ACTIVITY_DATABASE_URL_ENV]: null, [ACTIVITY_DATABASE_URL_REF_ENV]: null },
    () => resolveActivityDatabaseUrl(),
  )
  assert(
    '28. missing DSN is unhealthy without throwing',
    missing.ok === false &&
      missing.url === null &&
      missing.message === 'Activity database URL is not configured.' &&
      !missing.message.includes('postgres://'),
  )
}

{
  const vault = withEnv(
    { [ACTIVITY_DATABASE_URL_REF_ENV]: 'vault:activity/dsn', [ACTIVITY_DATABASE_URL_ENV]: null },
    () => resolveActivityDatabaseUrl(),
  )
  assert(
    '29. unresolved vault ref is unhealthy without throwing',
    vault.ok === false &&
      vault.url === null &&
      vault.message === 'Activity database URL reference could not be resolved.',
  )
}

{
  setActivityPersistenceTestSecrets({
    'vault:activity/dsn': 'postgres://activity:secret@localhost:5432/proposalforge',
  })
  const resolved = withEnv(
    { [ACTIVITY_DATABASE_URL_REF_ENV]: 'vault:activity/dsn' },
    () => resolveActivityDatabaseUrl(),
  )
  clearActivityPersistenceTestSecrets()
  assert(
    '30. test seam resolves vault refs without leaking the DSN in the message',
    resolved.ok === true &&
      isActivityPostgresConnectionString(resolved.url) &&
      !String(resolved.message).includes('postgres://') &&
      !String(resolved.message).includes('secret'),
  )
}

{
  const invalid = withEnv(
    {
      [ACTIVITY_DATABASE_URL_REF_ENV]: null,
      [ACTIVITY_DATABASE_URL_ENV]: 'mysql://localhost/db',
    },
    () => resolveActivityDatabaseUrl(),
  )
  assert(
    '31. non-postgres DSN is refused without dumping the value',
    invalid.ok === false &&
      invalid.url === null &&
      invalid.message === 'Activity database URL is not a PostgreSQL connection string.' &&
      !String(invalid.message).includes('mysql://'),
  )
}

assert(
  '32. raw DSN fields are forbidden on persistence config',
  threw(() => assertActivityPersistenceConfig({ connectionString: 'postgres://x' })) instanceof
    ValidationError,
)

assert(
  '33. pool max defaults and clamps',
  withEnv({ ACTIVITY_DATABASE_POOL_MAX: null }, () => resolveActivityDatabasePoolMax()) ===
    ACTIVITY_DATABASE_POOL_MAX_DEFAULT &&
    withEnv({ ACTIVITY_DATABASE_POOL_MAX: '10' }, () => resolveActivityDatabasePoolMax()) === 10 &&
    withEnv({ ACTIVITY_DATABASE_POOL_MAX: '0' }, () => resolveActivityDatabasePoolMax()) === 1 &&
    withEnv({ ACTIVITY_DATABASE_POOL_MAX: '99' }, () => resolveActivityDatabasePoolMax()) === 10,
)

{
  const ssl = activityDatabaseSslOption(
    'postgres://localhost/db?sslmode=require',
  )
  const off = activityDatabaseSslOption('postgres://localhost/db')
  assert(
    '34. SSL follows sslmode only',
    ssl && ssl.rejectUnauthorized === false && off === undefined,
  )
}

{
  const result = await withEnv(
    { [ACTIVITY_DATABASE_URL_ENV]: null, [ACTIVITY_DATABASE_URL_REF_ENV]: null },
    () => migrateActivities(),
  )
  assert(
    '35. migrate refuses a missing DSN with exit 2',
    result.ok === false &&
      result.code === ACTIVITY_MIGRATE_EXIT.NO_DSN &&
      result.current === false &&
      !String(result.message).includes('postgres://'),
  )
}

{
  const env = { ...process.env, CI: process.env.CI || '1' }
  delete env[ACTIVITY_DATABASE_URL_ENV]
  delete env[ACTIVITY_DATABASE_URL_REF_ENV]
  const spawned = spawnSync(process.execPath, [join(root, 'scripts', 'migrate-activities.mjs')], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })
  const output = `${spawned.stdout || ''}${spawned.stderr || ''}`
  assert(
    '36. migrate CLI exits 2 without dumping env',
    spawned.status === ACTIVITY_MIGRATE_EXIT.NO_DSN &&
      output.includes('Activity database URL is not configured.') &&
      !output.includes('postgres://'),
  )
}

{
  const plugin = readFileSync(join(root, 'server', 'integrationsActivitiesPlugin.js'), 'utf8')
  const pkg = readFileSync(join(root, 'package.json'), 'utf8')
  assert(
    '37. HTTP plugin does not run migrations and postgres adapter is absent',
    !/persistence\/migrate|migrateActivities|migrate-activities/.test(plugin) &&
      !existsSync(join(root, 'src', 'persistence', 'activities', 'postgres.js')) &&
      !/"pg"\s*:/.test(pkg) &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.activityAuthoring === false &&
      isActivityAuthoringEnabled() === false,
  )
}

clearActivityPersistenceTestSecrets()
clearActivityAuthoringCapabilityOverrideForTests()
resetActivityRepository()

console.log('')
console.log(`H16.8 persistence checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
