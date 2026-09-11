/**
 * H16.9 — Activity Authoring final verification (Slice 9.6).
 *
 * Independent suite for the completed native authoring architecture.
 * Does not nest or invoke the H16.7 or H16.8 verification suites.
 * Deterministic offline tests use memory repositories, the port registry,
 * and test doubles. Memory is never treated as durable.
 * Never writes data/proposals.json. Does not auto-migrate on request.
 * H16.10 Slice 10.4 authorizes contact/company/deal subjects on HTTP POST.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  ACTIVITY_KIND,
  ACTIVITY_KINDS,
  ACTIVITY_ORIGIN,
  ACTIVITY_SUBJECT_TYPE,
} from '../src/integrations/activities/types.js'
import {
  AUTOMATION_INTAKE_SOURCE_DOMAINS,
  AUTOMATION_SOURCE_DOMAIN,
} from '../src/integrations/events/types.js'
import { resolveActivityDatabaseUrl } from '../src/persistence/secrets.js'
import {
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_NATIVE_TYPE,
  ACTIVITY_NATIVE_TYPE_BY_KIND,
  ACTIVITY_ENTITY_KIND,
  ACTIVITY_ENTITY_FORBIDDEN,
  ACTIVITY_ENTITY_NOT_FOUND,
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_MODE,
  INTEGRATION_CAPABILITIES,
  STUDIO_ACTIVITY_AUTHORING_ACTOR,
  TIMELINE_SOURCE_ID,
  TIMELINE_SOURCE_IDS,
  TIMELINE_SOURCE_PRIORITY,
  assertProposalAccess,
  assertTimelineSourceContract,
  archiveStudioActivity,
  buildTimeline,
  clearActivityAuthoringCapabilityOverrideForTests,
  configureTimelineProposalLookup,
  createMemoryActivityRepository,
  createNativeActivityTimelineSource,
  createPostgresActivityRepository,
  createStudioActivity,
  describeActivityRepository,
  getActivityRepository,
  getActivityRepositoryHealth,
  isActivityAuthoringEnabled,
  isDurableActivityRepositoryHealthy,
  listRegisteredTimelineSources,
  listStudioTimeline,
  listStudioTimelineForProposal,
  makeNativeActivity,
  refreshActivityRepositoryHealth,
  registerActivityRepository,
  registerTimelineSource,
  resetActivityEntityStore,
  resetActivityRepository,
  resetTimelineProposalLookup,
  resetTimelineSources,
  setActivityAuthoringCapabilityOverrideForTests,
} from '../src/integrations/index.js'
import { integrationsActivitiesPlugin } from '../server/integrationsActivitiesPlugin.js'
import { integrationsActivityAuthoringPlugin } from '../server/integrationsActivityAuthoringPlugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const otherCompany = 'co-h169-other'
const occurredAt = '2026-09-11T12:00:00.000Z'

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

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
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

function noteInput(overrides = {}) {
  return {
    companyId: DEFAULT_COMPANY_ID,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-supplied' },
    subjectLine: 'Authoring note',
    body: 'Logged from H16.9.',
    occurredAt,
    ...overrides,
  }
}

function invoke(plugin, { method, url, headers = {}, body = undefined }) {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    const headerMap = {}
    for (const [key, value] of Object.entries(headers)) {
      headerMap[String(key).toLowerCase()] = value
    }
    const req = {
      method,
      url,
      headers: headerMap,
      on(event, cb) {
        if (event === 'data' && payload) queueMicrotask(() => cb(payload))
        if (event === 'end') queueMicrotask(cb)
        return req
      },
      destroy() {},
    }
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value
      },
      end(raw) {
        let parsed = null
        try {
          parsed = raw ? JSON.parse(raw) : null
        } catch {
          parsed = raw
        }
        resolve({ status: this.statusCode, body: parsed, nextCalled: false })
      },
    }
    Promise.resolve(
      plugin.handle(req, res, () => {
        resolve({ status: 0, body: null, nextCalled: true })
      }),
    ).catch(reject)
  })
}

function wrapDurable(memory, { ok = true } = {}) {
  let createInput = null
  return {
    adapter: {
      id: ACTIVITY_REPOSITORY_ID.POSTGRES,
      describe() {
        return {
          id: ACTIVITY_REPOSITORY_ID.POSTGRES,
          durable: true,
          mode: ACTIVITY_REPOSITORY_MODE.POSTGRES,
        }
      },
      async health() {
        return {
          ok,
          durable: true,
          migrated: ok,
          message: ok ? 'Test durable adapter.' : 'Unhealthy durable adapter.',
        }
      },
      async create(input, context) {
        createInput = input
        return memory.create(input, context)
      },
      get: (...args) => memory.get(...args),
      list: (...args) => memory.list(...args),
      update: (...args) => memory.update(...args),
      archive: (...args) => memory.archive(...args),
    },
    lastCreate: () => createInput,
  }
}

function seedAuthoringEntities() {
  resetActivityEntityStore([
    {
      id: 'contact-1',
      companyId: DEFAULT_COMPANY_ID,
      kind: ACTIVITY_ENTITY_KIND.CONTACT,
      displayName: 'Contact One',
    },
    {
      id: 'contact-supplied',
      companyId: DEFAULT_COMPANY_ID,
      kind: ACTIVITY_ENTITY_KIND.CONTACT,
      displayName: 'Contact supplied',
    },
    {
      id: 'company-1',
      companyId: DEFAULT_COMPANY_ID,
      kind: ACTIVITY_ENTITY_KIND.COMPANY,
      displayName: 'Company One',
    },
    {
      id: 'deal-1',
      companyId: DEFAULT_COMPANY_ID,
      kind: ACTIVITY_ENTITY_KIND.DEAL,
      displayName: 'Deal One',
    },
    {
      id: 'contact-other',
      companyId: otherCompany,
      kind: ACTIVITY_ENTITY_KIND.CONTACT,
      displayName: 'Other contact',
    },
  ])
}

function isNativeSubject(subject, type, id) {
  if (!subject || typeof subject !== 'object' || Array.isArray(subject)) return false
  const keys = Object.keys(subject).sort()
  return (
    subject.type === type &&
    subject.id === id &&
    keys.length === 2 &&
    keys[0] === 'id' &&
    keys[1] === 'type'
  )
}

function seedProposalLookup() {
  configureTimelineProposalLookup((proposalId) => {
    const id = String(proposalId ?? '').trim()
    if (id === 'prop-h169-a') return { id, companyId: DEFAULT_COMPANY_ID }
    if (id === 'prop-h169-other') return { id, companyId: otherCompany }
    return null
  })
}

function livingStub() {
  return {
    id: TIMELINE_SOURCE_ID.LIVING_EVENTS,
    canonicalFor: [],
    isEnabled: () => true,
    list: () => [
      {
        sourceId: TIMELINE_SOURCE_ID.LIVING_EVENTS,
        nativeId: 'lev-h169-sync',
        companyId: DEFAULT_COMPANY_ID,
        subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h169-a' },
        kind: ACTIVITY_KIND.SYSTEM_EVENT,
        type: 'living.viewed',
        origin: ACTIVITY_ORIGIN.SYSTEM,
        audience: 'internal',
        occurredAtRaw: occurredAt,
        recordedAtRaw: occurredAt,
        actor: { id: null, kind: 'system', displayName: null },
        subjectLine: 'viewed',
        body: '',
        attributes: {},
        source: {
          domain: 'living',
          entityType: 'living',
          entityId: 'lev-h169-sync',
          eventId: 'lev-h169-sync',
        },
      },
    ],
    describe: () => ({
      id: TIMELINE_SOURCE_ID.LIVING_EVENTS,
      readOnly: true,
      storeRef: 'living-events.json',
    }),
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

const facadeSource = stripComments(
  readFileSync(join(root, 'src', 'integrations', 'activities', 'authoring.js'), 'utf8'),
)
const engineSource = stripComments(
  readFileSync(join(root, 'src', 'integrations', 'activities', 'engine.js'), 'utf8'),
)
const timelinePluginSource = stripComments(
  readFileSync(join(root, 'server', 'integrationsActivitiesPlugin.js'), 'utf8'),
)
const authoringPluginSource = stripComments(
  readFileSync(join(root, 'server', 'integrationsActivityAuthoringPlugin.js'), 'utf8'),
)
const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
const productionSource = readFileSync(join(root, 'server', 'productionApi.js'), 'utf8')
const activitiesModuleSource = stripComments(
  collectJs(join(root, 'src', 'integrations', 'activities')),
)
const persistenceDir = join(root, 'src', 'persistence', 'activities')

resetActivityRepository()
resetTimelineSources()
clearActivityAuthoringCapabilityOverrideForTests()
resetTimelineProposalLookup()
resetActivityEntityStore()

console.log('— A. Capability —')

assert(
  '1. INTEGRATION_CAPABILITIES.activityAuthoring === true',
  INTEGRATION_CAPABILITIES.activityAuthoring === true,
)
assert(
  '2. isActivityAuthoringEnabled is not equivalent to the capability flag',
  describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL &&
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
    isActivityAuthoringEnabled() === false,
)
assert(
  '3. derived authoring still requires the durable cached-health gate',
  engineSource.includes('isDurableActivityRepositoryHealthy()') &&
    /return requested === true && isDurableActivityRepositoryHealthy\(\) === true/.test(
      engineSource,
    ),
)

console.log('')
console.log('— B. Durable health gate —')

{
  const wrapped = wrapDurable(createMemoryActivityRepository())
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  setActivityAuthoringCapabilityOverrideForTests(false)
  assert(
    '4. capability false disables authoring even with durable health',
    isDurableActivityRepositoryHealthy() === true && isActivityAuthoringEnabled() === false,
  )
  clearActivityAuthoringCapabilityOverrideForTests()
  resetActivityRepository()
}

{
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
  assert(
    '5. capability true + null repository stays disabled',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
}

{
  registerActivityRepository(createMemoryActivityRepository())
  await refreshActivityRepositoryHealth()
  assert(
    '6. capability true + memory repository stays disabled; memory is not durable',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.MEMORY &&
      describeActivityRepository().durable === false &&
      getActivityRepositoryHealth().ok === true &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  const wrapped = wrapDurable(createMemoryActivityRepository(), { ok: false })
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  assert(
    '7. capability true + durable repository + cached health.ok false stays disabled',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      describeActivityRepository().durable === true &&
      getActivityRepositoryHealth().ok === false &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  const wrapped = wrapDurable(createMemoryActivityRepository())
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  assert(
    '8. capability true + durable repository + cached health.ok true enables authoring',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      describeActivityRepository().durable === true &&
      getActivityRepositoryHealth().ok === true &&
      isDurableActivityRepositoryHealthy() === true &&
      isActivityAuthoringEnabled() === true,
  )
  resetActivityRepository()
}

console.log('')
console.log('— C. Native timeline source —')

{
  let postgresNamedRejected = false
  try {
    assertTimelineSourceContract({
      id: 'postgres',
      isEnabled: () => true,
      list: () => [],
      describe: () => ({ id: 'postgres', readOnly: true, storeRef: 'pg' }),
    })
  } catch (error) {
    postgresNamedRejected = error instanceof ValidationError
  }
  assert(
    '9. native_activity is allowlisted; postgres-named sources remain forbidden',
    TIMELINE_SOURCE_IDS.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      TIMELINE_SOURCE_ID.NATIVE_ACTIVITY === 'native_activity' &&
      TIMELINE_SOURCE_IDS.every((id) => !/postgres/i.test(id)) &&
      postgresNamedRejected,
  )
}

assert(
  '10. final H16.9 allowlist has 9 timeline sources',
  TIMELINE_SOURCE_IDS.length === 9 &&
    TIMELINE_SOURCE_IDS[0] === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
)

{
  resetTimelineSources()
  const source = createNativeActivityTimelineSource()
  const descriptor = assertTimelineSourceContract(source)
  const registered = registerTimelineSource(source)
  assert(
    '11. native_activity is registered at priority 110',
    source.id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      descriptor.readOnly === true &&
      TIMELINE_SOURCE_PRIORITY[TIMELINE_SOURCE_ID.NATIVE_ACTIVITY] === 110 &&
      registered.priority === 110 &&
      listRegisteredTimelineSources()[0].id === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY,
  )
  assert(
    '12. describe().readOnly === true',
    source.describe().readOnly === true && source.describe().storeRef === 'activity-repository',
  )
  resetTimelineSources()
}

{
  resetActivityRepository()
  const source = createNativeActivityTimelineSource()
  assert(
    '13. null adapter disables the native source',
    describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL &&
      source.isEnabled() === false,
  )
  registerActivityRepository(createMemoryActivityRepository())
  assert(
    '14. memory adapter enables the native source',
    describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.MEMORY &&
      source.isEnabled() === true,
  )
  resetActivityRepository()
  registerActivityRepository(wrapDurable(createMemoryActivityRepository()).adapter)
  assert(
    '15. durable adapter enables the native source',
    describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.POSTGRES &&
      source.isEnabled() === true,
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
  const created = await createStudioActivity(
    noteInput({
      participants: [{ type: 'user', id: 'user-1', role: 'author' }],
    }),
  )
  const archived = await createStudioActivity(
    noteInput({
      subjectLine: 'Archived note',
      occurredAt: '2026-09-10T12:00:00.000Z',
    }),
  )
  await archiveStudioActivity(archived.id, DEFAULT_COMPANY_ID)
  const source = createNativeActivityTimelineSource()
  const candidates = await source.list({
    companyId: DEFAULT_COMPANY_ID,
    subjectType: ACTIVITY_SUBJECT_TYPE.CONTACT,
    subjectId: 'contact-supplied',
    kinds: [ACTIVITY_NATIVE_KIND.NOTE],
    origins: [ACTIVITY_ORIGIN.USER],
    audience: 'internal',
    since: '2026-09-10T12:00:00.000Z',
    until: occurredAt,
    limit: 50,
  })
  const mapped = candidates.find((entry) => entry.nativeId === created.id)
  assert(
    '16. list excludes archived rows and maps nativeId / occurredAtRaw / recordedAtRaw without participants',
    Array.isArray(candidates) &&
      candidates.length === 1 &&
      mapped &&
      mapped.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
      mapped.nativeId === created.id &&
      mapped.occurredAtRaw === created.occurredAt &&
      mapped.recordedAtRaw === created.recordedAt &&
      created.participants.length === 1 &&
      !('participants' in mapped) &&
      !candidates.some((entry) => entry.nativeId === archived.id),
  )
  assert(
    '17. list forwards companyId, subjectType, subjectId, kinds, origins, audience, since, until, limit',
    forwarded?.includeArchived === false &&
      forwarded?.companyId === DEFAULT_COMPANY_ID &&
      forwarded?.subjectType === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      forwarded?.subjectId === 'contact-supplied' &&
      Array.isArray(forwarded?.kinds) &&
      forwarded.kinds[0] === ACTIVITY_NATIVE_KIND.NOTE &&
      Array.isArray(forwarded?.origins) &&
      forwarded.origins[0] === ACTIVITY_ORIGIN.USER &&
      forwarded?.audience === 'internal' &&
      forwarded?.since === '2026-09-10T12:00:00.000Z' &&
      forwarded?.until === occurredAt &&
      forwarded?.limit === 50,
  )
  resetActivityRepository()
  resetTimelineSources()
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
  registerTimelineSource(livingStub())
  const page = await buildTimeline({ companyId: DEFAULT_COMPANY_ID, limit: 50 })
  assert(
    '18. repository errors are handled by existing degraded-source behavior',
    page.diagnostics.sourcesDegraded.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      page.entries.some((entry) => entry.nativeId === 'lev-h169-sync'),
  )
  resetTimelineSources()
  resetActivityRepository()
}

assert(
  '19. native_activity is registered at boot beside the projection sources',
  timelinePluginSource.includes('createNativeActivityTimelineSource()') &&
    timelinePluginSource.includes('TIMELINE_SOURCE_ID.NATIVE_ACTIVITY') &&
    typeof createNativeActivityTimelineSource === 'function',
)

{
  resetTimelineSources()
  const timeline = integrationsActivitiesPlugin()
  const sources = await invoke(timeline, {
    method: 'GET',
    url: `/api/activities/sources?companyId=${DEFAULT_COMPANY_ID}`,
  })
  const ids = (sources.body?.sources ?? []).map((entry) => entry.id)
  assert(
    '20. final runtime registration count is 9 including native_activity',
    sources.status === 200 &&
      ids.length === 9 &&
      ids.includes(TIMELINE_SOURCE_ID.NATIVE_ACTIVITY) &&
      listRegisteredTimelineSources().length === 9,
  )
  resetTimelineSources()
}

console.log('')
console.log('— D. Async timeline engine —')

assert(
  '21. buildTimeline is async',
  typeof buildTimeline === 'function' && buildTimeline.constructor.name === 'AsyncFunction',
)
assert(
  '22. listStudioTimeline is async',
  typeof listStudioTimeline === 'function' &&
    listStudioTimeline.constructor.name === 'AsyncFunction',
)
assert(
  '23. listStudioTimelineForProposal is async',
  typeof listStudioTimelineForProposal === 'function' &&
    listStudioTimelineForProposal.constructor.name === 'AsyncFunction',
)

{
  resetTimelineSources()
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  registerTimelineSource(livingStub())
  const page = await buildTimeline({ companyId: DEFAULT_COMPANY_ID, limit: 50 })
  assert(
    '24. synchronous existing sources continue to work through Promise.resolve',
    page.entries.some((entry) => entry.nativeId === 'lev-h169-sync') &&
      page.diagnostics.sourcesDegraded.length === 0,
  )
  resetTimelineSources()
  resetActivityRepository()
}

{
  resetTimelineSources()
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const created = await createStudioActivity(noteInput())
  registerTimelineSource(createNativeActivityTimelineSource())
  registerTimelineSource(livingStub())
  const page = await buildTimeline({ companyId: DEFAULT_COMPANY_ID, limit: 50 })
  const studio = await listStudioTimeline({ companyId: DEFAULT_COMPANY_ID, limit: 50 })
  assert(
    '25. native async source works through the engine without regressing sync sources',
    page.entries.some((entry) => entry.nativeId === created.id) &&
      page.entries.some((entry) => entry.nativeId === 'lev-h169-sync') &&
      studio.entries.some(
        (entry) =>
          entry.sourceId === TIMELINE_SOURCE_ID.NATIVE_ACTIVITY &&
          entry.provenance?.entityId === created.id,
      ),
  )
  resetTimelineSources()
  resetActivityRepository()
}

console.log('')
console.log('— E. Authoring facade —')

assert(
  '26. facade uses the registered repository and company scope; HTTP owns the capability gate',
  facadeSource.includes('getActivityRepository()') &&
    facadeSource.includes('evaluateIntegrationCompanyScope') &&
    facadeSource.includes('ACTIVITY_NATIVE_TYPE_BY_KIND') &&
    facadeSource.includes('ACTIVITY_ORIGIN.USER') &&
    facadeSource.includes('STUDIO_ACTIVITY_AUTHORING_ACTOR') &&
    !facadeSource.includes('isActivityAuthoringEnabled') &&
    !/create(Postgres|Memory|Null)ActivityRepository/.test(facadeSource),
)

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  clearActivityAuthoringCapabilityOverrideForTests()
  const created = await createStudioActivity(
    noteInput({ origin: ACTIVITY_ORIGIN.AGENT, actor: { id: 'intruder', kind: 'agent' } }),
  )
  assert(
    '27. facade remains reusable while derived authoring is disabled',
    isActivityAuthoringEnabled() === false &&
      String(created.id).startsWith('act-') &&
      created.origin === ACTIVITY_ORIGIN.USER &&
      created.actor.id === STUDIO_ACTIVITY_AUTHORING_ACTOR.id &&
      created.type === ACTIVITY_NATIVE_TYPE_BY_KIND[ACTIVITY_NATIVE_KIND.NOTE],
  )
  resetActivityRepository()
}

{
  resetActivityRepository()
  const memory = createMemoryActivityRepository()
  let delegated = false
  registerActivityRepository({
    id: memory.id,
    describe: () => memory.describe(),
    health: (...args) => memory.health(...args),
    async create(input, context) {
      delegated = true
      return memory.create(input, context)
    },
    get: (...args) => memory.get(...args),
    list: (...args) => memory.list(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
  })
  await createStudioActivity(noteInput())
  const missingCompany = await caught(() => createStudioActivity(noteInput({ companyId: '' })))
  const task = await caught(() => createStudioActivity(noteInput({ kind: 'task' })))
  assert(
    '28. facade delegates to the registered repository and rejects empty companyId / TASK',
    delegated === true &&
      missingCompany instanceof ValidationError &&
      task instanceof ValidationError,
  )
  resetActivityRepository()
}

console.log('')
console.log('— F. HTTP authoring plugin —')

assert(
  '29. authoring plugin exists and is registered beside the timeline plugin',
  existsSync(join(root, 'server', 'integrationsActivityAuthoringPlugin.js')) &&
    viteSource.includes('integrationsActivityAuthoringPlugin()') &&
    productionSource.includes('integrationsActivityAuthoringPlugin()') &&
    viteSource.includes('integrationsActivitiesPlugin()') &&
    productionSource.includes('integrationsActivitiesPlugin()'),
)
assert(
  '30. authoring plugin is a sibling of the GET-only timeline plugin',
  authoringPluginSource.includes("name: 'proposalforge-integrations-activity-authoring'") &&
    timelinePluginSource.includes("name: 'proposalforge-integrations-activities'") &&
    authoringPluginSource.includes('createStudioActivity') &&
    authoringPluginSource.includes('isActivityAuthoringEnabled') &&
    !authoringPluginSource.includes('integrationsActivitiesPlugin'),
)

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const plugin = integrationsActivityAuthoringPlugin()
  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput(),
  })
  assert(
    '31. disabled authoring returns HTTP 403 with the locked message',
    created.status === 403 && created.body?.message === 'Activity authoring is not enabled.',
  )
  resetActivityRepository()
}

{
  resetActivityRepository()
  seedProposalLookup()
  const wrapped = wrapDurable(createMemoryActivityRepository())
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  const plugin = integrationsActivityAuthoringPlugin()
  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    headers: { 'Idempotency-Key': 'h169-key-1' },
    body: noteInput({
      origin: ACTIVITY_ORIGIN.AGENT,
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h169-a' },
    }),
  })
  const fetched = await invoke(plugin, {
    method: 'GET',
    url: `/api/activities/${created.body?.activity?.id}?companyId=${DEFAULT_COMPANY_ID}`,
  })
  const patched = await invoke(plugin, {
    method: 'PATCH',
    url: `/api/activities/${created.body?.activity?.id}?companyId=${DEFAULT_COMPANY_ID}`,
    body: { subjectLine: 'Updated subject' },
  })
  const archived = await invoke(plugin, {
    method: 'POST',
    url: `/api/activities/${created.body?.activity?.id}/archive?companyId=${DEFAULT_COMPANY_ID}`,
  })
  assert(
    '32. POST /api/activities creates through the facade when authoring is enabled',
    created.status === 201 &&
      String(created.body?.activity?.id ?? '').startsWith('act-') &&
      created.body.activity.origin === ACTIVITY_ORIGIN.USER,
  )
  assert(
    '33. GET /api/activities/:id returns the native record',
    fetched.status === 200 && fetched.body?.activity?.id === created.body.activity.id,
  )
  assert(
    '34. PATCH /api/activities/:id updates through the facade',
    patched.status === 200 && patched.body?.activity?.subjectLine === 'Updated subject',
  )
  assert(
    '35. POST /api/activities/:id/archive archives through the facade',
    archived.status === 200 && Boolean(archived.body?.activity?.archivedAt),
  )
  assert(
    '36. Idempotency-Key is mapped to idempotencyKey',
    wrapped.lastCreate()?.idempotencyKey === 'h169-key-1',
  )
  resetActivityRepository()
  resetTimelineProposalLookup()
}

{
  resetActivityRepository()
  const wrapped = wrapDurable(createMemoryActivityRepository())
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  const plugin = integrationsActivityAuthoringPlugin()
  const put = await invoke(plugin, {
    method: 'PUT',
    url: '/api/activities/act-x',
    body: noteInput(),
  })
  const deleted = await invoke(plugin, {
    method: 'DELETE',
    url: '/api/activities/act-x',
  })
  assert('37. PUT is not implemented', put.nextCalled === true)
  assert('38. DELETE is not implemented', deleted.nextCalled === true)
  assert(
    '39. authoring plugin source has no PUT/DELETE and does not instantiate adapters',
    /method === 'POST'|method !== 'POST'/.test(authoringPluginSource) &&
      authoringPluginSource.includes("method === 'PATCH'") &&
      !/['"]PUT['"]|['"]DELETE['"]/.test(authoringPluginSource) &&
      !/create(Postgres|Memory|Null)ActivityRepository/.test(authoringPluginSource),
  )
  resetActivityRepository()
}

console.log('')
console.log('— H. Proposal access —')

assert(
  '40. authoring plugin reuses assertProposalAccess',
  authoringPluginSource.includes('assertProposalAccess(') &&
    typeof assertProposalAccess === 'function',
)

{
  resetActivityRepository()
  seedProposalLookup()
  registerActivityRepository(wrapDurable(createMemoryActivityRepository()).adapter)
  await refreshActivityRepositoryHealth()
  const plugin = integrationsActivityAuthoringPlugin()
  const missing = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-does-not-exist' },
    }),
  })
  const cross = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h169-other' },
    }),
  })
  const missingDirect = await caught(() =>
    Promise.resolve(
      assertProposalAccess(DEFAULT_COMPANY_ID, {
        type: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
        id: 'prop-does-not-exist',
      }),
    ),
  )
  const crossDirect = await caught(() =>
    Promise.resolve(
      assertProposalAccess(DEFAULT_COMPANY_ID, {
        type: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
        id: 'prop-h169-other',
      }),
    ),
  )
  assert(
    '41. nonexistent proposal returns 404',
    missing.status === 404 &&
      String(missing.body?.message ?? '').includes('not found') &&
      missingDirect instanceof NotFoundError,
  )
  assert(
    '42. cross-company proposal returns 403 without leaking the other company id',
    cross.status === 403 &&
      !String(cross.body?.message ?? '').includes('prop-h169-other') &&
      !String(cross.body?.message ?? '').includes(otherCompany) &&
      crossDirect instanceof ForbiddenError &&
      !String(crossDirect.message).includes('prop-h169-other'),
  )
  resetActivityRepository()
  resetTimelineProposalLookup()
}

console.log('')
console.log('— I. Contact / company / deal —')

{
  resetActivityRepository()
  seedAuthoringEntities()
  const wrapped = wrapDurable(createMemoryActivityRepository())
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  const plugin = integrationsActivityAuthoringPlugin()
  const contact = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({ subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' } }),
  })
  const company = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({ subject: { type: ACTIVITY_SUBJECT_TYPE.COMPANY, id: 'company-1' } }),
  })
  const deal = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({ subject: { type: ACTIVITY_SUBJECT_TYPE.DEAL, id: 'deal-1' } }),
  })
  const storedDeal = wrapped.lastCreate()?.subject
  const missing = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-missing' },
    }),
  })
  const cross = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({
      subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-other' },
    }),
  })
  const proposalBeforeEntity =
    authoringPluginSource.indexOf('assertProposalAccess(companyId, input.subject ?? {})') <
    authoringPluginSource.indexOf('assertActivityEntityAccess(companyId, input.subject ?? {})')
  assert(
    '43. seeded contact-1/company-1/deal-1 authoring stores { type, id }',
    contact.status === 201 &&
      isNativeSubject(contact.body.activity.subject, ACTIVITY_SUBJECT_TYPE.CONTACT, 'contact-1') &&
      company.status === 201 &&
      isNativeSubject(company.body.activity.subject, ACTIVITY_SUBJECT_TYPE.COMPANY, 'company-1') &&
      deal.status === 201 &&
      isNativeSubject(deal.body.activity.subject, ACTIVITY_SUBJECT_TYPE.DEAL, 'deal-1') &&
      isNativeSubject(storedDeal, ACTIVITY_SUBJECT_TYPE.DEAL, 'deal-1') &&
      authoringPluginSource.includes('assertActivityEntityAccess') &&
      proposalBeforeEntity &&
      !authoringPluginSource.includes('resolveActivityEntity') &&
      !/resolve(Contact|Company|Deal)|lookupContact|lookupCompany|lookupDeal/.test(
        authoringPluginSource + facadeSource,
      ),
  )
  assert(
    '43b. missing entity authoring returns 404 without leaking ids',
    missing.status === 404 &&
      missing.body?.message === ACTIVITY_ENTITY_NOT_FOUND &&
      missing.body?.message === 'Activity subject not found.' &&
      !String(missing.body?.message ?? '').includes('contact-missing') &&
      !String(JSON.stringify(missing.body ?? {})).includes(otherCompany),
  )
  assert(
    '43c. cross-company entity authoring returns 403 without leaking ids',
    cross.status === 403 &&
      cross.body?.message === ACTIVITY_ENTITY_FORBIDDEN &&
      cross.body?.message === 'You cannot access another company workspace.' &&
      !String(cross.body?.message ?? '').includes('contact-other') &&
      !String(cross.body?.message ?? '').includes(otherCompany) &&
      !String(JSON.stringify(cross.body ?? {})).includes(otherCompany),
  )
  resetActivityRepository()
  resetActivityEntityStore()
}

console.log('')
console.log('— J. Timeline HTTP remains GET-only —')

{
  const timeline = integrationsActivitiesPlugin()
  const skipped = await invoke(timeline, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput(),
  })
  assert(
    '44. timeline HTTP plugin remains GET-only',
    timelinePluginSource.includes("req.method !== 'GET'") &&
      !/['"]POST['"]|['"]PATCH['"]|['"]PUT['"]|['"]DELETE['"]/.test(timelinePluginSource) &&
      skipped.nextCalled === true,
  )
  assert(
    '45. authoring mutations live on the sibling authoring plugin, not the timeline plugin',
    authoringPluginSource.includes("matchRoute(url, '/api/activities')") &&
      authoringPluginSource.includes("matchRoute(url, '/api/activities/:id')") &&
      authoringPluginSource.includes("matchRoute(url, '/api/activities/:id/archive')") &&
      !timelinePluginSource.includes('createStudioActivity'),
  )
}

console.log('')
console.log('— K. Source count —')

{
  const historical = readFileSync(
    join(root, 'scripts', 'verify-integrations-activities.mjs'),
    'utf8',
  )
  assert(
    '46. historical H16.7 fixture still expects 8 projection sources',
    historical.includes('historical fixture registers 8') &&
      historical.includes('registered.length === 8'),
  )
  assert(
    '47. final H16.9 runtime/allowlist expectation is 9',
    TIMELINE_SOURCE_IDS.length === 9 &&
      Object.keys(TIMELINE_SOURCE_PRIORITY).length === 9,
  )
}

console.log('')
console.log('— L. Persistence / file safety —')

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
    '48. H16.9 does not introduce activities.json or another JSON persistence store',
    ownStore.length === 0 &&
      !existsSync(join(dataDir, 'activities.json')) &&
      !(proposalsDiff.stdout || '').trim(),
  )
}

assert(
  '49. no repository factories live under src/integrations/activities/',
  !/class\s+\w*ActivityRepository|function\s+create\w*ActivityRepository/.test(
    activitiesModuleSource,
  ) && !readdirSync(join(root, 'src', 'integrations', 'activities')).includes('persistence'),
)

assert(
  '50. persistence factories remain under src/persistence/activities/',
  existsSync(join(persistenceDir, 'memory.js')) &&
    existsSync(join(persistenceDir, 'postgres.js')) &&
    existsSync(join(persistenceDir, 'null.js')) &&
    existsSync(join(persistenceDir, 'port.js')) &&
    /export function createMemoryActivityRepository/.test(
      readFileSync(join(persistenceDir, 'memory.js'), 'utf8'),
    ) &&
    /export function createPostgresActivityRepository/.test(
      readFileSync(join(persistenceDir, 'postgres.js'), 'utf8'),
    ) &&
    /export function registerActivityRepository/.test(
      readFileSync(join(persistenceDir, 'port.js'), 'utf8'),
    ) &&
    !/export function create(Memory|Postgres|Null)ActivityRepository/.test(
      activitiesModuleSource,
    ),
)

console.log('')
console.log('— M. Native activity kinds —')

{
  const taskSchema = await caught(() =>
    Promise.resolve(
      makeNativeActivity({
        companyId: DEFAULT_COMPANY_ID,
        origin: ACTIVITY_ORIGIN.USER,
        kind: 'task',
        type: 'task.created',
        subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' },
        occurredAt,
        actor: { id: 'user-1', kind: 'user' },
        subjectLine: 'Task',
        body: 'Unsupported.',
      }),
    ),
  )
  const systemKind = await caught(() =>
    Promise.resolve(
      makeNativeActivity({
        companyId: DEFAULT_COMPANY_ID,
        origin: ACTIVITY_ORIGIN.USER,
        kind: ACTIVITY_KIND.SYSTEM_EVENT,
        type: 'living.viewed',
        subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h169-a' },
        occurredAt,
        actor: { id: 'user-1', kind: 'user' },
        subjectLine: 'Projected',
        body: '',
      }),
    ),
  )
  const systemOrigin = await caught(() =>
    Promise.resolve(
      makeNativeActivity({
        companyId: DEFAULT_COMPANY_ID,
        origin: ACTIVITY_ORIGIN.SYSTEM,
        kind: ACTIVITY_NATIVE_KIND.NOTE,
        type: ACTIVITY_NATIVE_TYPE.NOTE_CREATED,
        subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' },
        occurredAt,
        actor: { id: 'user-1', kind: 'user' },
        subjectLine: 'Projected origin',
        body: '',
      }),
    ),
  )
  resetActivityRepository()
  seedAuthoringEntities()
  registerActivityRepository(wrapDurable(createMemoryActivityRepository()).adapter)
  await refreshActivityRepositoryHealth()
  const plugin = integrationsActivityAuthoringPlugin()
  const taskHttp = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput({ kind: 'task', type: 'task.created' }),
  })
  assert(
    '51. TASK is not a supported native Activity kind',
    !Object.prototype.hasOwnProperty.call(ACTIVITY_KIND, 'TASK') &&
      !ACTIVITY_KINDS.includes('task') &&
      !ACTIVITY_KINDS.includes('TASK'),
  )
  assert(
    '52. native schema rejects TASK and projected system_event / system-origin',
    taskSchema instanceof ValidationError &&
      systemKind instanceof ValidationError &&
      systemOrigin instanceof ValidationError &&
      taskHttp.status === 400,
  )
  resetActivityRepository()
}

console.log('')
console.log('— N. Live Postgres —')

{
  const dsn = resolveActivityDatabaseUrl()
  if (!dsn.ok) {
    assert(
      '53. live Postgres write checks skipped without Activity DSN',
      true,
      'No Activity Postgres DSN is available.',
    )
  } else {
    resetActivityRepository()
    registerActivityRepository(createPostgresActivityRepository())
    await refreshActivityRepositoryHealth()
    const health = getActivityRepositoryHealth()
    if (health.ok !== true) {
      assert(
        '53. live Postgres write checks skipped because cached health.ok is false',
        true,
        'DSN resolved but the adapter is not healthy; H16.9 does not auto-migrate.',
      )
    } else {
      const created = await createStudioActivity(noteInput({ subjectLine: 'Live durable note' }))
      const fetched = await getActivityRepository().get(created.id, DEFAULT_COMPANY_ID)
      assert(
        '53. live durable path creates without request-time migrate',
        String(created.id).startsWith('act-') && fetched?.id === created.id,
      )
    }
    resetActivityRepository()
  }
}

console.log('')
console.log('— O. H16.2 / later roadmap boundaries —')

assert(
  '54. H16.9 does not emit H16.2 intake events for the activity domain',
  !AUTOMATION_INTAKE_SOURCE_DOMAINS.includes(AUTOMATION_SOURCE_DOMAIN.ACTIVITY) &&
    !/emitAutomation|ingestAutomation|recordAutomationEvent/.test(
      facadeSource + authoringPluginSource,
    ),
)
assert(
  '55. email mailbox, calendar, OAuth, workers, vendor SDKs, and real auth are not introduced',
  !TIMELINE_SOURCE_IDS.includes('email_mailbox') &&
    !TIMELINE_SOURCE_IDS.includes('calendar') &&
    INTEGRATION_CAPABILITIES.calendar === false &&
    INTEGRATION_CAPABILITIES.oauth === false &&
    INTEGRATION_CAPABILITIES.backgroundWorkers === false &&
    INTEGRATION_CAPABILITIES.vendorSdks === false &&
    INTEGRATION_CAPABILITIES.emailDelivery === false &&
    STUDIO_ACTIVITY_AUTHORING_ACTOR.id === 'user-studio' &&
    !/oauth|approvalGate|vendorSdk|mailbox|calendarSource|worker/.test(
      facadeSource + authoringPluginSource,
    ),
)
assert(
  '56. this suite is independent and does not spawn the H16.7/H16.8 verifiers',
  !/spawnSync\([^)]*verify-integrations-(persistence|activities)\.mjs/.test(
    readFileSync(join(__dirname, 'verify-integrations-activity-authoring.mjs'), 'utf8'),
  ),
)

clearActivityAuthoringCapabilityOverrideForTests()
resetActivityRepository()
resetTimelineSources()
resetTimelineProposalLookup()
resetActivityEntityStore()

console.log('')
console.log(`H16.9 activity authoring checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
