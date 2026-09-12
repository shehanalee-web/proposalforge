/**
 * H16.14 Slice 14.3 — Authoring actor stamping.
 *
 * createStudioActivity stamps a supplied Studio Principal. Payload actor /
 * actorId cannot replace it. Origin stays USER. Direct callers without a
 * principal keep the authoring fixture. HTTP POST binds via bindStudioRequest
 * and passes the principal in. PATCH cannot change actor or origin.
 * Does not nest other verifiers. Never writes data/proposals.json.
 * No login, JWT, cookies, sessions, OAuth, mailbox, or calendar change.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID, getWorkflowActor } from '../src/workflow/actors.js'
import { integrationsActivityAuthoringPlugin } from '../server/integrationsActivityAuthoringPlugin.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_NATIVE_KIND,
  ACTIVITY_ORIGIN,
  ACTIVITY_REPOSITORY_ID,
  ACTIVITY_REPOSITORY_MODE,
  ACTIVITY_SUBJECT_TYPE,
  AUTOMATION_INTAKE_STATUS,
  INTEGRATION_CAPABILITIES,
  STUDIO_ACTIVITY_AUTHORING_ACTOR,
  STUDIO_PRINCIPAL_KIND,
  TIMELINE_SOURCE_IDS,
  configureTimelineProposalLookup,
  createMemoryActivityRepository,
  createStudioActivity,
  getStudioActivity,
  listAcceptedAutomationEventsForCompany,
  makeStudioPrincipal,
  refreshActivityRepositoryHealth,
  registerActivityRepository,
  resetActivityRepository,
  resetAutomationIntakeStore,
  resetTimelineProposalLookup,
  setActivityAuthoringCapabilityOverrideForTests,
  clearActivityAuthoringCapabilityOverrideForTests,
  setRequestStudioPrincipal,
  updateStudioActivity,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const identityDir = join(root, 'src', 'integrations', 'identity')
const studio = DEFAULT_COMPANY_ID
const harborline = WORKFLOW_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor(DEFAULT_ACTOR_ID)

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

async function threwAsync(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
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

function gitDiff(paths) {
  return spawnSync('git', ['diff', '--', ...paths], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function sourceOf(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

function noteInput(overrides = {}) {
  return {
    companyId: studio,
    kind: ACTIVITY_NATIVE_KIND.NOTE,
    subject: { type: ACTIVITY_SUBJECT_TYPE.PROPOSAL, id: 'prop-h16143-a' },
    subjectLine: 'Authoring actor note',
    body: 'Stamped from a Studio Principal.',
    occurredAt: '2026-09-12T12:00:00.000Z',
    ...overrides,
  }
}

function invoke(plugin, { method, url, body, principal }) {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    const req = {
      method,
      url,
      headers: {},
      on(event, cb) {
        if (event === 'data' && payload) queueMicrotask(() => cb(payload))
        if (event === 'end') queueMicrotask(cb)
        return req
      },
      destroy() {},
    }
    if (principal) setRequestStudioPrincipal(req, principal)
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
        resolve({ status: this.statusCode, body: parsed })
      },
    }
    Promise.resolve(plugin.handle(req, res, () => resolve({ status: 0, body: null }))).catch(reject)
  })
}

async function enableAuthoring() {
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
    create: (...args) => memory.create(...args),
    get: (...args) => memory.get(...args),
    list: (...args) => memory.list(...args),
    update: (...args) => memory.update(...args),
    archive: (...args) => memory.archive(...args),
  })
  await refreshActivityRepositoryHealth()
  setActivityAuthoringCapabilityOverrideForTests(true)
}

const authoringSource = sourceOf('src/integrations/activities/authoring.js')
const pluginSource = sourceOf('server/integrationsActivityAuthoringPlugin.js')
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

console.log('— H16.14.3 authoring actor —')

{
  resetActivityRepository()
  resetAutomationIntakeStore()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(noteInput({ principal }))
  assert(
    '1. createStudioActivity stamps the supplied Studio Principal actor',
    created.actor.id === 'user-studio-sarah' &&
      created.actor.kind === STUDIO_PRINCIPAL_KIND &&
      created.actor.kind === ACTIVITY_ACTOR_KIND.USER &&
      created.actor.displayName === 'Sarah' &&
      !Object.prototype.hasOwnProperty.call(created.actor, 'companyId') &&
      created.companyId === studio,
  )
}

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(
    noteInput({
      principal,
      actor: { id: 'intruder', kind: 'agent', displayName: 'Intruder' },
      actorId: 'user-studio-david',
    }),
  )
  assert(
    '2. actor id comes from the principal, not an arbitrary actorId payload',
    created.actor.id === sarah.id &&
      created.actor.id !== 'intruder' &&
      created.actor.id !== 'user-studio-david' &&
      created.actor.displayName === 'Sarah',
  )
}

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(noteInput({ principal, companyId: studio }))
  const cross = await threwAsync(() =>
    createStudioActivity(
      noteInput({
        principal,
        companyId: harborline,
      }),
    ),
  )
  assert(
    '3. principal companyId remains the tenant/company identity',
    created.companyId === studio &&
      created.companyId === principal.companyId &&
      created.companyId === 'company-studio' &&
      harborline === 'company-harborline' &&
      cross instanceof ForbiddenError &&
      cross.message === 'You cannot access another company workspace.',
  )
}

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(
    noteInput({ principal, origin: ACTIVITY_ORIGIN.AGENT }),
  )
  assert(
    '4. origin remains USER',
    created.origin === ACTIVITY_ORIGIN.USER &&
      created.origin !== ACTIVITY_ORIGIN.AGENT &&
      authoringSource.includes('origin: ACTIVITY_ORIGIN.USER'),
  )
}

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(noteInput({ principal }))
  const actorPatch = await threwAsync(() =>
    updateStudioActivity(
      created.id,
      { actor: { id: 'intruder', kind: ACTIVITY_ACTOR_KIND.USER, displayName: 'No' } },
      studio,
    ),
  )
  const reloaded = await getStudioActivity(created.id, studio)
  assert(
    '5. PATCH cannot change actor',
    actorPatch instanceof ValidationError &&
      actorPatch.errors?.[0]?.field === 'actor' &&
      reloaded.actor.id === sarah.id,
  )
}

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(noteInput({ principal }))
  const originPatch = await threwAsync(() =>
    updateStudioActivity(created.id, { origin: ACTIVITY_ORIGIN.AGENT }, studio),
  )
  assert(
    '6. PATCH cannot change origin',
    originPatch instanceof ValidationError &&
      originPatch.errors?.[0]?.field === 'origin' &&
      created.origin === ACTIVITY_ORIGIN.USER,
  )
}

{
  resetActivityRepository()
  resetAutomationIntakeStore()
  registerActivityRepository(createMemoryActivityRepository())
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const created = await createStudioActivity(noteInput({ principal, subjectLine: 'Emit me' }))
  const accepted = listAcceptedAutomationEventsForCompany(studio)
  const emitted = accepted.find((event) => event.sourceEventIdentity === created.id)
  assert(
    '7. H16.11 native activity emission still occurs',
    authoringSource.includes('emitNativeActivityCreated(activity)') &&
      emitted?.intake?.status === AUTOMATION_INTAKE_STATUS.ACCEPTED &&
      emitted.type === 'activity.note.created',
  )
}

{
  resetActivityRepository()
  registerActivityRepository(createMemoryActivityRepository())
  const fallback = await createStudioActivity(noteInput())
  assert(
    '8. direct callers without a principal keep the authoring fixture fallback',
    fallback.actor.id === STUDIO_ACTIVITY_AUTHORING_ACTOR.id &&
      fallback.actor.id === 'user-studio' &&
      fallback.actor.displayName === 'Studio' &&
      fallback.origin === ACTIVITY_ORIGIN.USER &&
      !Object.prototype.hasOwnProperty.call(STUDIO_ACTIVITY_AUTHORING_ACTOR, 'companyId'),
  )
}

{
  resetActivityRepository()
  resetTimelineProposalLookup()
  configureTimelineProposalLookup((proposalId) => {
    if (String(proposalId ?? '').trim() === 'prop-h16143-a') {
      return { id: 'prop-h16143-a', companyId: studio }
    }
    return null
  })
  await enableAuthoring()
  const plugin = integrationsActivityAuthoringPlugin()
  const catalog = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    body: noteInput(),
  })
  const bound = await invoke(plugin, {
    method: 'POST',
    url: '/api/activities',
    principal: {
      id: sarah.id,
      name: sarah.name,
      companyId: sarah.companyId,
    },
    body: noteInput({
      actor: { id: 'intruder', kind: 'agent', displayName: 'Intruder' },
      subjectLine: 'Bound principal note',
    }),
  })
  assert(
    '9. existing authoring HTTP stamps the resolved principal, not the fixture or payload actor',
    catalog.status === 201 &&
      catalog.body?.activity?.actor?.id === sarah.id &&
      catalog.body.activity.actor.id !== STUDIO_ACTIVITY_AUTHORING_ACTOR.id &&
      catalog.body.activity.origin === ACTIVITY_ORIGIN.USER &&
      bound.status === 201 &&
      bound.body?.activity?.actor?.id === sarah.id &&
      bound.body.activity.actor.id !== 'intruder' &&
      pluginSource.includes('bindStudioRequest') &&
      pluginSource.includes('principal') &&
      !pluginSource.includes('getActivityRepository') &&
      !authoringSource.includes('bindStudioRequest') &&
      !authoringSource.includes('getRequestStudioPrincipal'),
  )
  resetTimelineProposalLookup()
  resetActivityRepository()
}

{
  assert(
    '10. STUDIO_ACTIVITY_AUTHORING_ACTOR is not the production stamp when a principal is supplied',
    authoringSource.includes('makeStudioPrincipal') &&
      authoringSource.includes('fallbackAuthoringPrincipal') &&
      authoringSource.includes('STUDIO_ACTIVITY_AUTHORING_ACTOR') &&
      !authoringSource.includes('actor: STUDIO_ACTIVITY_AUTHORING_ACTOR') &&
      pluginSource.includes('bindStudioRequest({ req, body, query: queryOf(url) })'),
  )
}

console.log('')
console.log('— boundaries remain unchanged —')

{
  assert(
    '11. no login, JWT, cookie, session, or OAuth runtime is introduced',
    INTEGRATION_CAPABILITIES.oauth === false &&
      !existsSync(join(identityDir, 'oauth.js')) &&
      !existsSync(join(identityDir, 'session.js')) &&
      !existsSync(join(identityDir, 'jwt.js')) &&
      !existsSync(join(identityDir, 'login.js')) &&
      !existsSync(join(root, 'server', 'authPlugin.js')) &&
      !/from\s+['"][^'"]*(?:jsonwebtoken|jose|passport|cookie-parser)['"]/.test(
        authoringSource + pluginSource,
      ) &&
      !pluginSource.includes('Authorization') &&
      !authoringSource.includes('req.session'),
  )
}

{
  const mailboxDiff = gitDiff([
    'src/integrations/mailbox',
    'src/integrations/calendar',
    'src/integrations/activities/events.js',
  ])
  assert(
    '12. mailbox, calendar, and H16.11 emission module are untouched',
    mailboxDiff.status === 0 &&
      !(mailboxDiff.stdout || '').trim() &&
      TIMELINE_SOURCE_IDS.length === 9 &&
      !TIMELINE_SOURCE_IDS.includes('mailbox') &&
      !TIMELINE_SOURCE_IDS.includes('calendar'),
  )
}

{
  const ownSource = readFileSync(
    join(__dirname, 'verify-integrations-principal-authoring-actor.mjs'),
    'utf8',
  )
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '13. this suite is independent and does not write data files',
    !/spawnSync\(\s*process\.execPath/.test(ownSource) &&
      !/node\s+scripts\/verify-integrations-/.test(ownSource) &&
      dataBefore === dataAfter &&
      activitiesBefore === hashFile(join(root, 'data', 'activities.json')) &&
      proposalsBefore === hashFile(join(root, 'data', 'proposals.json')) &&
      dataStatus.status === 0 &&
      !(dataStatus.stdout || '').trim(),
  )
}

resetActivityRepository()
resetAutomationIntakeStore()
resetTimelineProposalLookup()
clearActivityAuthoringCapabilityOverrideForTests()

console.log('')
console.log(`H16.14 authoring actor checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
