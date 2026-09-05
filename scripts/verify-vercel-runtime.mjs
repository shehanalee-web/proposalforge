import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dispatchProductionApi } from '../server/productionApi.js'
import { normalizeApiUrl } from '../server/dataPaths.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
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

function mockReq(url, method = 'GET') {
  const req = new EventEmitter()
  req.url = url
  req.method = method
  req.headers = {}
  req.destroy = () => {}
  queueMicrotask(() => req.emit('end'))
  return req
}

function mockRes() {
  const res = {
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
  return res
}

async function call(url, method = 'GET') {
  const req = mockReq(url, method)
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

assert(
  'normalizeApiUrl preserves /api contract',
  normalizeApiUrl('/api/followups?x=1') === '/api/followups?x=1' &&
    normalizeApiUrl('/followups') === '/api/followups' &&
    normalizeApiUrl('/api?__pf=followups/capabilities&companyId=company-studio') ===
      '/api/followups/capabilities?companyId=company-studio',
)

const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const spa = vercel.rewrites?.find((rule) => rule.destination === '/index.html')
const apiRewrite = vercel.rewrites?.find((rule) => String(rule.destination || '').includes('__pf'))
assert(
  'SPA rewrite excludes /api',
  spa?.source?.includes('?!api') && spa?.destination === '/index.html',
)
assert(
  'API rewrite preserves nested /api paths',
  apiRewrite?.source === '/api/(.*)' && apiRewrite?.destination === '/api?__pf=$1',
)

const capabilities = await call('/api/followups/capabilities')
const rewrittenCapabilities = await call('/api?__pf=followups/capabilities')
assert(
  'GET /api/followups/capabilities',
  capabilities.status === 200 && capabilities.json?.capabilities?.automatedReminders === true,
)
assert(
  'Vercel nested API rewrite',
  rewrittenCapabilities.status === 200 &&
    rewrittenCapabilities.json?.capabilities?.automatedReminders === true,
)

const followups = await call('/api/followups?companyId=company-studio&actorId=user-studio-sarah')
assert(
  'GET /api/followups',
  followups.status === 200 &&
    Array.isArray(followups.json?.followups) &&
    typeof followups.json?.open === 'number',
)

const proposals = await call('/api/proposals')
assert(
  'GET /api/proposals',
  proposals.status === 200 && Array.isArray(proposals.json?.records),
)

const workflow = await call('/api/workflow/capabilities')
assert(
  'GET /api/workflow/capabilities',
  workflow.status === 200 && workflow.json?.capabilities?.automatedReminders === true,
)

const workflowOverview = await call(
  '/api/workflow/overview?companyId=company-studio&actorId=user-studio-sarah',
)
assert('GET /api/workflow/overview', workflowOverview.status === 200 && workflowOverview.json)

const portal = await call('/api/proposal-portal/capabilities')
assert('GET /api/proposal-portal/capabilities', portal.status === 200 && portal.json?.capabilities)

const publicFollowup = await call('/api/followups/public')
assert(
  'Public follow-up API denied',
  publicFollowup.status === 403 &&
    String(publicFollowup.json?.message || '').includes('studio-only'),
)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
