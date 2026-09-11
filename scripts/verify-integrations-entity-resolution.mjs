/**
 * H16.10 Slice 10.1 — Activity entity registry verification.
 *
 * Schema + in-memory store only. Does not nest H16.7–H16.9.
 * Does not wire timeline or authoring HTTP. Never writes data/proposals.json.
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
  cloneActivityEntity,
  getActivityEntity,
  listActivityEntities,
  makeActivityEntity,
  resetActivityEntityStore,
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

resetActivityEntityStore()

console.log('')
console.log(`H16.10 entity registry checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
