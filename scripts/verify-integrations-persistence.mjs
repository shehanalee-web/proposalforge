/**
 * H16.8 persistence verification.
 *
 * Slice 8.1: contracts, native schema, authoring AND durable-health gate.
 * Slice 8.2: port registry, null/memory adapters, shared conformance.
 * Slice 8.3: numbered SQL migrations, runner, secret-ref DSN.
 * Slice 8.4: Postgres ActivityRepository. Skip live cases without a DSN.
 * Slice 8.5: boot null/postgres, derived capabilities, GET-only.
 * Slice 8.6: closing assertion suite. H16.7 stays unnested.
 * Slice 9.3: native_activity TimelineSource over the registered repository.
 * Authoring HTTP stays out. Never writes data/proposals.json.
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
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  TIMELINE_SOURCE_PRIORITY,
  assertTimelineSourceContract,
  registerTimelineSource,
  resetTimelineSources,
  listRegisteredTimelineSources,
  createNativeActivityTimelineSource,
  buildTimeline,
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
  createPostgresActivityRepository,
  resetPostgresActivityRepository,
  ensureActivityPersistence,
  getActivityRepositoryHealth,
  refreshActivityRepositoryHealth,
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
  assert(
    '37. HTTP plugin does not run migrations',
    !/persistence\/migrate|migrateActivities|migrate-activities/.test(plugin) &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.activityAuthoring === false &&
      isActivityAuthoringEnabled() === false,
  )
}

function collectJs(dir) {
  let text = ''
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, entry.name)
    if (entry.isDirectory()) text += collectJs(next)
    else if (entry.name.endsWith('.js')) text += readFileSync(next, 'utf8')
  }
  return text
}

console.log('')
console.log('— H16.8.4 postgres adapter —')

{
  const pkg = readFileSync(join(root, 'package.json'), 'utf8')
  const postgres = createPostgresActivityRepository()
  assert(
    '38. pg protocol client is installed; postgres adapter is durable',
    /"pg"\s*:\s*"\^8/.test(pkg) &&
      !/"@vercel\/postgres"|"@neondatabase\/serverless"|"@supabase\/supabase-js"/.test(pkg) &&
      !/"prisma"|"drizzle-orm"/.test(pkg) &&
      existsSync(join(root, 'src', 'persistence', 'activities', 'postgres.js')) &&
      postgres.describe().id === ACTIVITY_REPOSITORY_ID.POSTGRES &&
      postgres.describe().durable === true &&
      postgres.describe().mode === ACTIVITY_REPOSITORY_MODE.POSTGRES &&
      assertActivityRepositoryContract(postgres).durable === true &&
      INTEGRATION_CAPABILITIES.vendorSdks === false,
  )
}

assert(
  '39. postgres factory is not inside src/integrations/activities',
  !/function\s+create\w*ActivityRepository|createPostgresActivityRepository/.test(
    collectJs(join(root, 'src', 'integrations', 'activities')),
  ),
)

{
  const health = await withEnv(
    { [ACTIVITY_DATABASE_URL_ENV]: null, [ACTIVITY_DATABASE_URL_REF_ENV]: null },
    () => createPostgresActivityRepository().health(),
  )
  assert(
    '40. postgres health without DSN is not ok and does not leak',
    health.ok === false &&
      health.durable === true &&
      health.migrated === false &&
      typeof health.message === 'string' &&
      !health.message.includes('postgres://'),
  )
}

{
  registerActivityRepository(createPostgresActivityRepository())
  assert(
    '41. activityAuthoring stays false with postgres registered',
    INTEGRATION_CAPABILITIES.activityAuthoring === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  const dsn = resolveActivityDatabaseUrl()
  if (!dsn.ok) {
    assert('42. postgres live conformance skipped without DSN', true)
    assert('43. postgres SQL injection case skipped without DSN', true)
  } else {
    const first = await migrateActivities()
    const second = await migrateActivities()
    assert(
      '42. migrate is idempotent before postgres conformance',
      first.ok === true && second.ok === true && second.current === true && second.applied.length === 0,
    )
    const repo = createPostgresActivityRepository()
    registerActivityRepository(repo)
    await assertActivityRepositoryConformance(
      repo,
      { studio: DEFAULT_COMPANY_ID, other: 'company-harborline' },
      assert,
    )
    const evil = "p'; DROP TABLE activities; --"
    const created = await repo.create({
      companyId: DEFAULT_COMPANY_ID,
      origin: ACTIVITY_ORIGIN.USER,
      kind: ACTIVITY_NATIVE_KIND.NOTE,
      type: ACTIVITY_NATIVE_TYPE.NOTE_CREATED,
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: evil },
      occurredAt: '2026-09-10T12:00:00.000Z',
      actor: { id: 'user-1', kind: 'user' },
      subjectLine: 'Injection probe',
      body: 'Should store as subject id.',
    })
    const listed = await repo.list({ companyId: DEFAULT_COMPANY_ID, limit: 5 })
    const health = await repo.health()
    assert(
      '43. SQL in subjectId does not drop activities',
      created.subject.id.length > 0 &&
        health.ok === true &&
        Array.isArray(listed.entries) &&
        !String(health.message).includes('postgres://'),
    )
    await resetPostgresActivityRepository()
    resetActivityRepository()
  }
}

console.log('')
console.log('— H16.8.5 boot + capabilities —')

function invokePlugin(plugin, method, url) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value
      },
      end(body) {
        let parsed = null
        try {
          parsed = body ? JSON.parse(body) : null
        } catch {
          parsed = body
        }
        resolve({ status: this.statusCode, body: parsed, nextCalled: false })
      },
    }
    Promise.resolve(
      plugin.handle({ method, url }, res, () => {
        resolve({ status: 0, body: null, nextCalled: true })
      }),
    ).catch(reject)
  })
}

{
  resetActivityRepository()
  const descriptor = await withEnv(
    { [ACTIVITY_DATABASE_URL_ENV]: null, [ACTIVITY_DATABASE_URL_REF_ENV]: null },
    () => ensureActivityPersistence(),
  )
  const caps = getActivityCapabilities()
  const health = getActivityRepositoryHealth()
  assert(
    '44. boot without DSN stays on the null adapter',
    descriptor.id === ACTIVITY_REPOSITORY_ID.NULL &&
      descriptor.durable === false &&
      health.ok === false &&
      !String(health.message).includes('postgres://') &&
      caps.durablePersistence === false &&
      caps.activityAuthoring === false &&
      caps.repository.id === ACTIVITY_REPOSITORY_ID.NULL &&
      caps.repository.healthy === false &&
      isDurableActivityRepositoryHealthy() === false,
  )
}

{
  registerActivityRepository(createPostgresActivityRepository())
  const caps = getActivityCapabilities()
  assert(
    '45. postgres is not durable-healthy until health is confirmed',
    caps.repository.durable === true &&
      caps.repository.healthy === false &&
      caps.durablePersistence === false &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  const { integrationsActivitiesPlugin } = await import(
    '../server/integrationsActivitiesPlugin.js'
  )
  resetActivityRepository()
  const plugin = integrationsActivitiesPlugin()
  const pluginSource = readFileSync(
    join(root, 'server', 'integrationsActivitiesPlugin.js'),
    'utf8',
  )
  const caps = await withEnv(
    { [ACTIVITY_DATABASE_URL_ENV]: null, [ACTIVITY_DATABASE_URL_REF_ENV]: null },
    () => invokePlugin(plugin, 'GET', '/api/activities/capabilities'),
  )
  const skipped = await withEnv(
    { [ACTIVITY_DATABASE_URL_ENV]: null, [ACTIVITY_DATABASE_URL_REF_ENV]: null },
    () => invokePlugin(plugin, 'POST', '/api/activities/capabilities'),
  )
  const payload = JSON.stringify(caps.body || {})
  assert(
    '46. GET capabilities is derived and stays GET-only',
    caps.status === 200 &&
      caps.body.capabilities.activityPersistence === true &&
      caps.body.capabilities.durablePersistence === false &&
      caps.body.capabilities.activityAuthoring === false &&
      caps.body.capabilities.repository.id === ACTIVITY_REPOSITORY_ID.NULL &&
      !payload.includes('postgres://') &&
      skipped.nextCalled === true &&
      pluginSource.includes("req.method !== 'GET'") &&
      !/['"]POST['"]|['"]PATCH['"]|['"]PUT['"]|['"]DELETE['"]/.test(pluginSource) &&
      !/persistence\/migrate|migrateActivities|migrate-activities/.test(pluginSource) &&
      !/createPostgresActivityRepository/.test(pluginSource),
  )
  resetActivityRepository()
}

{
  registerActivityRepository(createMemoryActivityRepository())
  await refreshActivityRepositoryHealth()
  const caps = getActivityCapabilities()
  assert(
    '47. memory health does not enable durablePersistence',
    getActivityRepositoryHealth().ok === true &&
      caps.repository.durable === false &&
      caps.durablePersistence === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

console.log('')
console.log('— H16.8.6 assertion suite —')

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

resetActivityRepository()
clearActivityPersistenceTestSecrets()
clearActivityAuthoringCapabilityOverrideForTests()

{
  const caps = getActivityCapabilities()
  assert(
    '48. reset registry is null and durablePersistence stays false',
    getActivityRepository().id === ACTIVITY_REPOSITORY_ID.NULL &&
      caps.durablePersistence === false &&
      caps.activityAuthoring === false &&
      caps.activityPersistence === true &&
      isActivityAuthoringEnabled() === false &&
      isDurableActivityRepositoryHealthy() === false,
  )
}

{
  const activitiesDir = join(root, 'src', 'integrations', 'activities')
  const moduleSource = stripComments(collectJs(activitiesDir))
  assert(
    '49. no ActivityRepository factory exists under src/integrations/activities',
    !/class\s+\w*ActivityRepository|function\s+create\w*ActivityRepository/.test(moduleSource) &&
      !readdirSync(activitiesDir).includes('persistence'),
  )
}

{
  const dataDir = join(root, 'data')
  const present = readdirSync(dataDir)
  const ownStore = present.filter((name) =>
    /^(activities|activity-timeline|timeline|timeline-cache)\.json$/i.test(name),
  )
  const proposalsDiff = spawnSync('git', ['diff', '--', 'data/proposals.json'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '50. no ephemeral activity JSON store and proposals.json is unmodified',
    ownStore.length === 0 &&
      !existsSync(join(dataDir, 'activities.json')) &&
      !(proposalsDiff.stdout || '').trim(),
  )
}

assert(
  '51. buildTimeline is asynchronous',
  typeof buildTimeline === 'function' && buildTimeline.constructor.name === 'AsyncFunction',
)

assert(
  '52. native_activity is allowlisted; no postgres-named TimelineSource',
  TIMELINE_SOURCE_IDS.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
    TIMELINE_SOURCE_IDS.every((id) => !/postgres/i.test(id)),
)

{
  const pluginSource = stripComments(
    readFileSync(join(root, 'server', 'integrationsActivitiesPlugin.js'), 'utf8'),
  )
  assert(
    '53. HTTP surface remains GET-only and vendorSdks stays false',
    pluginSource.includes("req.method !== 'GET'") &&
      !/['"]POST['"]|['"]PATCH['"]|['"]PUT['"]|['"]DELETE['"]/.test(pluginSource) &&
      INTEGRATION_CAPABILITIES.vendorSdks === false &&
      INTEGRATION_CAPABILITIES.activityAuthoring === false,
  )
  assert(
    '54. native_activity is registered at boot beside the projection sources',
    pluginSource.includes('createNativeActivityTimelineSource()') &&
      pluginSource.includes('TIMELINE_SOURCE_ID.NATIVE_ACTIVITY') &&
      typeof createNativeActivityTimelineSource === 'function' &&
      !/create\w*ActivityRepository/.test(pluginSource),
  )
}

console.log('')
console.log('— H16.9.3 native timeline source —')

{
  resetTimelineSources()
  resetActivityRepository()
  const source = createNativeActivityTimelineSource()
  const descriptor = assertTimelineSourceContract(source)
  const registered = registerTimelineSource(source)
  assert(
    '55. native_activity satisfies the TimelineSource contract at priority 110',
    source.id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      TIMELINE_SOURCE_ID.NATIVE_ACTIVITY === 'native_activity' &&
      descriptor.readOnly === true &&
      descriptor.storeRef === 'activity-repository' &&
      TIMELINE_SOURCE_PRIORITY[TIMELINE_SOURCE_ID.NATIVE_ACTIVITY] === 110 &&
      registered.priority === 110 &&
      listRegisteredTimelineSources()[0].id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
  )
}

{
  resetActivityRepository()
  const source = createNativeActivityTimelineSource()
  assert(
    '56. null repository disables the native source',
    describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL &&
      source.isEnabled() === false,
  )
  registerActivityRepository(createMemoryActivityRepository())
  assert(
    '57. memory repository enables the native source without authoring',
    source.isEnabled() === true &&
      INTEGRATION_CAPABILITIES.activityAuthoring === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  resetTimelineSources()
  resetActivityRepository()
  const memory = createMemoryActivityRepository()
  let forwarded = null
  registerActivityRepository({
    id: memory.id,
    describe: () => memory.describe(),
    health: (...args) => memory.health(...args),
    create: (...args) => memory.create(...args),
    get: (...args) => memory.get(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
    async list(query) {
      forwarded = query
      return memory.list(query)
    },
  })

  const created = await getActivityRepository().create(validNote(), {
    companyId: DEFAULT_COMPANY_ID,
  })
  const archived = await getActivityRepository().create(
    validNote({
      subjectLine: 'Archived note',
      occurredAt: '2026-09-10T12:00:00.000Z',
    }),
    { companyId: DEFAULT_COMPANY_ID },
  )
  await getActivityRepository().archive(archived.id, DEFAULT_COMPANY_ID)

  const source = createNativeActivityTimelineSource()
  const sinceIso = '2026-09-10T12:00:00.000Z'
  const untilIso = '2026-09-10T12:00:00.000Z'
  const candidates = await source.list({
    companyId: DEFAULT_COMPANY_ID,
    subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
    subjectId: 'prop-h168-a',
    kinds: [ACTIVITY_NATIVE_KIND.NOTE],
    origins: [ACTIVITY_ORIGIN.USER],
    audience: 'internal',
    since: sinceIso,
    until: untilIso,
    limit: 50,
  })
  const mapped = candidates.find((entry) => entry.nativeId === created.id)
  assert(
    '58. native records map to timeline candidates and skip archived rows',
    Array.isArray(candidates) &&
      candidates.length === 1 &&
      mapped &&
      mapped.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      mapped.nativeId === created.id &&
      mapped.companyId === created.companyId &&
      mapped.subject?.id === created.subject.id &&
      mapped.kind === created.kind &&
      mapped.type === created.type &&
      mapped.origin === created.origin &&
      mapped.audience === created.audience &&
      mapped.occurredAtRaw === created.occurredAt &&
      mapped.recordedAtRaw === created.recordedAt &&
      mapped.actor?.id === created.actor.id &&
      mapped.subjectLine === created.subjectLine &&
      mapped.body === created.body &&
      mapped.source?.entityId === created.source.entityId &&
      !('participants' in mapped) &&
      !candidates.some((entry) => entry.nativeId === archived.id),
  )
  assert(
    '59. repository list keeps includeArchived false and full ISO since/until',
    forwarded?.includeArchived === false &&
      forwarded?.since === sinceIso &&
      forwarded?.until === untilIso &&
      forwarded?.companyId === DEFAULT_COMPANY_ID &&
      forwarded?.subjectType === ACTIVITY_SUBJECT_TYPE.PROPOSAL &&
      forwarded?.subjectId === 'prop-h168-a' &&
      Array.isArray(forwarded?.kinds) &&
      Array.isArray(forwarded?.origins),
  )
  resetActivityRepository()
}

{
  resetTimelineSources()
  resetActivityRepository()
  const memory = createMemoryActivityRepository()
  registerActivityRepository({
    id: memory.id,
    describe: () => memory.describe(),
    health: (...args) => memory.health(...args),
    create: (...args) => memory.create(...args),
    get: (...args) => memory.get(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
    async list() {
      throw new Error('repository list failed')
    },
  })
  registerTimelineSource(createNativeActivityTimelineSource())
  registerTimelineSource({
    id: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    canonicalFor: [],
    isEnabled: () => true,
    list: () => [
      {
        sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
        nativeId: 'lev-h169-degraded',
        companyId: DEFAULT_COMPANY_ID,
        subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h168-a' },
        kind: ACTIVITY_KIND.SYSTEM_EVENT,
        type: 'living.viewed',
        origin: ACTIVITY_ORIGIN.SYSTEM,
        audience: 'internal',
        occurredAtRaw: '2026-09-10T12:00:00.000Z',
        recordedAtRaw: '2026-09-10T12:00:00.000Z',
        actor: { id: null, kind: 'system', displayName: null },
        subjectLine: 'viewed',
        body: '',
        attributes: {},
        source: {
          domain: 'living',
          entityType: 'living',
          entityId: 'lev-h169-degraded',
          eventId: 'lev-h169-degraded',
        },
      },
    ],
    describe: () => ({
      id: TIMELINE_SOURCE_ID.LIVING_EVENTS,
      readOnly: true,
      storeRef: 'living-events.json',
    }),
  })
  const page = await buildTimeline({ companyId: DEFAULT_COMPANY_ID, limit: 50 })
  assert(
    '60. repository list errors degrade native_activity instead of failing the timeline',
    page.diagnostics.sourcesDegraded.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      page.entries.length > 0,
  )
  resetTimelineSources()
  resetActivityRepository()
}

clearActivityPersistenceTestSecrets()
clearActivityAuthoringCapabilityOverrideForTests()
resetActivityRepository()
resetTimelineSources()

console.log('')
console.log(`H16.8 persistence checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
