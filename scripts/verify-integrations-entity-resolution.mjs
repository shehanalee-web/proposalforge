/**
 * H16.10 Slice 10.1 — Activity entity registry verification.
 *
 * Slice 10.1: schema + in-memory store.
 * Slice 10.2: resolveActivityEntity / assertActivityEntityAccess.
 * Slice 10.3: timeline engine subject authorization.
 * Slice 10.4: authoring HTTP POST subject authorization.
 * Does not nest H16.7–H16.9. Does not add entity HTTP CRUD.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { ACTIVITY_SUBJECT_TYPE } from '../src/integrations/activities/types.js'
import {
  ACTIVITY_ENTITY_FORBIDDEN,
  ACTIVITY_ENTITY_KIND,
  ACTIVITY_ENTITY_KINDS,
  ACTIVITY_ENTITY_NOT_FOUND,
  ACTIVITY_RESOLVABLE_SUBJECT_TYPES,
  assertActivityEntityAccess,
  buildTimeline,
  cloneActivityEntity,
  configureTimelineProposalLookup,
  getActivityEntity,
  listActivityEntities,
  makeActivityEntity,
  resetActivityEntityStore,
  resetTimelineProposalLookup,
  resetTimelineSources,
  resolveActivityEntity,
  upsertActivityEntity,
} from '../src/integrations/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID

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

async function threwAsync(fn) {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

function leak(error, ...tokens) {
  const text = `${error?.message ?? ''}${JSON.stringify(error?.errors ?? [])}`
  return tokens.some((token) => token && text.includes(token))
}

function fixture(kind, id, companyId = studio, extra = {}) {
  return {
    id,
    companyId,
    kind,
    displayName: id,
    ...extra,
  }
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

resetActivityEntityStore()

console.log('— H16.10.1 schema —')

{
  const contact = makeActivityEntity(fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1'))
  const company = makeActivityEntity(fixture(ACTIVITY_ENTITY_KIND.COMPANY, 'company-1'))
  const deal = makeActivityEntity(
    fixture(ACTIVITY_ENTITY_KIND.DEAL, 'deal-1', studio, {
      proposalId: 'prop-h1610-a',
      contactId: 'contact-1',
      companyRefId: 'company-1',
    }),
  )
  assert(
    '1. kinds match Activity subject types and omit CLOSE',
    contact.kind === ACTIVITY_SUBJECT_TYPE.CONTACT &&
      company.kind === ACTIVITY_SUBJECT_TYPE.COMPANY &&
      deal.kind === ACTIVITY_SUBJECT_TYPE.DEAL &&
      ACTIVITY_ENTITY_KINDS.length === 3 &&
      !ACTIVITY_ENTITY_KINDS.includes(ACTIVITY_SUBJECT_TYPE.CLOSE) &&
      !ACTIVITY_ENTITY_KINDS.includes(ACTIVITY_SUBJECT_TYPE.PROPOSAL),
  )
  assert(
    '2. company-kind id is not the tenant companyId',
    company.id === 'company-1' &&
      company.companyId === studio &&
      company.id !== company.companyId &&
      studio === 'company-studio',
  )
  assert(
    '3. deal refs are opaque and never named companyId',
    deal.proposalId === 'prop-h1610-a' &&
      deal.contactId === 'contact-1' &&
      deal.companyRefId === 'company-1' &&
      deal.companyId === studio &&
      !Object.prototype.hasOwnProperty.call(deal, 'companyEntityId'),
  )
  assert(
    '4. clone round-trips',
    JSON.stringify(cloneActivityEntity(contact)) === JSON.stringify(contact),
  )
}

{
  const close = threw(() => makeActivityEntity(fixture(ACTIVITY_SUBJECT_TYPE.CLOSE, 'close-1')))
  const proposal = threw(() =>
    makeActivityEntity(fixture(ACTIVITY_SUBJECT_TYPE.PROPOSAL, 'prop-1')),
  )
  const money = threw(() =>
    makeActivityEntity(fixture(ACTIVITY_ENTITY_KIND.DEAL, 'deal-money', studio, { amount: 12 })),
  )
  const vendor = threw(() =>
    makeActivityEntity(
      fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-ext', studio, { externalKey: 'contact:a@b.c' }),
    ),
  )
  const secret = threw(() =>
    makeActivityEntity(fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-secret', studio, { apiKey: 'x' })),
  )
  const emailOnCompany = threw(() =>
    makeActivityEntity(
      fixture(ACTIVITY_ENTITY_KIND.COMPANY, 'company-email', studio, { email: 'a@b.c' }),
    ),
  )
  const missingId = threw(() =>
    makeActivityEntity({ companyId: studio, kind: ACTIVITY_ENTITY_KIND.CONTACT }),
  )
  assert(
    '5. schema rejects CLOSE, proposal, money, vendor keys, secrets, and cross-kind fields',
    close instanceof ValidationError &&
      proposal instanceof ValidationError &&
      money instanceof ValidationError &&
      vendor instanceof ValidationError &&
      secret instanceof ValidationError &&
      emailOnCompany instanceof ValidationError &&
      missingId instanceof ValidationError,
  )
}

console.log('')
console.log('— H16.10.1 store —')

{
  resetActivityEntityStore([
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1'),
    fixture(ACTIVITY_ENTITY_KIND.COMPANY, 'company-1'),
    fixture(ACTIVITY_ENTITY_KIND.DEAL, 'deal-1'),
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-other', otherCompany),
  ])
  const contact = getActivityEntity(studio, ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1')
  const company = getActivityEntity(studio, ACTIVITY_ENTITY_KIND.COMPANY, 'company-1')
  const deal = getActivityEntity(studio, ACTIVITY_ENTITY_KIND.DEAL, 'deal-1')
  assert(
    '6. seeded fixtures are readable in the owning company',
    contact.id === 'contact-1' && company.id === 'company-1' && deal.id === 'deal-1',
  )
}

{
  const missing = threw(() =>
    getActivityEntity(studio, ACTIVITY_ENTITY_KIND.CONTACT, 'contact-missing'),
  )
  assert(
    '7. globally absent entity returns 404 without leaking the id',
    missing instanceof NotFoundError &&
      missing.message === ACTIVITY_ENTITY_NOT_FOUND &&
      missing.message === 'Activity subject not found.' &&
      !leak(missing, 'contact-missing', otherCompany),
  )
}

{
  const cross = threw(() =>
    getActivityEntity(studio, ACTIVITY_ENTITY_KIND.CONTACT, 'contact-other'),
  )
  assert(
    '8. other-company entity returns 403 without leaking id or companyId',
    cross instanceof ForbiddenError &&
      cross.message === ACTIVITY_ENTITY_FORBIDDEN &&
      cross.message === 'You cannot access another company workspace.' &&
      !leak(cross, 'contact-other', otherCompany),
  )
}

{
  const listed = listActivityEntities(studio)
  const contacts = listActivityEntities(studio, { type: ACTIVITY_ENTITY_KIND.CONTACT })
  const otherList = listActivityEntities(otherCompany)
  assert(
    '9. list is company-scoped and does not include foreign rows',
    listed.length === 3 &&
      contacts.length === 1 &&
      contacts[0].id === 'contact-1' &&
      otherList.length === 1 &&
      otherList[0].id === 'contact-other' &&
      !listed.some((row) => row.companyId !== studio),
  )
}

{
  const updated = upsertActivityEntity(
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1', studio, { displayName: 'Patched contact' }),
  )
  const hijack = threw(() =>
    upsertActivityEntity(fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1', otherCompany)),
  )
  const created = upsertActivityEntity(fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-2'))
  assert(
    '10. upsert updates the owner and refuses cross-company identity takeover',
    updated.displayName === 'Patched contact' &&
      created.id === 'contact-2' &&
      hijack instanceof ForbiddenError &&
      hijack.message === ACTIVITY_ENTITY_FORBIDDEN &&
      !leak(hijack, 'contact-1', otherCompany),
  )
}

{
  const duplicate = threw(() =>
    resetActivityEntityStore([
      fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1'),
      fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1'),
    ]),
  )
  resetActivityEntityStore()
  assert(
    '11. reset refuses duplicate kind+id and clears the registry',
    duplicate instanceof ValidationError && listActivityEntities(studio).length === 0,
  )
}

console.log('')
console.log('— H16.10.1 boundaries —')

{
  const moduleSource = collectJs(join(root, 'src', 'integrations', 'entities'))
  const dataDir = join(root, 'data')
  const ownStore = existsSync(dataDir)
    ? readdirSync(dataDir).filter((name) => /^entities\.json$/i.test(name))
    : []
  const proposalsDiff = spawnSync('git', ['diff', '--', 'data/proposals.json'], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert(
    '12. entity module does not import CRM adapters or persistence factories',
    !/integrations\/crm\/adapters|createPostgresActivityRepository|createMemoryActivityRepository/.test(
      moduleSource,
    ) && !/readFileSync\([^)]*entities\.json|writeFileSync\([^)]*entities\.json/.test(moduleSource),
  )
  assert(
    '13. no entities.json and proposals.json is unmodified',
    ownStore.length === 0 &&
      !existsSync(join(dataDir, 'entities.json')) &&
      !(proposalsDiff.stdout || '').trim(),
  )
}

console.log('')
console.log('— H16.10.2 resolver —')

{
  resetActivityEntityStore([
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1'),
    fixture(ACTIVITY_ENTITY_KIND.COMPANY, 'company-1'),
    fixture(ACTIVITY_ENTITY_KIND.DEAL, 'deal-1'),
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-other', otherCompany),
  ])
  const contact = resolveActivityEntity({
    companyId: studio,
    type: ACTIVITY_ENTITY_KIND.CONTACT,
    id: 'contact-1',
  })
  const company = resolveActivityEntity({
    companyId: studio,
    type: ACTIVITY_ENTITY_KIND.COMPANY,
    id: 'company-1',
  })
  const deal = resolveActivityEntity({
    companyId: studio,
    type: ACTIVITY_ENTITY_KIND.DEAL,
    id: 'deal-1',
  })
  assert(
    '14. contact resolves for the owning company',
    contact.id === 'contact-1' && contact.kind === ACTIVITY_ENTITY_KIND.CONTACT && contact.companyId === studio,
  )
  assert(
    '15. company entity resolves for the owning company',
    company.id === 'company-1' &&
      company.kind === ACTIVITY_ENTITY_KIND.COMPANY &&
      company.companyId === studio,
  )
  assert(
    '16. deal resolves for the owning company',
    deal.id === 'deal-1' && deal.kind === ACTIVITY_ENTITY_KIND.DEAL && deal.companyId === studio,
  )
}

{
  const missing = threw(() =>
    resolveActivityEntity({
      companyId: studio,
      type: ACTIVITY_ENTITY_KIND.CONTACT,
      id: 'contact-missing',
    }),
  )
  const accessMissing = threw(() =>
    assertActivityEntityAccess(studio, {
      type: ACTIVITY_ENTITY_KIND.CONTACT,
      id: 'contact-missing',
    }),
  )
  assert(
    '17. missing entity returns 404 Activity subject not found.',
    missing instanceof NotFoundError &&
      missing.message === 'Activity subject not found.' &&
      accessMissing instanceof NotFoundError &&
      accessMissing.message === ACTIVITY_ENTITY_NOT_FOUND &&
      !leak(missing, 'contact-missing', otherCompany),
  )
}

{
  const cross = threw(() =>
    resolveActivityEntity({
      companyId: studio,
      type: ACTIVITY_ENTITY_KIND.CONTACT,
      id: 'contact-other',
    }),
  )
  const accessCross = threw(() =>
    assertActivityEntityAccess(studio, {
      type: ACTIVITY_ENTITY_KIND.CONTACT,
      id: 'contact-other',
    }),
  )
  assert(
    '18. foreign-tenant entity returns 403 without leaking id or companyId',
    cross instanceof ForbiddenError &&
      cross.message === 'You cannot access another company workspace.' &&
      accessCross instanceof ForbiddenError &&
      accessCross.message === ACTIVITY_ENTITY_FORBIDDEN &&
      !leak(cross, 'contact-other', otherCompany) &&
      !leak(accessCross, 'contact-other', otherCompany),
  )
}

{
  const proposal = threw(() =>
    assertActivityEntityAccess(studio, {
      type: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      id: 'prop-does-not-exist',
    }),
  )
  const close = threw(() =>
    assertActivityEntityAccess(studio, {
      type: ACTIVITY_SUBJECT_TYPE.CLOSE,
      id: 'close-1',
    }),
  )
  const missingSubject = threw(() => assertActivityEntityAccess(studio, null))
  const missingId = threw(() =>
    assertActivityEntityAccess(studio, { type: ACTIVITY_ENTITY_KIND.CONTACT }),
  )
  const resolveProposal = threw(() =>
    resolveActivityEntity({
      companyId: studio,
      type: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      id: 'prop-h1610-a',
    }),
  )
  assert(
    '19. proposal and close subjects are ignored by assertActivityEntityAccess',
    proposal === null && close === null,
  )
  assert(
    '20. missing subject and missing subject id are ignored',
    missingSubject === null && missingId === null,
  )
  assert(
    '21. resolveActivityEntity does not look up proposal subjects',
    resolveProposal instanceof ValidationError,
  )
}

{
  const tenantAsCompany = threw(() =>
    resolveActivityEntity({
      companyId: studio,
      type: ACTIVITY_ENTITY_KIND.COMPANY,
      id: studio,
    }),
  )
  resetActivityEntityStore([
    fixture(ACTIVITY_ENTITY_KIND.COMPANY, 'company-1'),
    fixture(ACTIVITY_ENTITY_KIND.COMPANY, studio),
  ])
  const tenantRow = threw(() =>
    resolveActivityEntity({
      companyId: studio,
      type: ACTIVITY_ENTITY_KIND.COMPANY,
      id: studio,
    }),
  )
  const companyEntity = resolveActivityEntity({
    companyId: studio,
    type: ACTIVITY_ENTITY_KIND.COMPANY,
    id: 'company-1',
  })
  assert(
    '22. company-1 resolves from an entity row; tenant company-studio is never a company subject',
    companyEntity.id === 'company-1' &&
      companyEntity.id !== studio &&
      tenantAsCompany instanceof NotFoundError &&
      tenantAsCompany.message === ACTIVITY_ENTITY_NOT_FOUND &&
      tenantRow instanceof NotFoundError &&
      !leak(tenantAsCompany, studio, 'company-1') &&
      !leak(tenantRow, studio, 'company-studio'),
  )
}

{
  resetActivityEntityStore([fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1')])
  const resolved = resolveActivityEntity({
    companyId: studio,
    type: ACTIVITY_ENTITY_KIND.CONTACT,
    id: 'contact-1',
  })
  const frozen = Object.isFrozen(resolved)
  const mutated = threw(() => {
    resolved.displayName = 'mutated-in-place'
    resolved.id = 'contact-hijack'
  })
  const stored = getActivityEntity(studio, ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1')
  assert(
    '23. returned entity is frozen and cannot mutate the store',
    frozen &&
      stored.displayName === 'contact-1' &&
      stored.id === 'contact-1' &&
      resolved.displayName === 'contact-1',
  )
  void mutated
}

{
  const resolveSource = readFileSync(
    join(root, 'src', 'integrations', 'entities', 'resolve.js'),
    'utf8',
  )
  const engineSource = readFileSync(
    join(root, 'src', 'integrations', 'activities', 'engine.js'),
    'utf8',
  )
  const authoringPlugin = readFileSync(
    join(root, 'server', 'integrationsActivityAuthoringPlugin.js'),
    'utf8',
  )
  assert(
    '24. resolver is wired into the timeline engine and authoring HTTP POST',
    engineSource.includes('assertActivityEntityAccess') &&
      engineSource.includes('assertProposalAccess') &&
      engineSource.indexOf('assertProposalAccess(companyId, subject)') <
        engineSource.indexOf('assertActivityEntityAccess(companyId, subject)') &&
      authoringPlugin.includes('assertActivityEntityAccess') &&
      authoringPlugin.includes('assertProposalAccess') &&
      authoringPlugin.indexOf('assertProposalAccess(companyId, input.subject ?? {})') <
        authoringPlugin.indexOf('assertActivityEntityAccess(companyId, input.subject ?? {})') &&
      !authoringPlugin.includes('resolveActivityEntity') &&
      !/\/api\/entities/.test(authoringPlugin) &&
      !/integrations\/crm|createPostgresActivityRepository/.test(resolveSource),
  )
}

console.log('')
console.log('— H16.10.3 timeline engine —')

{
  assert(
    '25. contact, company, and deal are resolvable timeline subject types; CLOSE is not',
    ACTIVITY_RESOLVABLE_SUBJECT_TYPES.includes(ACTIVITY_SUBJECT_TYPE.PROPOSAL) &&
      ACTIVITY_RESOLVABLE_SUBJECT_TYPES.includes(ACTIVITY_ENTITY_KIND.CONTACT) &&
      ACTIVITY_RESOLVABLE_SUBJECT_TYPES.includes(ACTIVITY_ENTITY_KIND.COMPANY) &&
      ACTIVITY_RESOLVABLE_SUBJECT_TYPES.includes(ACTIVITY_ENTITY_KIND.DEAL) &&
      !ACTIVITY_RESOLVABLE_SUBJECT_TYPES.includes(ACTIVITY_SUBJECT_TYPE.CLOSE),
  )
}

{
  resetTimelineSources()
  resetActivityEntityStore([
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-1'),
    fixture(ACTIVITY_ENTITY_KIND.COMPANY, 'company-1'),
    fixture(ACTIVITY_ENTITY_KIND.DEAL, 'deal-1'),
    fixture(ACTIVITY_ENTITY_KIND.CONTACT, 'contact-other', otherCompany),
  ])
  const contact = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_ENTITY_KIND.CONTACT,
      subjectId: 'contact-1',
    }),
  )
  const company = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_ENTITY_KIND.COMPANY,
      subjectId: 'company-1',
    }),
  )
  const deal = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_ENTITY_KIND.DEAL,
      subjectId: 'deal-1',
    }),
  )
  assert(
    '26. known contact/company/deal subjects resolve through the timeline engine',
    contact === null && company === null && deal === null,
  )
}

{
  const unknown = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_ENTITY_KIND.CONTACT,
      subjectId: 'contact-missing',
    }),
  )
  const cross = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_ENTITY_KIND.CONTACT,
      subjectId: 'contact-other',
    }),
  )
  assert(
    '27. unknown entity returns 404; cross-tenant entity returns 403 without leaks',
    unknown instanceof NotFoundError &&
      unknown.message === 'Activity subject not found.' &&
      !leak(unknown, 'contact-missing', otherCompany) &&
      cross instanceof ForbiddenError &&
      cross.message === 'You cannot access another company workspace.' &&
      !leak(cross, 'contact-other', otherCompany),
  )
}

{
  resetTimelineProposalLookup()
  configureTimelineProposalLookup((proposalId) => {
    if (String(proposalId) === 'prop-h1610-a') return { id: 'prop-h1610-a', companyId: studio }
    if (String(proposalId) === 'prop-h1610-other') {
      return { id: 'prop-h1610-other', companyId: otherCompany }
    }
    return null
  })
  const known = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      subjectId: 'prop-h1610-a',
    }),
  )
  const missing = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      subjectId: 'prop-does-not-exist',
    }),
  )
  const cross = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_SUBJECT_TYPE.PROPOSAL,
      subjectId: 'prop-h1610-other',
    }),
  )
  assert(
    '28. proposal authorization remains on assertProposalAccess',
    known === null &&
      missing instanceof NotFoundError &&
      missing.message === 'Timeline subject not found.' &&
      !String(missing.message).includes('Activity subject') &&
      cross instanceof ForbiddenError &&
      !leak(cross, 'prop-h1610-other', otherCompany),
  )
  resetTimelineProposalLookup()
}

{
  const close = await threwAsync(() =>
    buildTimeline({
      companyId: studio,
      subjectType: ACTIVITY_SUBJECT_TYPE.CLOSE,
      subjectId: 'close-1',
    }),
  )
  assert(
    '29. CLOSE remains an unresolvable timeline subject',
    close instanceof ValidationError &&
      String(close.message).includes('not resolvable'),
  )
}

{
  resetActivityEntityStore()
  const unscoped = await threwAsync(() => buildTimeline({ companyId: studio, limit: 5 }))
  assert(
    '30. unscoped timeline does not perform entity resolution',
    unscoped === null,
  )
}

resetActivityEntityStore()
resetTimelineSources()
resetTimelineProposalLookup()

console.log('')
console.log('— H16.10.4 authoring HTTP —')

{
  const authoringPlugin = readFileSync(
    join(root, 'server', 'integrationsActivityAuthoringPlugin.js'),
    'utf8',
  )
  const timelinePlugin = readFileSync(
    join(root, 'server', 'integrationsActivitiesPlugin.js'),
    'utf8',
  )
  const viteSource = readFileSync(join(root, 'vite.config.js'), 'utf8')
  const productionSource = readFileSync(join(root, 'server', 'productionApi.js'), 'utf8')
  const postBlockStart = authoringPlugin.indexOf("matchRoute(url, '/api/activities'))")
  const postBlock = authoringPlugin.slice(postBlockStart)
  assert(
    '31. authoring POST resolves entities after proposal access; no entity HTTP CRUD',
    postBlock.includes('assertActivityEntityAccess(companyId, input.subject ?? {})') &&
      postBlock.includes('assertProposalAccess(companyId, input.subject ?? {})') &&
      postBlock.indexOf('assertProposalAccess(companyId, input.subject ?? {})') <
        postBlock.indexOf('assertActivityEntityAccess(companyId, input.subject ?? {})') &&
      !postBlock.includes('createStudioActivity(resolved') &&
      !/\/api\/entities/.test(authoringPlugin + timelinePlugin + viteSource + productionSource) &&
      !existsSync(join(root, 'server', 'integrationsEntitiesPlugin.js')),
  )
}

console.log('')
console.log(`H16.10 entity registry checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
