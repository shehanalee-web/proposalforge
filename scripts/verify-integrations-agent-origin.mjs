/**
 * H16.15 Slice 15.1 — Agent-origin request contract.
 * Source/contract checks only. Does not nest H16.14 verifiers.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ValidationError } from '../src/services/errors.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  ACTIVITY_ACTOR_KIND,
  ACTIVITY_NATIVE_ORIGIN,
  ACTIVITY_ORIGIN,
  ACTIVITY_ORIGINS,
  makeAgentOriginActivityRequest,
  makeStudioPrincipal,
} from '../src/integrations/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const agentOriginSource = readFileSync(
  join(root, 'src/integrations/activities/agentOrigin.js'),
  'utf8',
)
const authoringSource = readFileSync(
  join(root, 'src/integrations/activities/authoring.js'),
  'utf8',
)

let passed = 0
let failed = 0

function assert(name, condition) {
  if (condition) {
    passed += 1
    console.log(`PASS  ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL  ${name}`)
}

function threw(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

assert('1. ACTIVITY_ORIGIN.AGENT already exists', ACTIVITY_ORIGIN.AGENT === 'agent')

assert(
  '2. ACTIVITY_NATIVE_ORIGIN permits agent',
  ACTIVITY_NATIVE_ORIGIN.AGENT === ACTIVITY_ORIGIN.AGENT,
)

const request = makeAgentOriginActivityRequest({
  origin: ACTIVITY_ORIGIN.AGENT,
  actor: { id: 'agent-forge', kind: ACTIVITY_ACTOR_KIND.AGENT, displayName: 'Forge' },
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '3. agent-origin request is origin AGENT, actor.kind AGENT, tenant companyId',
  request.origin === ACTIVITY_ORIGIN.AGENT &&
    request.actor.kind === ACTIVITY_ACTOR_KIND.AGENT &&
    request.companyId === DEFAULT_COMPANY_ID &&
    request.companyId === 'company-studio',
)

const asPrincipal = threw(() =>
  makeStudioPrincipal({
    id: request.actor.id,
    kind: request.actor.kind,
    displayName: request.actor.displayName,
    companyId: request.companyId,
  }),
)
assert(
  '4. agent cannot be used as a Studio Principal',
  asPrincipal instanceof ValidationError && asPrincipal.errors?.[0]?.field === 'kind',
)

assert(
  '5. createStudioActivity still forces USER when given an AGENT payload',
  authoringSource.includes('origin: _payloadOrigin') &&
    authoringSource.includes('origin: ACTIVITY_ORIGIN.USER') &&
    !authoringSource.includes('makeAgentOriginActivityRequest'),
)

assert(
  '6. no new origin enum was introduced',
  ACTIVITY_ORIGINS.join(',') === 'user,system,agent,integration' &&
    agentOriginSource.includes('ACTIVITY_ORIGIN.AGENT') &&
    !/ORIGIN\s*=\s*Object\.freeze\(\s*\{/.test(agentOriginSource),
)

assert(
  '7. no agent HTTP/auth/persistence implementation was introduced',
  !existsSync(join(root, 'server/integrationsAgentOriginPlugin.js')) &&
    !agentOriginSource.includes('getActivityRepository') &&
    !agentOriginSource.includes('emitNativeActivityCreated') &&
    !/\/api\//.test(agentOriginSource) &&
    !/jsonwebtoken|jose|passport|cookie-parser/.test(agentOriginSource),
)

console.log('')
console.log(`H16.15 agent-origin contract checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
