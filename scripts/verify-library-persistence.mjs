import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { makeContentBlock } from '../src/models/contentBlock.js'
import { PROJECT_TYPES } from '../src/models/proposal.js'
import { makeService } from '../src/models/service.js'
import { makeSettings } from '../src/models/settings.js'
import { makeTemplate } from '../src/models/template.js'
import { updateBrandKit } from '../src/services/brandKitService.js'
import { touchLibraryBlock } from '../src/services/libraryBlockService.js'
import * as libraryBlockStore from '../src/services/libraryBlockStore.js'
import * as serviceStore from '../src/services/serviceStore.js'
import { setDefaultTemplate } from '../src/services/templateService.js'
import * as settingsStore from '../src/services/settingsStore.js'
import { updateSettings } from '../src/services/settingsService.js'
import * as templateStore from '../src/services/templateStore.js'
import { localUploadsPlugin } from '../server/localUploadsPlugin.js'
import { dispatchProductionApi } from '../server/productionApi.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
const verifierSource = readFileSync(
  join(root, 'scripts', 'verify-library-persistence.mjs'),
  'utf8',
)
const FILES = {
  templates: join(dataDir, 'templates.json'),
  services: join(dataDir, 'services.json'),
  libraryBlocks: join(dataDir, 'library-blocks.json'),
  settings: join(dataDir, 'settings.json'),
  proposals: join(dataDir, 'proposals.json'),
}

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

function mockReq(url, method = 'GET', body = '') {
  const req = Readable.from(body ? [Buffer.from(body)] : [])
  req.url = url
  req.method = method
  req.headers = {}
  return req
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    headersSent: false,
    setHeader(key, value) {
      this.headers[key] = value
    },
    end(chunk) {
      this.headersSent = true
      this.body += chunk == null ? '' : String(chunk)
    },
  }
}

async function callProduction(url, method = 'GET', body = '') {
  const req = mockReq(url, method, body)
  const res = mockRes()
  await dispatchProductionApi(req, res)
  let json = null
  try {
    json = JSON.parse(res.body || 'null')
  } catch {
    json = null
  }
  return { status: res.statusCode, json, body: res.body }
}

async function callPlugin(plugin, url, method = 'GET', body = '') {
  const req = mockReq(url, method, body)
  const res = mockRes()
  await plugin.handle(req, res, () => {})
  let json = null
  try {
    json = JSON.parse(res.body || 'null')
  } catch {
    json = null
  }
  return { status: res.statusCode, json }
}

function snapshotFile(file) {
  if (!existsSync(file)) return { exists: false, bytes: null }
  return { exists: true, bytes: readFileSync(file) }
}

function restoreFile(file, snapshot) {
  if (snapshot.exists) {
    writeFileSync(file, snapshot.bytes)
    return
  }
  if (existsSync(file)) unlinkSync(file)
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function sameBytes(left, right) {
  if (left.exists !== right.exists) return false
  if (!left.exists) return true
  return Buffer.compare(left.bytes, right.bytes) === 0
}

mkdirSync(dataDir, { recursive: true })
const backups = {
  templates: snapshotFile(FILES.templates),
  services: snapshotFile(FILES.services),
  libraryBlocks: snapshotFile(FILES.libraryBlocks),
  settings: snapshotFile(FILES.settings),
}

for (const file of [
  FILES.templates,
  FILES.services,
  FILES.libraryBlocks,
  FILES.settings,
]) {
  if (existsSync(file)) unlinkSync(file)
}

const proposalsBefore = snapshotFile(FILES.proposals)

try {
  const missingTemplates = await callProduction('/api/templates')
  assert(
    '1. missing templates GET returns { records: null }, 200',
    missingTemplates.status === 200 && missingTemplates.json?.records === null,
  )

  const missingServices = await callProduction('/api/services')
  assert(
    '1b. missing services GET returns { records: null }, 200',
    missingServices.status === 200 && missingServices.json?.records === null,
  )

  const missingBlocks = await callProduction('/api/library-blocks')
  assert(
    '1c. missing library-blocks GET returns { records: null }, 200',
    missingBlocks.status === 200 && missingBlocks.json?.records === null,
  )

  const missingSettings = await callProduction('/api/settings')
  assert(
    '2. missing settings GET returns { record: null }, 200',
    missingSettings.status === 200 && missingSettings.json?.record === null,
  )

  const templatePayload = [
    { id: 'tpl-http-1', title: 'HTTP Template', description: 'Persisted' },
  ]
  const servicePayload = [
    { id: 'svc-http-1', name: 'HTTP Service', description: 'Persisted' },
  ]
  const blockPayload = [
    { id: 'block-http-1', name: 'HTTP Block', type: 'rich-text' },
  ]
  const settingsPayload = {
    studioName: 'Durable Studio',
    contactEmail: 'durable@example.com',
    defaultProjectType: PROJECT_TYPES[0],
    currency: 'USD',
    about: '',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }

  const putTemplates = await callProduction(
    '/api/templates',
    'PUT',
    JSON.stringify(templatePayload),
  )
  const getTemplates = await callProduction('/api/templates')
  assert(
    '3. PUT templates then GET returns the same ids/fields',
    putTemplates.status === 200 &&
      sameJson(getTemplates.json?.records, templatePayload),
  )

  const putServices = await callProduction(
    '/api/services',
    'PUT',
    JSON.stringify(servicePayload),
  )
  const getServices = await callProduction('/api/services')
  assert(
    '3b. PUT services then GET returns the same ids/fields',
    putServices.status === 200 &&
      sameJson(getServices.json?.records, servicePayload),
  )

  const putBlocks = await callProduction(
    '/api/library-blocks',
    'PUT',
    JSON.stringify(blockPayload),
  )
  const getBlocks = await callProduction('/api/library-blocks')
  assert(
    '3c. PUT library-blocks then GET returns the same ids/fields',
    putBlocks.status === 200 &&
      sameJson(getBlocks.json?.records, blockPayload),
  )

  const putSettings = await callProduction(
    '/api/settings',
    'PUT',
    JSON.stringify(settingsPayload),
  )
  const getSettings = await callProduction('/api/settings')
  assert(
    '4. PUT settings then GET returns the same document',
    putSettings.status === 200 &&
      !Array.isArray(getSettings.json?.record) &&
      sameJson(getSettings.json?.record, settingsPayload),
  )

  assert(
    '5. on-disk JSON matches persisted PUT',
    sameJson(readJsonFile(FILES.templates), templatePayload) &&
      sameJson(readJsonFile(FILES.services), servicePayload) &&
      sameJson(readJsonFile(FILES.libraryBlocks), blockPayload) &&
      sameJson(readJsonFile(FILES.settings), settingsPayload),
  )

  const freshPlugin = localUploadsPlugin()
  const pluginTemplates = await callPlugin(freshPlugin, '/api/templates')
  const pluginSettings = await callPlugin(freshPlugin, '/api/settings')
  assert(
    '6. new plugin/API instance reads the previous write',
    sameJson(pluginTemplates.json?.records, templatePayload) &&
      sameJson(pluginSettings.json?.record, settingsPayload),
  )

  const badTemplates = await callProduction(
    '/api/templates',
    'PUT',
    JSON.stringify({ records: templatePayload }),
  )
  const badServices = await callProduction(
    '/api/services',
    'PUT',
    JSON.stringify({ name: 'nope' }),
  )
  const badBlocks = await callProduction(
    '/api/library-blocks',
    'PUT',
    JSON.stringify(null),
  )
  assert(
    '7. non-array collection PUT returns 400',
    badTemplates.status === 400 &&
      badServices.status === 400 &&
      badBlocks.status === 400,
  )

  const settingsArray = await callProduction(
    '/api/settings',
    'PUT',
    JSON.stringify([{ studioName: 'Array' }]),
  )
  assert(
    '8. settings PUT remains a document, not an array',
    settingsArray.status === 400 &&
      getSettings.json?.record &&
      !Array.isArray(getSettings.json.record) &&
      sameJson((await callProduction('/api/settings')).json?.record, settingsPayload),
  )

  const proposals = await callProduction('/api/proposals')
  assert(
    '9. GET /api/proposals still works',
    proposals.status === 200 && Object.hasOwn(proposals.json || {}, 'records'),
  )

  const proposalsAfter = snapshotFile(FILES.proposals)
  assert(
    '10. proposal JSON is untouched by these new routes',
    sameBytes(proposalsBefore, proposalsAfter),
  )
} finally {
  restoreFile(FILES.templates, backups.templates)
  restoreFile(FILES.services, backups.services)
  restoreFile(FILES.libraryBlocks, backups.libraryBlocks)
  restoreFile(FILES.settings, backups.settings)
}

const memory = {
  templates: null,
  services: null,
  libraryBlocks: null,
  settings: null,
  brandKit: null,
}
let putShouldFail = false
let getShouldFail = false
const originalFetch = globalThis.fetch

globalThis.fetch = async (url, init) => {
  const href = String(url)
  const method = String(init?.method || 'GET').toUpperCase()

  if (getShouldFail && method === 'GET') {
    throw new Error('simulated load failure')
  }
  if (putShouldFail && method === 'PUT') {
    return { ok: false, json: async () => ({ message: 'persist failed' }) }
  }

  if (href.includes('/api/assets')) {
    return { ok: true, json: async () => [] }
  }
  if (href.includes('/api/brand-kit')) {
    if (method === 'PUT') {
      memory.brandKit = JSON.parse(init.body)
      return { ok: true, json: async () => ({ ok: true }) }
    }
    return { ok: true, json: async () => ({ record: memory.brandKit }) }
  }
  if (href.includes('/api/templates')) {
    if (method === 'PUT') {
      memory.templates = JSON.parse(init.body)
      return { ok: true, json: async () => ({ ok: true, count: memory.templates.length }) }
    }
    return { ok: true, json: async () => ({ records: memory.templates }) }
  }
  if (href.includes('/api/services')) {
    if (method === 'PUT') {
      memory.services = JSON.parse(init.body)
      return { ok: true, json: async () => ({ ok: true, count: memory.services.length }) }
    }
    return { ok: true, json: async () => ({ records: memory.services }) }
  }
  if (href.includes('/api/library-blocks')) {
    if (method === 'PUT') {
      memory.libraryBlocks = JSON.parse(init.body)
      return { ok: true, json: async () => ({ ok: true, count: memory.libraryBlocks.length }) }
    }
    return { ok: true, json: async () => ({ records: memory.libraryBlocks }) }
  }
  if (href.includes('/api/settings')) {
    if (method === 'PUT') {
      memory.settings = JSON.parse(init.body)
      return { ok: true, json: async () => ({ ok: true }) }
    }
    return { ok: true, json: async () => ({ record: memory.settings }) }
  }
  if (typeof originalFetch === 'function') {
    return originalFetch(url, init)
  }
  throw new TypeError(`Unexpected fetch: ${href}`)
}

function dropAll() {
  templateStore.dropCache()
  serviceStore.dropCache()
  libraryBlockStore.dropCache()
  settingsStore.dropCache()
}

memory.templates = null
memory.services = null
memory.libraryBlocks = null
memory.settings = null
dropAll()
await Promise.all([
  templateStore.ready(),
  serviceStore.ready(),
  libraryBlockStore.ready(),
  settingsStore.ready(),
])
assert(
  '11. ready() with missing API seeds mocks in memory',
  Boolean(templateStore.findById('tpl-2001')) &&
    Boolean(serviceStore.findById('architecture')) &&
    Boolean(libraryBlockStore.findById('block-exec-summary')) &&
    settingsStore.get().studioName === 'ProposalForge Studio',
)

memory.templates = []
memory.services = []
memory.libraryBlocks = []
dropAll()
await Promise.all([
  templateStore.ready(),
  serviceStore.ready(),
  libraryBlockStore.ready(),
])
assert(
  '12. ready() with persisted [] uses [] rather than mocks',
  templateStore.all().length === 0 &&
    serviceStore.all().length === 0 &&
    libraryBlockStore.all().length === 0,
)

const createdTemplate = await templateStore.insert(
  makeTemplate({ id: 'tpl-persist-1', title: 'Durable Template' }),
)
const createdService = await serviceStore.insert(
  makeService({ id: 'svc-persist-1', name: 'Durable Service' }),
)
const createdBlock = await libraryBlockStore.insert(
  makeContentBlock({ id: 'block-persist-1', name: 'Durable Block' }),
)
dropAll()
await Promise.all([
  templateStore.ready(),
  serviceStore.ready(),
  libraryBlockStore.ready(),
])
assert(
  '13. CRUD mutation → cache drop → ready() preserves the mutation',
  templateStore.findById(createdTemplate.id)?.title === 'Durable Template' &&
    serviceStore.findById(createdService.id)?.name === 'Durable Service' &&
    libraryBlockStore.findById(createdBlock.id)?.name === 'Durable Block',
)

await templateStore.remove(createdTemplate.id)
await serviceStore.remove(createdService.id)
await libraryBlockStore.remove(createdBlock.id)
dropAll()
await Promise.all([
  templateStore.ready(),
  serviceStore.ready(),
  libraryBlockStore.ready(),
])
assert(
  '14. delete → cache drop → ready() confirms deletion',
  !templateStore.findById(createdTemplate.id) &&
    !serviceStore.findById(createdService.id) &&
    !libraryBlockStore.findById(createdBlock.id) &&
    templateStore.all().length === 0,
)

memory.templates = null
dropAll()
await templateStore.ready()
await setDefaultTemplate('tpl-2002')
dropAll()
await templateStore.ready()
const defaults = templateStore.all().filter((row) => row.isDefault)
assert(
  '15. setDefaultTemplate leaves exactly one default after reload',
  defaults.length === 1 && defaults[0].id === 'tpl-2002',
)

memory.libraryBlocks = null
dropAll()
await libraryBlockStore.ready()
const beforeTouch = libraryBlockStore.findById('block-exec-summary')
const touched = await touchLibraryBlock('block-exec-summary')
dropAll()
await libraryBlockStore.ready()
const reloadedTouch = libraryBlockStore.findById('block-exec-summary')
assert(
  '16. touchLibraryBlock survives reload',
  touched?.useCount === Number(beforeTouch.useCount) + 1 &&
    reloadedTouch?.useCount === touched.useCount &&
    Boolean(reloadedTouch.lastUsedAt),
)

memory.settings = null
dropAll()
await settingsStore.ready()
await updateSettings({
  studioName: 'Reloaded Studio',
  contactEmail: 'reload@example.com',
  about: 'Survives reload',
})
dropAll()
await settingsStore.ready()
const reloadedSettings = settingsStore.get()
assert(
  '17. updateSettings survives reload',
  reloadedSettings.studioName === 'Reloaded Studio' &&
    reloadedSettings.contactEmail === 'reload@example.com' &&
    reloadedSettings.about === 'Survives reload',
)

memory.brandKit = null
memory.settings = makeSettings({
  studioName: 'Before Kit',
  contactEmail: 'before@example.com',
  about: 'Before',
})
dropAll()
await updateBrandKit({
  companyName: 'Kit Studio',
  contact: {
    legalName: 'Kit Studio',
    email: 'kit@studio.test',
    phone: '',
    website: 'kit.example',
    address: '',
  },
  description: 'From Brand Kit',
})
settingsStore.dropCache()
await settingsStore.ready()
const synced = settingsStore.get()
assert(
  '18. Brand Kit settings sync persists and survives reload',
  synced.studioName === 'Kit Studio' &&
    synced.contactEmail === 'kit@studio.test' &&
    synced.about === 'From Brand Kit',
)

memory.templates = []
dropAll()
await templateStore.ready()
putShouldFail = true
let persistThrew = false
try {
  await templateStore.insert(makeTemplate({ id: 'tpl-fail', title: 'Fail' }))
} catch (error) {
  persistThrew = String(error?.message || '').includes('Could not persist templates.')
}
putShouldFail = false
assert('19. persist failure throws', persistThrew)

memory.templates = [
  { id: 'tpl-keep', title: 'Keep After Load Failure' },
]
dropAll()
await templateStore.ready()
const kept = templateStore.all()
getShouldFail = true
await templateStore.ready()
getShouldFail = false
assert(
  '20. load failure does not wipe an already-loaded cache',
  kept.length === 1 &&
    templateStore.findById('tpl-keep')?.title === 'Keep After Load Failure',
)

memory.templates = null
memory.services = null
memory.libraryBlocks = null
dropAll()
await Promise.all([
  templateStore.ready(),
  serviceStore.ready(),
  libraryBlockStore.ready(),
])
assert(
  '21. seed ids remain compatible with existing composition paths',
  Boolean(templateStore.findById('tpl-2001')) &&
    Boolean(templateStore.findById('tpl-architecture')) &&
    Boolean(serviceStore.findById('architecture')) &&
    Boolean(libraryBlockStore.findById('block-exec-summary')) &&
    Boolean(libraryBlockStore.findById('block-about-us')),
)

assert(
  '22. verifier itself contains no nested verifier execution',
  !verifierSource.includes('child' + '_process') &&
    !verifierSource.includes('spawn' + 'Sync'),
)

globalThis.fetch = originalFetch
dropAll()

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
