/**
 * H16.14 Slice 14.2 — Studio request binding.
 *
 * Query/body actorId and companyId are claims. A bound Studio Principal wins.
 * Without an attached principal, the workflow actor catalog plus companyId
 * tenant selector is the explicit trusted source. Not a login, JWT, cookie,
 * session, or OAuth client. Does not nest other verifiers. Never writes
 * data/proposals.json or activities.json. Does not change authoring, mailbox,
 * calendar, or TimelineSource registration.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { DEFAULT_ACTOR_ID, getWorkflowActor } from '../src/workflow/actors.js'
import * as identityApi from '../src/integrations/identity/index.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_ORIGIN,
  INTEGRATION_CAPABILITIES,
  STUDIO_ACTIVITY_AUTHORING_ACTOR,
  STUDIO_PRINCIPAL_KIND,
  TIMELINE_SOURCE_IDS,
  bindStudioPrincipal,
  bindStudioRequest,
  getRequestStudioPrincipal,
  makeStudioPrincipal,
  readClaimedStudioIdentity,
  resolveStudioCatalogPrincipal,
  setRequestStudioPrincipal,
  studioRequestIdentity,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const identityDir = join(root, 'src', 'integrations', 'identity')
const studio = DEFAULT_COMPANY_ID
const harborline = WORKFLOW_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor(DEFAULT_ACTOR_ID)
const david = getWorkflowActor('user-studio-david')
const lee = getWorkflowActor('user-harborline-lee')

const actorPlugins = Object.freeze([
  'server/workflowPlugin.js',
  'server/followupPlugin.js',
  'server/interactionsPlugin.js',
  'server/forgePlugin.js',
  'server/commercialClosePlugin.js',
  'server/portalPlugin.js',
])
const unboundPlugins = Object.freeze([
  'server/livingPlugin.js',
  'server/integrationsActivityAuthoringPlugin.js',
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

function keysOf(value) {
  return Object.keys(value).sort().join(',')
}

const bindSource = sourceOf('src/integrations/identity/bind.js')
const authoringSource = sourceOf('src/integrations/activities/authoring.js')
const dataBefore = dataFingerprint()
const activitiesBefore = hashFile(join(root, 'data', 'activities.json'))
const proposalsBefore = hashFile(join(root, 'data', 'proposals.json'))

console.log('— H16.14.2 studio request binding —')

{
  const req = {}
  const bound = setRequestStudioPrincipal(req, {
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const principal = bindStudioRequest({ req })
  const identity = studioRequestIdentity(req, null, null)
  assert(
    '1. a valid bound actor is accepted',
    bound.id === 'user-studio-sarah' &&
      bound.kind === STUDIO_PRINCIPAL_KIND &&
      bound.kind === ACTIVITY_ACTOR_KIND.USER &&
      bound.displayName === 'Sarah' &&
      bound.companyId === studio &&
      principal.id === bound.id &&
      principal.companyId === studio &&
      identity.companyId === studio &&
      identity.actor.id === 'user-studio-sarah' &&
      keysOf(identity.actor) === 'id' &&
      getRequestStudioPrincipal(req) === bound,
  )
}

{
  const req = {}
  setRequestStudioPrincipal(req, {
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const querySpoof = threw(() =>
    bindStudioRequest({
      req,
      query: new URLSearchParams({ actorId: david.id, companyId: studio }),
    }),
  )
  const bodySpoof = threw(() =>
    studioRequestIdentity(req, { actorId: david.id, companyId: studio }, null),
  )
  const matching = bindStudioRequest({
    req,
    body: { actorId: sarah.id, companyId: studio },
  })
  assert(
    '2. spoofed query/body actorId cannot replace the bound actor',
    querySpoof instanceof ForbiddenError &&
      querySpoof.message === 'You cannot impersonate another actor.' &&
      bodySpoof instanceof ForbiddenError &&
      bodySpoof.message === 'You cannot impersonate another actor.' &&
      matching.id === sarah.id &&
      matching.companyId === studio,
  )
}

{
  const req = {}
  setRequestStudioPrincipal(req, {
    id: lee.id,
    name: lee.name,
    companyId: lee.companyId,
  })
  const omitted = bindStudioRequest({ req })
  const matchingTenant = bindStudioRequest({
    req,
    query: new URLSearchParams({ companyId: harborline }),
  })
  const identity = studioRequestIdentity(req, {}, new URLSearchParams())
  assert(
    '3. companyId remains the tenant selector on a bound principal',
    omitted.companyId === harborline &&
      omitted.id === lee.id &&
      matchingTenant.companyId === harborline &&
      matchingTenant.id === lee.id &&
      identity.companyId === harborline &&
      identity.actor.id === lee.id &&
      studio === 'company-studio' &&
      harborline === 'company-harborline',
  )
}

{
  const req = {}
  setRequestStudioPrincipal(req, {
    id: sarah.id,
    name: sarah.name,
    companyId: sarah.companyId,
  })
  const crossBound = threw(() =>
    bindStudioRequest({
      req,
      body: { companyId: harborline },
    }),
  )
  const crossCatalog = threw(() =>
    resolveStudioCatalogPrincipal({
      actorId: lee.id,
      companyId: studio,
    }),
  )
  const leeAtHarborline = resolveStudioCatalogPrincipal({
    actorId: lee.id,
    companyId: harborline,
  })
  const sarahAtStudio = resolveStudioCatalogPrincipal({
    actorId: sarah.id,
    companyId: studio,
  })
  assert(
    '4. cross-tenant requests cannot bind to another company',
    crossBound instanceof ForbiddenError &&
      crossBound.message === 'You cannot access another company workspace.' &&
      crossCatalog instanceof ForbiddenError &&
      crossCatalog.message === 'You cannot access another company workspace.' &&
      leeAtHarborline.id === lee.id &&
      leeAtHarborline.companyId === harborline &&
      sarahAtStudio.id === sarah.id &&
      sarahAtStudio.companyId === studio,
  )
}

{
  const catalogDefault = bindStudioRequest({})
  const davidStudio = resolveStudioCatalogPrincipal({
    actorId: david.id,
    companyId: studio,
  })
  const leeDefaultCompany = threw(() =>
    resolveStudioCatalogPrincipal({ actorId: lee.id }),
  )
  const harborlineDefaultActor = threw(() =>
    resolveStudioCatalogPrincipal({ companyId: harborline }),
  )
  const claimed = readClaimedStudioIdentity(
    { actorId: david.id },
    new URLSearchParams({ companyId: studio }),
  )
  assert(
    '5. catalog remains the explicit trusted source when no principal is attached',
    catalogDefault.id === DEFAULT_ACTOR_ID &&
      catalogDefault.displayName === 'Sarah' &&
      catalogDefault.companyId === studio &&
      davidStudio.id === david.id &&
      davidStudio.displayName === 'David' &&
      davidStudio.companyId === studio &&
      leeDefaultCompany instanceof ForbiddenError &&
      harborlineDefaultActor instanceof ForbiddenError &&
      claimed.actorId === david.id &&
      claimed.companyId === studio &&
      bindSource.includes('workflow actor catalog') &&
      bindSource.includes('DEFAULT_ACTOR_ID'),
  )
}

{
  const principal = bindStudioPrincipal({
    bound: makeStudioPrincipal({
      id: sarah.id,
      name: sarah.name,
      companyId: sarah.companyId,
    }),
    claimed: { actorId: sarah.id, companyId: studio },
  })
  assert(
    '6. binding uses the H16.14.1 Studio Principal contract',
    keysOf(principal) === 'companyId,displayName,id,kind' &&
      principal.kind === STUDIO_PRINCIPAL_KIND &&
      typeof identityApi.makeStudioPrincipal === 'function' &&
      typeof identityApi.bindStudioRequest === 'function' &&
      typeof identityApi.studioRequestIdentity === 'function' &&
      !Object.prototype.hasOwnProperty.call(principal, 'email') &&
      !Object.prototype.hasOwnProperty.call(principal, 'role') &&
      !Object.prototype.hasOwnProperty.call(principal, 'sessionId'),
  )
}

{
  const wired = actorPlugins.every((file) => {
    const source = sourceOf(file)
    return (
      source.includes('studioRequestIdentity') &&
      !source.includes("body?.actorId || query?.get?.('actorId') || DEFAULT_ACTOR_ID")
    )
  })
  const leftAlone = unboundPlugins.every(
    (file) => !sourceOf(file).includes('studioRequestIdentity'),
  )
  const workflowSource = sourceOf('server/workflowPlugin.js')
  const portalSource = sourceOf('server/portalPlugin.js')
  const livingSource = sourceOf('server/livingPlugin.js')
  const authoringPlugin = sourceOf('server/integrationsActivityAuthoringPlugin.js')
  assert(
    '7. actor-bearing studio plugins bind; company-only and authoring routes do not',
    wired &&
      leftAlone &&
      workflowSource.includes("matchRoute(url, '/api/workflow/overview')") &&
      workflowSource.includes('companyFrom(null, query)') &&
      portalSource.includes('listPortals') &&
      portalSource.includes('companyFrom(null, query)') &&
      livingSource.includes('companyFrom') &&
      !livingSource.includes('actorFrom') &&
      authoringPlugin.includes('companyFromQuery') &&
      !authoringPlugin.includes('actorId'),
  )
}

console.log('')
console.log('— existing behavior remains unchanged —')

{
  assert(
    '8. authoring fixture actor is unchanged',
    STUDIO_ACTIVITY_AUTHORING_ACTOR.id === 'user-studio' &&
      STUDIO_ACTIVITY_AUTHORING_ACTOR.kind === ACTIVITY_ACTOR_KIND.USER &&
      STUDIO_ACTIVITY_AUTHORING_ACTOR.displayName === 'Studio' &&
      !Object.prototype.hasOwnProperty.call(STUDIO_ACTIVITY_AUTHORING_ACTOR, 'companyId') &&
      authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
      authoringSource.includes('actor: STUDIO_ACTIVITY_AUTHORING_ACTOR') &&
      ACTIVITY_ORIGIN.AGENT === 'agent' &&
      !bindSource.includes('createStudioActivity') &&
      !bindSource.includes('STUDIO_ACTIVITY_AUTHORING_ACTOR'),
  )
}

{
  const mailboxDiff = gitDiff([
    'src/integrations/mailbox',
    'src/integrations/calendar',
    'src/integrations/activities/authoring.js',
    'src/integrations/activities/events.js',
    'server/integrationsActivityAuthoringPlugin.js',
  ])
  assert(
    '9. mailbox, calendar, authoring HTTP, and H16.11 emission are untouched',
    mailboxDiff.status === 0 && !(mailboxDiff.stdout || '').trim(),
  )
}

{
  assert(
    '10. no login, JWT, cookie, session, or OAuth runtime is introduced',
    INTEGRATION_CAPABILITIES.oauth === false &&
      INTEGRATION_CAPABILITIES.calendar === false &&
      !existsSync(join(identityDir, 'oauth.js')) &&
      !existsSync(join(identityDir, 'session.js')) &&
      !existsSync(join(identityDir, 'jwt.js')) &&
      !existsSync(join(identityDir, 'login.js')) &&
      !existsSync(join(root, 'server', 'authPlugin.js')) &&
      bindSource.includes("Symbol('proposalforge.studioPrincipal')") &&
      !bindSource.includes('req.session') &&
      !bindSource.includes('req.cookies') &&
      !/from\s+['"][^'"]*(?:jsonwebtoken|jose|passport|cookie-parser)['"]/.test(bindSource),
  )
}

{
  assert(
    '11. TIMELINE_SOURCE_IDS remains unchanged',
    TIMELINE_SOURCE_IDS.length === 9 &&
      TIMELINE_SOURCE_IDS.includes('native_activity') &&
      !TIMELINE_SOURCE_IDS.includes('principal') &&
      !TIMELINE_SOURCE_IDS.includes('studio_principal') &&
      !bindSource.includes('registerTimelineSource'),
  )
}

{
  const ownSource = readFileSync(join(__dirname, 'verify-integrations-principal-binding.mjs'), 'utf8')
  const dataAfter = dataFingerprint()
  const dataStatus = spawnSync('git', ['status', '--porcelain', '--', 'data'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '12. this suite is independent and does not write data files',
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
console.log(`H16.14 principal binding checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
