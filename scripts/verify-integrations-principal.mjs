/**
 * H16.14 Slice 14.1 — Studio Principal contract verification.
 *
 * Contract only. Does not nest H16.7–H16.13. Never writes data/proposals.json
 * or activities.json. No HTTP, login, JWT, cookies, sessions, OAuth, ingest,
 * or authoring write-path change.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID, getWorkflowActor } from '../src/workflow/actors.js'
import * as identityApi from '../src/integrations/identity/index.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ORIGIN,
  INTEGRATION_CAPABILITIES,
  STUDIO_ACTIVITY_AUTHORING_ACTOR,
  STUDIO_PRINCIPAL_FORBIDDEN_FIELDS,
  STUDIO_PRINCIPAL_KIND,
  STUDIO_PRINCIPAL_KINDS,
  STUDIO_PRINCIPAL_LIMITS,
  STUDIO_PRINCIPAL_SCHEMA_VERSION,
  TIMELINE_SOURCE_IDS,
  cloneStudioPrincipal,
  makeStudioPrincipal,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const allowedIdentityExports = Object.freeze([
  'STUDIO_PRINCIPAL_SCHEMA_VERSION',
  'STUDIO_PRINCIPAL_KIND',
  'STUDIO_PRINCIPAL_KINDS',
  'STUDIO_PRINCIPAL_LIMITS',
  'STUDIO_PRINCIPAL_FORBIDDEN_FIELDS',
  'makeStudioPrincipal',
  'cloneStudioPrincipal',
  'readClaimedStudioIdentity',
  'getRequestStudioPrincipal',
  'setRequestStudioPrincipal',
  'bindStudioPrincipal',
  'resolveStudioCatalogPrincipal',
  'bindStudioRequest',
  'studioRequestIdentity',
])

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

function gitDiff(paths) {
  return spawnSync('git', ['diff', '--', ...paths], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const identityDir = join(root, 'src', 'integrations', 'identity')
const identitySource = collectJs(identityDir)
const authoringSource = readFileSync(
  join(root, 'src', 'integrations', 'activities', 'authoring.js'),
  'utf8',
)
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

console.log('— H16.14.1 studio principal contract —')

{
  const principal = makeStudioPrincipal({
    id: 'user-studio-sarah',
    kind: ACTIVITY_ACTOR_KIND.USER,
    displayName: 'Sarah',
    companyId: DEFAULT_COMPANY_ID,
  })
  const cloned = cloneStudioPrincipal(principal)
  assert(
    '1. valid studio principal is accepted',
    principal.id === 'user-studio-sarah' &&
      principal.kind === STUDIO_PRINCIPAL_KIND &&
      principal.kind === ACTIVITY_ACTOR_KIND.USER &&
      principal.displayName === 'Sarah' &&
      principal.companyId === DEFAULT_COMPANY_ID &&
      principal.companyId === 'company-studio' &&
      JSON.stringify(cloned) === JSON.stringify(principal) &&
      Object.isFrozen(principal),
  )
}

{
  const sarah = getWorkflowActor(DEFAULT_ACTOR_ID)
  const principal = makeStudioPrincipal({
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  assert(
    '2. workflow actor name maps onto displayName; extra catalog fields are not copied',
    principal.id === 'user-studio-sarah' &&
      principal.kind === ACTIVITY_ACTOR_KIND.USER &&
      principal.displayName === 'Sarah' &&
      principal.companyId === DEFAULT_COMPANY_ID &&
      !Object.prototype.hasOwnProperty.call(principal, 'email') &&
      !Object.prototype.hasOwnProperty.call(principal, 'role') &&
      !Object.prototype.hasOwnProperty.call(principal, 'name'),
  )
}

{
  const missingId = threw(() =>
    makeStudioPrincipal({
      kind: ACTIVITY_ACTOR_KIND.USER,
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
    }),
  )
  const missingCompany = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
    }),
  )
  const emptyCompany = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: '  ',
    }),
  )
  assert(
    '3. id and companyId are required',
    missingId instanceof ValidationError &&
      missingId.errors?.[0]?.field === 'id' &&
      missingCompany instanceof ValidationError &&
      missingCompany.errors?.[0]?.field === 'companyId' &&
      emptyCompany instanceof ValidationError &&
      emptyCompany.errors?.[0]?.field === 'companyId',
  )
}

{
  const agent = threw(() =>
    makeStudioPrincipal({
      id: 'agent-1',
      kind: ACTIVITY_ACTOR_KIND.AGENT,
      displayName: 'Agent',
      companyId: DEFAULT_COMPANY_ID,
    }),
  )
  const system = threw(() =>
    makeStudioPrincipal({
      id: 'system-1',
      kind: ACTIVITY_ACTOR_KIND.SYSTEM,
      displayName: 'System',
      companyId: DEFAULT_COMPANY_ID,
    }),
  )
  const client = threw(() =>
    makeStudioPrincipal({
      id: 'client-1',
      kind: ACTIVITY_ACTOR_KIND.CLIENT,
      displayName: 'Client',
      companyId: DEFAULT_COMPANY_ID,
    }),
  )
  assert(
    '4. agent, system, and client kinds are rejected',
    agent instanceof ValidationError &&
      agent.errors?.[0]?.field === 'kind' &&
      system instanceof ValidationError &&
      system.errors?.[0]?.field === 'kind' &&
      client instanceof ValidationError &&
      client.errors?.[0]?.field === 'kind' &&
      STUDIO_PRINCIPAL_KINDS.join(',') === ACTIVITY_ACTOR_KIND.USER,
  )
}

{
  const principal = makeStudioPrincipal({
    id: 'user-harborline-lee',
    displayName: 'Lee',
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  })
  const asCrmSubject = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
      subjectType: 'company',
    }),
  )
  const asCompanyRef = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
      companyRefId: 'company-1',
    }),
  )
  assert(
    '5. companyId is tenant identity, not a CRM Company subject',
    principal.companyId === WORKFLOW_ISOLATION_COMPANY_ID &&
      principal.companyId !== principal.id &&
      principal.id !== DEFAULT_COMPANY_ID &&
      asCrmSubject instanceof ValidationError &&
      asCrmSubject.errors?.[0]?.field === 'subjectType' &&
      asCompanyRef instanceof ValidationError &&
      asCompanyRef.errors?.[0]?.field === 'companyRefId',
  )
}

{
  const access = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
      accessToken: 'ya29.tok',
    }),
  )
  const jwt = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
      jwt: 'eyJhbGciOiJIUzI1NiJ9.e30.x',
    }),
  )
  const cookie = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
      cookie: 'sid=abc',
    }),
  )
  const session = threw(() =>
    makeStudioPrincipal({
      id: 'user-studio-sarah',
      displayName: 'Sarah',
      companyId: DEFAULT_COMPANY_ID,
      sessionId: 'sess-1',
    }),
  )
  assert(
    '6. OAuth, JWT, cookies, and sessions are rejected',
    access instanceof ValidationError &&
      jwt instanceof ValidationError &&
      cookie instanceof ValidationError &&
      session instanceof ValidationError &&
      STUDIO_PRINCIPAL_FORBIDDEN_FIELDS.includes('oauth') &&
      STUDIO_PRINCIPAL_FORBIDDEN_FIELDS.includes('jwt') &&
      STUDIO_PRINCIPAL_FORBIDDEN_FIELDS.includes('cookie') &&
      STUDIO_PRINCIPAL_FORBIDDEN_FIELDS.includes('sessionId'),
  )
}

{
  const long = 'p'.repeat(STUDIO_PRINCIPAL_LIMITS.MAX_ID + 8)
  const principal = makeStudioPrincipal({
    id: long,
    displayName: long,
    companyId: long,
  })
  assert(
    '7. ids are bounded to the existing Native Activity id limit',
    principal.id.length === STUDIO_PRINCIPAL_LIMITS.MAX_ID &&
      principal.displayName.length === STUDIO_PRINCIPAL_LIMITS.MAX_DISPLAY_NAME &&
      principal.companyId.length === STUDIO_PRINCIPAL_LIMITS.MAX_ID &&
      STUDIO_PRINCIPAL_LIMITS.MAX_ID === 128,
  )
}

{
  const exported = Object.keys(identityApi).sort()
  const identityFiles = readdirSync(identityDir)
    .filter((name) => name.endsWith('.js'))
    .sort()
  assert(
    '8. identity barrel is contract plus request binding',
    exported.join(',') === [...allowedIdentityExports].sort().join(',') &&
      identityFiles.join(',') === 'bind.js,index.js,schema.js,types.js' &&
      STUDIO_PRINCIPAL_SCHEMA_VERSION === 1 &&
      typeof identityApi.makeStudioPrincipal === 'function' &&
      !exported.includes('createStudioActivity') &&
      !exported.includes('login') &&
      !exported.includes('verifyJwt'),
  )
}

console.log('')
console.log('— existing behavior remains unchanged —')

{
  assert(
    '9. authoring fixture actor is unchanged',
    STUDIO_ACTIVITY_AUTHORING_ACTOR.id === 'user-studio' &&
      STUDIO_ACTIVITY_AUTHORING_ACTOR.kind === ACTIVITY_ACTOR_KIND.USER &&
      STUDIO_ACTIVITY_AUTHORING_ACTOR.displayName === 'Studio' &&
      !Object.prototype.hasOwnProperty.call(STUDIO_ACTIVITY_AUTHORING_ACTOR, 'companyId') &&
      authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
      authoringSource.includes('STUDIO_ACTIVITY_AUTHORING_ACTOR') &&
      ACTIVITY_ORIGIN.AGENT === 'agent',
  )
}

{
  const mailboxDiff = gitDiff([
    'src/integrations/mailbox',
    'src/integrations/calendar',
    'src/integrations/activities/events.js',
  ])
  assert(
    '10. mailbox, calendar, and H16.11 emission are untouched',
    mailboxDiff.status === 0 && !(mailboxDiff.stdout || '').trim(),
  )
}

{
  assert(
    '11. no login, JWT, cookie, session, or OAuth runtime is introduced',
    INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.calendar === false &&
      !existsSync(join(identityDir, 'oauth.js')) &&
      !existsSync(join(identityDir, 'session.js')) &&
      !existsSync(join(identityDir, 'jwt.js')) &&
      !existsSync(join(identityDir, 'login.js')) &&
      !existsSync(join(root, 'server', 'authPlugin.js')) &&
      !/from\s+['"][^'"]*(?:jsonwebtoken|jose|passport|cookie-parser)['"]/.test(
        identitySource,
      ),
  )
}

{
  assert(
    '12. TIMELINE_SOURCE_IDS remains unchanged',
    TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes('native_activity') &&
      !TIMELINE_SOURCE_IDS.includes('principal') &&
      !TIMELINE_SOURCE_IDS.includes('studio_principal') &&
      !identitySource.includes('registerTimelineSource'),
  )
}

{
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-principal.mjs'), 'utf8')
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

console.log('')
console.log(`H16.14 principal contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
