/**
 * H16.9 Slice 9.4–9.5 — Activity authoring HTTP + capability gate.
 *
 * Focused coverage. Does not nest H16.7. Never writes data/proposals.json.
 * Slice 9.5 enables the activityAuthoring flag; runtime still requires a
 * healthy durable adapter.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { ACTIVITY_KIND, ACTIVITY_ORIGIN, ACTIVITY_SUBJECT_TYPE } from '../src/integrations/activities/types.js'
import {
  INTEGRATION_CAPABILITIES,
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_NATIVE_KIND,
  configureTimelineProposalLookup,
  resetTimelineProposalLookup,
  setActivityAuthoringCapabilityOverrideForTests,
  clearActivityAuthoringCapabilityOverrideForTests,
  isActivityAuthoringEnabled,
  isDurableActivityRepositoryHealthy,
  getActivityRepositoryHealth,
  describeActivityRepository,
  registerActivityRepository,
  resetActivityRepository,
  createMemoryActivityRepository,
  createPostgresActivityRepository,
  refreshActivityRepositoryHealth,
} from '../src/integrations/index.js'
import { integrationsActivitiesPlugin } from '../server/integrationsActivitiesPlugin.js'
import { integrationsActivityAuthoringPlugin } from '../server/integrationsActivityAuthoringPlugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const otherCompany = 'co-h169-other'

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

function noteBody(overrides = {}) {
  return {
    companyId: DEFAULT_COMPANY_ID,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h169-a' },
    subjectLine: 'Authoring note',
    body: 'Logged from HTTP.',
    occurredAt: '2026-09-11T12:00:00.000Z',
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

function wrapDurable(memory) {
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
        return { ok: true, durable: true, migrated: true, message: 'Test durable adapter.' }
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

async function enableAuthoring() {
  const memory = createMemoryActivityRepository()
  const wrapped = wrapDurable(memory)
  registerActivityRepository(wrapped.adapter)
  await refreshActivityRepositoryHealth()
  setActivityAuthoringCapabilityOverrideForTests(true)
  return wrapped
}

function seedProposalLookup() {
  configureTimelineProposalLookup((proposalId) => {
    const id = String(proposalId ?? '').trim()
    if (id === 'prop-h169-a') return { id, companyId: DEFAULT_COMPANY_ID }
    if (id === 'prop-h169-other') return { id, companyId: otherCompany }
    return null
  })
}

console.log('— H16.9.4 authoring HTTP —')

{
  const pluginSource = stripComments(
    readFileSync(join(root, 'server', 'integrationsActivitiesPlugin.js'), 'utf8'),
  )
  const authoringSource = stripComments(
    readFileSync(join(root, 'server', 'integrationsActivityAuthoringPlugin.js'), 'utf8'),
  )
  const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
  const productionSource = readFileSync(join(root, 'server', 'productionApi.js'), 'utf8')
  assert(
    '1. timeline plugin remains GET-only',
    pluginSource.includes("req.method !== 'GET'") &&
      !/['"]POST['"]|['"]PATCH['"]|['"]PUT['"]|['"]DELETE['"]/.test(pluginSource),
  )
  assert(
    '2. authoring plugin is registered beside the timeline plugin',
    viteSource.includes('integrationsActivityAuthoringPlugin()') &&
      productionSource.includes('integrationsActivityAuthoringPlugin()') &&
      viteSource.includes('integrationsActivitiesPlugin()') &&
      productionSource.includes('integrationsActivitiesPlugin()'),
  )
  assert(
    '3. authoring plugin has no PUT or DELETE and does not import postgres factories',
    /method === 'POST'|method !== 'POST'/.test(authoringSource) &&
      authoringSource.includes("method === 'PATCH'") &&
      !/['"]PUT['"]|['"]DELETE['"]/.test(authoringSource) &&
      !/createPostgresActivityRepository|createMemoryActivityRepository/.test(authoringSource),
  )
  assert(
    '4. activityAuthoring flag is on; derived authoring stays false without durable health',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      isActivityAuthoringEnabled() === false,
  )
}

{
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
  const plugin = integrationsActivityAuthoringPlugin()
  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody(),
  })
  assert(
    '5. POST authoring returns 403 while derived authoring is disabled',
    created.status === 403 && created.body?.message === 'Activity authoring is not enabled.',
  )
}

{
  const timeline = integrationsActivitiesPlugin()
  const skipped = await invoke(timeline, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody(),
  })
  assert(
    '6. timeline plugin does not claim authoring POST',
    skipped.nextCalled === true,
  )
}

{
  resetActivityRepository()
  seedProposalLookup()
  const wrapped = await enableAuthoring()
  const plugin = integrationsActivityAuthoringPlugin()
  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    headers: { 'Idempotency-Key': 'http-key-1' },
    body: noteBody({ origin: ACTIVITY_ORIGIN.AGENT, kind: ACTIVITY_NATIVE_KIND.NOTE }),
  })
  assert(
    '7. POST reaches the facade/repository when authoring is enabled in tests',
    created.status === 201 &&
      String(created.body?.activity?.id ?? '').startsWith('act-') &&
      created.body.activity.origin === ACTIVITY_ORIGIN.USER &&
      created.body.activity.kind === ACTIVITY_NATIVE_KIND.NOTE,
  )
  assert(
    '8. Idempotency-Key is mapped to idempotencyKey',
    wrapped.lastCreate()?.idempotencyKey === 'http-key-1',
  )

  const patched = await invoke(plugin, {
    method: 'PATCH',
    url: `/api/activities/${created.body.activity.id}?companyId=${DEFAULT_COMPANY_ID}`,
    body: { subjectLine: 'Updated subject' },
  })
  assert(
    '9. PATCH updates through the facade/repository',
    patched.status === 200 && patched.body?.activity?.subjectLine === 'Updated subject',
  )

  const archived = await invoke(plugin, {
    method: 'POST',
    url: `/api/activities/${created.body.activity.id}/archive?companyId=${DEFAULT_COMPANY_ID}`,
  })
  assert(
    '10. archive sets archivedAt through the facade/repository',
    archived.status === 200 && Boolean(archived.body?.activity?.archivedAt),
  )
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
}

{
  resetActivityRepository()
  seedProposalLookup()
  await enableAuthoring()
  const plugin = integrationsActivityAuthoringPlugin()
  const missing = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody({
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-does-not-exist' },
    }),
  })
  assert(
    '11. unknown proposal subjects return 404',
    missing.status === 404 && String(missing.body?.message ?? '').includes('not found'),
  )

  const cross = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody({
      subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h169-other' },
    }),
  })
  assert(
    '12. cross-company proposal subjects return 403 without leaking ids',
    cross.status === 403 &&
      !String(cross.body?.message ?? '').includes('prop-h169-other') &&
      !String(cross.body?.message ?? '').includes(otherCompany),
  )

  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody(),
  })
  const fetched = await invoke(plugin, {
    method: 'GET',
    url: `/api/activities/${created.body.activity.id}?companyId=${otherCompany}`,
  })
  assert(
    '13. native get enforces company scope',
    created.status === 201 &&
      fetched.status === 403 &&
      !String(fetched.body?.message ?? '').includes(created.body.activity.id),
  )
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
}

{
  resetActivityRepository()
  await enableAuthoring()
  const plugin = integrationsActivityAuthoringPlugin()
  const contact = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody({
      subject: { type: ACTIVITY_SUBJECT_TYPE.CONTACT, id: 'contact-1' },
    }),
  })
  const company = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody({
      subject: { type: ACTIVITY_SUBJECT_TYPE.COMPANY, id: 'company-1' },
    }),
  })
  const deal = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody({
      subject: { type: ACTIVITY_SUBJECT_TYPE.DEAL, id: 'deal-1' },
    }),
  })
  assert(
    '14. contact/company/deal subjects store without resolution',
    contact.status === 201 &&
      contact.body.activity.subject.type === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      contact.body.activity.subject.id === 'contact-1' &&
      company.status === 201 &&
      company.body.activity.subject.type === ACTIVITY_SUBJECT_TYPE.COMPANY &&
      deal.status === 201 &&
      deal.body.activity.subject.type === ACTIVITY_SUBJECT_TYPE.DEAL,
  )
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
}

{
  resetActivityRepository()
  seedProposalLookup()
  await enableAuthoring()
  const plugin = integrationsActivityAuthoringPlugin()
  const put = await invoke(plugin, {
    method: 'PUT',
    url: '/api/activities/act-x',
    body: noteBody(),
  })
  const deleted = await invoke(plugin, {
    method: 'DELETE',
    url: '/api/activities/act-x',
  })
  const task = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody({ kind: 'task', type: 'task.created' }),
  })
  assert('15. PUT is not implemented', put.nextCalled === true)
  assert('16. DELETE is not implemented', deleted.nextCalled === true)
  assert(
    '17. TASK is rejected',
    task.status === 400 && !ACTIVITY_KIND.TASK,
  )
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
}

{
  resetActivityRepository()
  seedProposalLookup()
  const memory = createMemoryActivityRepository()
  registerActivityRepository({
    id: ACTIVITY_REPOSITORY_ID.POSTGRES,
    describe() {
      return {
        id: ACTIVITY_REPOSITORY_ID.POSTGRES,
        durable: true,
        mode: ACTIVITY_REPOSITORY_MODE.POSTGRES,
      }
    },
    async health() {
      return { ok: true, durable: true, migrated: true, message: 'Test durable adapter.' }
    },
    async create() {
      throw new Error('repository create failed')
    },
    get: (...args) => memory.get(...args),
    list: (...args) => memory.list(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
  })
  await refreshActivityRepositoryHealth()
  setActivityAuthoringCapabilityOverrideForTests(true)
  const plugin = integrationsActivityAuthoringPlugin()
  const failedCreate = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody(),
  })
  assert(
    '18. repository errors propagate through HTTP without stack traces',
    failedCreate.status === 500 &&
      failedCreate.body?.message === 'repository create failed' &&
      !String(JSON.stringify(failedCreate.body)).includes('at '),
  )
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
}

resetTimelineProposalLookup()
resetActivityRepository()
clearActivityAuthoringCapabilityOverrideForTests()

console.log('')
console.log('— H16.9.5 capability AND durable health —')

{
  resetActivityRepository()
  const wrapped = await enableAuthoring()
  setActivityAuthoringCapabilityOverrideForTests(false)
  const plugin = integrationsActivityAuthoringPlugin()
  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody(),
  })
  assert(
    '21. capability override false disables authoring even with durable health',
    isDurableActivityRepositoryHealthy() === true &&
      isActivityAuthoringEnabled() === false &&
      created.status === 403 &&
      created.body?.message === 'Activity authoring is not enabled.',
  )
  void wrapped
  clearActivityAuthoringCapabilityOverrideForTests()
  resetActivityRepository()
}

{
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
  registerActivityRepository(createMemoryActivityRepository())
  await refreshActivityRepositoryHealth()
  assert(
    '22. flag on + memory repository does not enable authoring',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      describeActivityRepository().durable === false &&
      getActivityRepositoryHealth().ok === true &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
  assert(
    '23. flag on + null repository does not enable authoring',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      describeActivityRepository().mode === ACTIVITY_REPOSITORY_MODE.NULL &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
}

{
  resetActivityRepository()
  clearActivityAuthoringCapabilityOverrideForTests()
  registerActivityRepository(createPostgresActivityRepository())
  assert(
    '24. flag on + durable repository + unconfirmed health does not enable authoring',
    describeActivityRepository().durable === true &&
      getActivityRepositoryHealth().ok === false &&
      isDurableActivityRepositoryHealthy() === false &&
      isActivityAuthoringEnabled() === false,
  )
  resetActivityRepository()
}

{
  resetActivityRepository()
  seedProposalLookup()
  clearActivityAuthoringCapabilityOverrideForTests()
  const memory = createMemoryActivityRepository()
  registerActivityRepository(wrapDurable(memory).adapter)
  await refreshActivityRepositoryHealth()
  const plugin = integrationsActivityAuthoringPlugin()
  const created = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteBody(),
  })
  assert(
    '25. flag on + durable + cached health.ok enables authoring without a second mechanism',
    INTEGRATION_CAPABILITIES.activityAuthoring === true &&
      isDurableActivityRepositoryHealthy() === true &&
      isActivityAuthoringEnabled() === true &&
      created.status === 201 &&
      String(created.body?.activity?.id ?? '').startsWith('act-'),
  )
  resetActivityRepository()
  resetTimelineProposalLookup()
}

{
  const timeline = integrationsActivitiesPlugin()
  const caps = await invoke(timeline, {
    method: 'GET',
    url: `/api/activities/capabilities?companyId=${DEFAULT_COMPANY_ID}`,
  })
  const sources = await invoke(timeline, {
    method: 'GET',
    url: `/api/activities/sources?companyId=${DEFAULT_COMPANY_ID}`,
  })
  const pluginSource = stripComments(
    readFileSync(join(root, 'server', 'integrationsActivitiesPlugin.js'), 'utf8'),
  )
  assert(
    '26. timeline GET capabilities and sources remain intact',
    caps.status === 200 &&
      caps.body?.capabilities?.activityTimeline === true &&
      sources.status === 200 &&
      Array.isArray(sources.body?.sources),
  )
  assert(
    '27. timeline plugin remains GET-only after the authoring flag flip',
    pluginSource.includes("req.method !== 'GET'") &&
      !/['"]POST['"]|['"]PATCH['"]|['"]PUT['"]|['"]DELETE['"]/.test(pluginSource),
  )
}

const proposalsDiff = spawnSync('git', ['diff', '--', 'data/proposals.json'], {
  encoding: 'utf8',
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
})
assert(
  '28. data/proposals.json is unmodified',
  !(proposalsDiff.stdout || '').trim(),
)
assert(
  '29. TASK remains absent from the activity kind enum',
  !Object.prototype.hasOwnProperty.call(ACTIVITY_KIND, 'TASK') &&
    !['task', 'TASK'].some((value) => Object.values(ACTIVITY_KIND).includes(value)),
)

console.log('')
console.log(`H16.9 authoring HTTP checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
