import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { aiPlugin } from '../server/aiPlugin.js'
import { localUploadsPlugin } from '../server/localUploadsPlugin.js'
import { dispatchProductionApi } from '../server/productionApi.js'
import {
  deleteBlob,
  endJsonResponse,
  flushRuntimeWrites,
  installTestBlobDriver,
  jsonObjectKey,
  putBlob,
  readJson,
  resetRuntimeStoreTestState,
  writeJson,
} from '../server/runtimeStore.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
const uploadsDir = join(root, 'public', 'uploads')
const tmpJson = join('/tmp', 'proposalforge-data', 'templates.json')
const verifierSource = readFileSync(join(root, 'scripts', 'verify-production-storage.mjs'), 'utf8')
const runtimeStoreSource = readFileSync(join(root, 'server', 'runtimeStore.js'), 'utf8')
const uploadsPluginSource = readFileSync(join(root, 'server', 'localUploadsPlugin.js'), 'utf8')
const emailPluginSource = readFileSync(join(root, 'server', 'emailPlugin.js'), 'utf8')
const dataPathsSource = readFileSync(join(root, 'server', 'dataPaths.js'), 'utf8')
const pdfSource = readFileSync(join(root, 'src', 'pdf', 'generateProposalPdf.js'), 'utf8')
const envExample = readFileSync(join(root, '.env.example'), 'utf8')

const JSON_TOKEN = 'test-json-token'
const MEDIA_TOKEN = 'test-media-token'

const JSON_WRITER_PLUGINS = [
  'localUploadsPlugin.js',
  'emailPlugin.js',
  'knowledgePlugin.js',
  'workflowPlugin.js',
  'portalPlugin.js',
  'interactionsPlugin.js',
  'followupPlugin.js',
  'livingPlugin.js',
  'forgePlugin.js',
  'commercialClosePlugin.js',
  'aiPlugin.js',
  'integrationsIntakePlugin.js',
  'integrationsRulesPlugin.js',
  'integrationsIntentsPlugin.js',
  'integrationsWebhooksPlugin.js',
  'integrationsCrmPlugin.js',
  'integrationsDeliveryPlugin.js',
  'integrationsActivitiesPlugin.js',
]

const RISK_FLUSH_PLUGINS = [
  'knowledgePlugin.js',
  'workflowPlugin.js',
  'portalPlugin.js',
  'interactionsPlugin.js',
  'followupPlugin.js',
  'livingPlugin.js',
  'forgePlugin.js',
  'commercialClosePlugin.js',
  'integrationsIntakePlugin.js',
  'integrationsRulesPlugin.js',
  'integrationsIntentsPlugin.js',
  'integrationsWebhooksPlugin.js',
  'integrationsCrmPlugin.js',
  'integrationsDeliveryPlugin.js',
  'aiPlugin.js',
]

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

function mockReq(url, method = 'GET', body = '', headers = {}) {
  const req = Readable.from(body ? [Buffer.isBuffer(body) ? body : Buffer.from(body)] : [])
  req.url = url
  req.method = method
  req.headers = headers
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

async function callProduction(url, method = 'GET', body = '', headers = {}) {
  const req = mockReq(url, method, body, headers)
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

async function callPlugin(plugin, url, method = 'GET', body = '', headers = {}) {
  const req = mockReq(url, method, body, headers)
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
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, snapshot.bytes)
    return
  }
  if (existsSync(file)) unlinkSync(file)
}

function createMemoryBlob({ publicUrl = false } = {}) {
  const objects = new Map()
  const puts = []
  const gets = []
  return {
    objects,
    puts,
    gets,
    async put(pathname, body, options = {}) {
      puts.push({
        pathname,
        access: options.access,
        token: options.token,
        contentType: options.contentType,
        addRandomSuffix: options.addRandomSuffix,
        allowOverwrite: options.allowOverwrite,
      })
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body))
      const host = publicUrl
        ? 'https://blob.vercel-storage.com'
        : 'https://store.private.blob.vercel-storage.com'
      const url = `${host}/${pathname}`
      objects.set(pathname, { bytes, access: options.access, url, token: options.token })
      return { url, pathname }
    },
    async get(pathname, options = {}) {
      gets.push({
        pathname,
        access: options.access,
        token: options.token,
        useCache: options.useCache,
      })
      const row = objects.get(pathname)
      if (!row) return null
      return { statusCode: 200, stream: Readable.from([row.bytes]) }
    },
    async del(target) {
      const keys = Array.isArray(target) ? target : [target]
      for (const key of keys) {
        const asPath = String(key).replace(/^https:\/\/[^/]+\//, '')
        for (const pathname of [...objects.keys()]) {
          const row = objects.get(pathname)
          if (
            pathname === key ||
            pathname === asPath ||
            pathname.startsWith(`${asPath}/`) ||
            row?.url === key
          ) {
            objects.delete(pathname)
          }
        }
      }
    },
    async list({ prefix } = {}) {
      const blobs = []
      for (const [pathname, row] of objects) {
        if (!prefix || pathname === prefix || pathname.startsWith(`${prefix}/`)) {
          blobs.push({ pathname, url: row.url })
        }
      }
      return { blobs }
    },
  }
}

function withEnv(vars, fn) {
  const previous = {}
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key]
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
}

const FILES = {
  templates: join(dataDir, 'templates.json'),
  services: join(dataDir, 'services.json'),
  libraryBlocks: join(dataDir, 'library-blocks.json'),
  settings: join(dataDir, 'settings.json'),
  proposals: join(dataDir, 'proposals.json'),
  brandKit: join(dataDir, 'brand-kit.json'),
  assets: join(dataDir, 'assets.json'),
}

mkdirSync(dataDir, { recursive: true })
mkdirSync(uploadsDir, { recursive: true })

const backups = Object.fromEntries(
  Object.entries(FILES).map(([key, file]) => [key, snapshotFile(file)]),
)

const spawned = 'spawn' + 'Sync'
const childProc = 'child' + '_process'
const runVer = 'run' + 'Verifier'

assert(
  'verifier is self-contained',
  !verifierSource.includes(childProc) &&
    !verifierSource.includes(spawned) &&
    !verifierSource.includes(runVer),
)
assert(
  'runtimeStore has no nested verifier machinery',
  !runtimeStoreSource.includes(childProc) &&
    !runtimeStoreSource.includes(spawned) &&
    !runtimeStoreSource.includes(runVer),
)

assert(
  'runtimeStore exposes readJson/writeJson/putBlob/deleteBlob/flushRuntimeWrites',
  runtimeStoreSource.includes('export async function readJson') &&
    runtimeStoreSource.includes('export function writeJson') &&
    runtimeStoreSource.includes('export function putBlob') &&
    runtimeStoreSource.includes('export function deleteBlob') &&
    runtimeStoreSource.includes('export async function flushRuntimeWrites'),
)

assert(
  'JSON Blob keys are data/{filename}.json',
  jsonObjectKey('templates.json') === 'data/templates.json' &&
    jsonObjectKey('data/proposals.json') === 'data/proposals.json',
)

assert(
  'private JSON uses BLOB_READ_WRITE_TOKEN and access private',
  runtimeStoreSource.includes("const JSON_TOKEN_NAME = 'BLOB_READ_WRITE_TOKEN'") &&
    runtimeStoreSource.includes("access: 'private'") &&
    runtimeStoreSource.includes("contentType: 'application/json'") &&
    runtimeStoreSource.includes('useCache: false'),
)

assert(
  'public media uses BLOB_MEDIA_READ_WRITE_TOKEN and access public',
  runtimeStoreSource.includes("const MEDIA_TOKEN_NAME = 'BLOB_MEDIA_READ_WRITE_TOKEN'") &&
    runtimeStoreSource.includes("access: 'public'") &&
    envExample.includes('BLOB_READ_WRITE_TOKEN=') &&
    envExample.includes('BLOB_MEDIA_READ_WRITE_TOKEN='),
)

assert(
  'no VITE_ blob token',
  !runtimeStoreSource.includes('VITE_BLOB') &&
    !uploadsPluginSource.includes('VITE_BLOB') &&
    !envExample.includes('VITE_BLOB'),
)

assert(
  'generated PDFs stay client-side',
  pdfSource.includes('toBlob()') &&
    !pdfSource.includes('putBlob') &&
    !pdfSource.includes('@vercel/blob') &&
    !runtimeStoreSource.toLowerCase().includes('generateproposalpdf'),
)

assert(
  'no auth/tenant added in storage slice',
  !runtimeStoreSource.includes('companyId') &&
    !runtimeStoreSource.includes('workspaceId') &&
    !uploadsPluginSource.includes('companyId') &&
    !uploadsPluginSource.includes('workspaceId') &&
    !dataPathsSource.includes('companyId'),
)

assert(
  'SAFE writers still await durable writes directly',
  uploadsPluginSource.includes('await writeJson') &&
    uploadsPluginSource.includes('await putBlob') &&
    emailPluginSource.includes('await writeJson') &&
    !uploadsPluginSource.includes('endJsonResponse') &&
    !emailPluginSource.includes('endJsonResponse'),
)

let writersOk = true
let writersDetail = ''
for (const file of JSON_WRITER_PLUGINS) {
  const source = readFileSync(join(root, 'server', file), 'utf8')
  if (!source.includes("from './runtimeStore.js'")) {
    writersOk = false
    writersDetail = `${file} does not import runtimeStore`
    break
  }
  if (file !== 'integrationsDeliveryPlugin.js' && source.includes('writeFileSync')) {
    writersOk = false
    writersDetail = `${file} still writes with writeFileSync`
    break
  }
}
assert('all JSON writers use the shared runtime store', writersOk, writersDetail)

let riskOk = true
let riskDetail = ''
for (const file of RISK_FLUSH_PLUGINS) {
  const source = readFileSync(join(root, 'server', file), 'utf8')
  const flushes =
    source.includes('endJsonResponse') ||
    source.includes('flushAndNext') ||
    source.includes('flushRuntimeWrites')
  if (!flushes) {
    riskOk = false
    riskDetail = `${file} does not flush runtime writes`
    break
  }
}
assert('RISK writers flush pending runtime writes', riskOk, riskDetail)

const plugin = localUploadsPlugin()
let createdUploadDir = ''

try {
  await withEnv(
    { VERCEL: null, BLOB_READ_WRITE_TOKEN: null, BLOB_MEDIA_READ_WRITE_TOKEN: null },
    async () => {
      resetRuntimeStoreTestState()

      const templatesPut = await callPlugin(
        plugin,
        '/api/templates',
        'PUT',
        JSON.stringify([{ id: 'tpl-p02', name: 'P0-2' }]),
      )
      assert(
        'local PUT /api/templates accepts an array',
        templatesPut.status === 200 && templatesPut.json?.ok === true,
      )
      assert(
        'local adapter writes JSON to data/',
        existsSync(FILES.templates) &&
          Array.isArray(JSON.parse(readFileSync(FILES.templates, 'utf8'))),
      )

      const localJson = await readJson('templates.json', null)
      assert('local readJson reads data/templates.json', Array.isArray(localJson) && localJson[0]?.id === 'tpl-p02')

      const assetBody = Buffer.from('p02-asset')
      const assetPost = await callPlugin(plugin, '/api/assets', 'POST', assetBody, {
        'x-file-name': 'note.txt',
        'content-type': 'text/plain',
      })
      assert('local asset POST succeeds', assetPost.status === 201 && assetPost.json?.url)
      const localUrl = String(assetPost.json?.url || '')
      assert('local asset URL stays /uploads/...', localUrl.startsWith('/uploads/'))
      const localFile = join(root, 'public', localUrl)
      assert('local adapter writes uploads to public/uploads', existsSync(localFile))
      createdUploadDir = dirname(localFile)

      const templatesGet = await callPlugin(plugin, '/api/templates')
      assert(
        'GET /api/templates keeps { records } envelope',
        templatesGet.status === 200 && Object.hasOwn(templatesGet.json || {}, 'records'),
      )

      const servicesGet = await callPlugin(plugin, '/api/services')
      assert(
        'GET /api/services works',
        servicesGet.status === 200 && Object.hasOwn(servicesGet.json || {}, 'records'),
      )

      const blocksGet = await callPlugin(plugin, '/api/library-blocks')
      assert(
        'GET /api/library-blocks works',
        blocksGet.status === 200 && Object.hasOwn(blocksGet.json || {}, 'records'),
      )

      const settingsGet = await callPlugin(plugin, '/api/settings')
      assert(
        'GET /api/settings keeps { record } envelope',
        settingsGet.status === 200 && Object.hasOwn(settingsGet.json || {}, 'record'),
      )

      const proposalsGet = await callPlugin(plugin, '/api/proposals')
      assert(
        'existing /api/proposals contract still works',
        proposalsGet.status === 200 && Object.hasOwn(proposalsGet.json || {}, 'records'),
      )

      const brandGet = await callPlugin(plugin, '/api/brand-kit')
      assert(
        'existing /api/brand-kit contract still works',
        brandGet.status === 200 && Object.hasOwn(brandGet.json || {}, 'record'),
      )

      assert(
        'local mode requires neither token',
        !process.env.BLOB_READ_WRITE_TOKEN &&
          !process.env.BLOB_MEDIA_READ_WRITE_TOKEN &&
          templatesPut.status === 200 &&
          assetPost.status === 201,
      )
    },
  )

  await withEnv(
    { VERCEL: null, BLOB_READ_WRITE_TOKEN: JSON_TOKEN, BLOB_MEDIA_READ_WRITE_TOKEN: MEDIA_TOKEN },
    async () => {
      resetRuntimeStoreTestState()
      const localWithTokens = await callPlugin(
        plugin,
        '/api/templates',
        'PUT',
        JSON.stringify([{ id: 'tpl-local-tokens', name: 'local' }]),
      )
      assert(
        'local filesystem is used even if blob tokens are present',
        localWithTokens.status === 200 &&
          JSON.parse(readFileSync(FILES.templates, 'utf8'))[0]?.id === 'tpl-local-tokens',
      )
    },
  )

  const jsonBlob = createMemoryBlob({ publicUrl: false })
  const mediaBlob = createMemoryBlob({ publicUrl: true })
  await withEnv(
    { VERCEL: '1', BLOB_READ_WRITE_TOKEN: JSON_TOKEN, BLOB_MEDIA_READ_WRITE_TOKEN: MEDIA_TOKEN },
    async () => {
      resetRuntimeStoreTestState()
      installTestBlobDriver({ json: jsonBlob, media: mediaBlob })

      await writeJson('templates.json', [{ id: 'tpl-blob' }])
      const readBack = await readJson('templates.json', null)
      const jsonPut = jsonBlob.puts.find((row) => row.pathname === 'data/templates.json')
      assert(
        'private JSON write targets the private Blob configuration',
        Array.isArray(readBack) &&
          readBack[0]?.id === 'tpl-blob' &&
          jsonBlob.objects.has('data/templates.json') &&
          jsonPut?.access === 'private' &&
          jsonPut?.token === JSON_TOKEN &&
          !mediaBlob.objects.has('data/templates.json'),
      )
      assert(
        'JSON objects are not public',
        jsonBlob.puts
          .filter((row) => String(row.pathname).startsWith('data/') && String(row.pathname).endsWith('.json'))
          .every((row) => row.access === 'private' && row.token === JSON_TOKEN) &&
          !mediaBlob.puts.some((row) => String(row.pathname).startsWith('data/')),
      )
      assert(
        'private JSON reads bypass cache',
        jsonBlob.gets.some(
          (row) =>
            row.pathname === 'data/templates.json' &&
            row.access === 'private' &&
            row.useCache === false &&
            row.token === JSON_TOKEN,
        ),
      )

      const blobTemplates = await callPlugin(plugin, '/api/templates')
      assert(
        'production GET /api/templates keeps { records } and never returns a Blob URL',
        blobTemplates.status === 200 &&
          Object.hasOwn(blobTemplates.json || {}, 'records') &&
          !JSON.stringify(blobTemplates.json).includes('blob.vercel-storage.com'),
      )

      const media = await putBlob('uploads/asset-p02/hero.png', Buffer.from('img'), 'image/png')
      const mediaPut = mediaBlob.puts.find((row) => row.pathname === 'uploads/asset-p02/hero.png')
      assert(
        'public media write targets the public Blob configuration',
        mediaPut?.access === 'public' &&
          mediaPut?.token === MEDIA_TOKEN &&
          mediaBlob.objects.has('uploads/asset-p02/hero.png') &&
          !jsonBlob.objects.has('uploads/asset-p02/hero.png'),
      )
      assert(
        'media returns https public URL',
        /^https:\/\//i.test(media.url) &&
          media.pathname === 'uploads/asset-p02/hero.png' &&
          media.url.startsWith('https://blob.vercel-storage.com/'),
      )

      await deleteBlob('uploads/asset-p02/hero.png')
      assert('Blob media delete works', !mediaBlob.objects.has('uploads/asset-p02/hero.png'))

      const blobAsset = await callPlugin(plugin, '/api/assets', 'POST', Buffer.from('prod-asset'), {
        'x-file-name': 'logo.png',
        'content-type': 'image/png',
      })
      assert(
        'newly uploaded production assets store absolute https URLs',
        blobAsset.status === 201 && /^https:\/\//i.test(String(blobAsset.json?.url || '')),
      )

      const attachment = await callPlugin(plugin, '/api/proposal-files', 'POST', Buffer.from('pdf-bytes'), {
        'x-proposal-id': 'prop-1',
        'x-upload-id': 'upl-1',
        'x-file-name': 'brief.pdf',
        'content-type': 'application/pdf',
      })
      assert(
        'proposal attachment URLs are fetchable absolute URLs',
        attachment.status === 201 && /^https:\/\//i.test(String(attachment.json?.url || '')),
      )

      const proposalsGet = await callPlugin(plugin, '/api/proposals')
      const brandGet = await callPlugin(plugin, '/api/brand-kit')
      const servicesGet = await callPlugin(plugin, '/api/services')
      const blocksGet = await callPlugin(plugin, '/api/library-blocks')
      const settingsGet = await callPlugin(plugin, '/api/settings')
      assert(
        'existing P0-1 catalog routes remain unchanged',
        blobTemplates.status === 200 &&
          Object.hasOwn(blobTemplates.json || {}, 'records') &&
          servicesGet.status === 200 &&
          Object.hasOwn(servicesGet.json || {}, 'records') &&
          blocksGet.status === 200 &&
          Object.hasOwn(blocksGet.json || {}, 'records') &&
          settingsGet.status === 200 &&
          Object.hasOwn(settingsGet.json || {}, 'record'),
      )
      assert(
        'existing /api/proposals and /api/brand-kit contracts still work in production mode',
        proposalsGet.status === 200 &&
          Object.hasOwn(proposalsGet.json || {}, 'records') &&
          brandGet.status === 200 &&
          Object.hasOwn(brandGet.json || {}, 'record'),
      )
    },
  )

  await withEnv(
    { VERCEL: '1', BLOB_READ_WRITE_TOKEN: null, BLOB_MEDIA_READ_WRITE_TOKEN: MEDIA_TOKEN },
    async () => {
      resetRuntimeStoreTestState()
      const beforeTmp = snapshotFile(tmpJson)
      const missing = await callProduction('/api/templates')
      assert(
        'missing production JSON preserves null/empty semantics',
        missing.status === 200 && missing.json?.records === null,
      )

      const denied = await callProduction('/api/templates', 'PUT', JSON.stringify([]))
      let writeErr = null
      try {
        await writeJson('templates.json', [{ id: 'no-json-token' }])
      } catch (error) {
        writeErr = error
      }
      assert(
        'missing JSON token fails closed',
        denied.status === 503 && writeErr?.status === 503 && snapshotFile(tmpJson).exists === beforeTmp.exists,
      )
    },
  )

  await withEnv(
    { VERCEL: '1', BLOB_READ_WRITE_TOKEN: JSON_TOKEN, BLOB_MEDIA_READ_WRITE_TOKEN: null },
    async () => {
      resetRuntimeStoreTestState()
      const beforeTmp = snapshotFile(tmpJson)
      const deniedAsset = await callPlugin(plugin, '/api/assets', 'POST', Buffer.from('nope'), {
        'x-file-name': 'x.bin',
        'content-type': 'application/octet-stream',
      })
      let mediaErr = null
      try {
        await putBlob('uploads/no-media-token.bin', Buffer.from('nope'), 'application/octet-stream')
      } catch (error) {
        mediaErr = error
      }
      assert(
        'missing media token fails closed',
        deniedAsset.status === 503 && mediaErr?.status === 503 && snapshotFile(tmpJson).exists === beforeTmp.exists,
      )
    },
  )

  await withEnv(
    { VERCEL: '1', BLOB_READ_WRITE_TOKEN: JSON_TOKEN, BLOB_MEDIA_READ_WRITE_TOKEN: MEDIA_TOKEN },
    async () => {
      resetRuntimeStoreTestState()
      let release
      const gate = new Promise((resolve) => {
        release = resolve
      })
      let putStarted = 0
      let putFinished = 0
      const hangingJson = {
        async put(pathname) {
          putStarted += 1
          await gate
          putFinished += 1
          return { url: `https://store.private.blob.vercel-storage.com/${pathname}`, pathname }
        },
        async get() {
          return null
        },
        async del() {},
      }
      installTestBlobDriver({ json: hangingJson, media: createMemoryBlob({ publicUrl: true }) })

      const writeP = writeJson('templates.json', [{ id: 'inflight' }])
      await new Promise((resolve) => setTimeout(resolve, 0))
      assert('runtimeStore tracks in-flight writes', putStarted === 1 && putFinished === 0)

      let flushDone = false
      const flushP = flushRuntimeWrites().then(() => {
        flushDone = true
      })
      await new Promise((resolve) => setTimeout(resolve, 20))
      assert('flushRuntimeWrites waits for pending writes', !flushDone && putFinished === 0)
      release()
      await flushP
      await writeP
      assert(
        'flushRuntimeWrites completes after pending writes settle',
        flushDone && putFinished === 1,
      )
    },
  )

  await withEnv(
    { VERCEL: '1', BLOB_READ_WRITE_TOKEN: JSON_TOKEN, BLOB_MEDIA_READ_WRITE_TOKEN: MEDIA_TOKEN },
    async () => {
      resetRuntimeStoreTestState()
      const failingJson = {
        async put() {
          await new Promise((resolve) => setTimeout(resolve, 15))
          throw Object.assign(new Error('blob write failed'), { status: 503 })
        },
        async get() {
          return null
        },
        async del() {},
      }
      installTestBlobDriver({ json: failingJson, media: createMemoryBlob({ publicUrl: true }) })
      const failingWrite = writeJson('templates.json', [{ id: 'fail' }])
      const res = mockRes()
      await endJsonResponse(res, 200, { ok: true })
      await failingWrite.catch(() => {})
      assert(
        'a simulated write failure is surfaced',
        res.statusCode === 503 && res.headersSent && res.body.includes('blob write failed'),
      )
    },
  )

  await withEnv(
    {
      VERCEL: '1',
      BLOB_READ_WRITE_TOKEN: JSON_TOKEN,
      BLOB_MEDIA_READ_WRITE_TOKEN: MEDIA_TOKEN,
      AI_PROVIDER: 'mock',
    },
    async () => {
      async function waitFor(predicate) {
        const started = Date.now()
        while (Date.now() - started < 3000) {
          if (predicate()) return true
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
        return false
      }

      function activityDriver(res, fail) {
        let release
        const gate = new Promise((resolve) => {
          release = resolve
        })
        const state = {
          gets: 0,
          putEntered: 0,
          putFinished: 0,
          putSawResponse: false,
          release,
        }
        return {
          state,
          driver: {
            async get(pathname) {
              if (pathname === 'data/aiActivity.json') state.gets += 1
              return null
            },
            async put(pathname) {
              if (pathname !== 'data/aiActivity.json') {
                return {
                  url: `https://store.private.blob.vercel-storage.com/${pathname}`,
                  pathname,
                }
              }
              state.putEntered += 1
              await gate
              state.putSawResponse = Boolean(res.headersSent)
              if (fail) throw Object.assign(new Error('activity write failed'), { status: 503 })
              state.putFinished += 1
              return {
                url: `https://store.private.blob.vercel-storage.com/${pathname}`,
                pathname,
              }
            },
            async del() {},
          },
        }
      }

      resetRuntimeStoreTestState()
      const ai = aiPlugin()
      const successRes = mockRes()
      const success = activityDriver(successRes, false)
      installTestBlobDriver({
        json: success.driver,
        media: createMemoryBlob({ publicUrl: true }),
      })
      const successDone = ai.handle(
        mockReq('/api/ai/coach', 'POST', JSON.stringify({ action: 'ask' })),
        successRes,
        () => {},
      )
      const began = await waitFor(
        () => success.state.gets >= 1 && success.state.putEntered === 1 && success.state.putFinished === 0,
      )
      assert(
        'AI activity persistence begins and stays delayed before its final write',
        began && !successRes.headersSent,
      )
      success.state.release()
      await successDone
      let successJson = null
      try {
        successJson = JSON.parse(successRes.body || 'null')
      } catch {
        successJson = null
      }
      assert(
        'originating AI response does not complete before activity persistence settles',
        successRes.statusCode === 200 &&
          successRes.headersSent &&
          success.state.putSawResponse === false &&
          success.state.putFinished === 1 &&
          typeof successJson?.text === 'string' &&
          successJson.activity &&
          successJson.provider,
      )

      resetRuntimeStoreTestState()
      const failRes = mockRes()
      const failure = activityDriver(failRes, true)
      installTestBlobDriver({
        json: failure.driver,
        media: createMemoryBlob({ publicUrl: true }),
      })
      const late = []
      const onLate = (error) => late.push(error)
      process.on('unhandledRejection', onLate)
      try {
        const failDone = ai.handle(
          mockReq('/api/ai/coach', 'POST', JSON.stringify({ action: 'ask' })),
          failRes,
          () => {},
        )
        const blocked = await waitFor(() => failure.state.putEntered === 1 && !failRes.headersSent)
        assert('failed AI activity write is still pending when the response is open', blocked)
        failure.state.release()
        await failDone
        await new Promise((resolve) => setTimeout(resolve, 30))
        assert(
          'AI activity write failure is surfaced to the originating request',
          failRes.statusCode === 503 && failRes.body.includes('activity write failed'),
        )
        assert(
          'no untracked post-response AI activity write',
          failure.state.putEntered === 1 &&
            failure.state.putFinished === 0 &&
            failure.state.putSawResponse === false &&
            late.length === 0,
        )
      } finally {
        process.off('unhandledRejection', onLate)
      }
    },
  )
} finally {
  resetRuntimeStoreTestState()
  delete process.env.VERCEL
  delete process.env.BLOB_READ_WRITE_TOKEN
  delete process.env.BLOB_MEDIA_READ_WRITE_TOKEN
  for (const [key, file] of Object.entries(FILES)) {
    restoreFile(file, backups[key])
  }
  if (createdUploadDir && createdUploadDir.startsWith(uploadsDir) && existsSync(createdUploadDir)) {
    rmSync(createdUploadDir, { recursive: true, force: true })
  }
}

assert(
  'package.json includes @vercel/blob',
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies?.['@vercel/blob'],
)

console.log('')
console.log(`Passed ${passed}, failed ${failed}`)
if (failed > 0) process.exit(1)
