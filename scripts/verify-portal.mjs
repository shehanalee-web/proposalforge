import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeProposal } from '../src/models/proposal.js'
import { analyzeProposalHealth } from '../src/insights/index.js'
import { analyzeProposal } from '../src/intelligence/index.js'
import { analyzeConsistency } from '../src/consistency/index.js'
import { analyzeProposalCoaching } from '../src/coach/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import { getWorkflow, resetWorkflowStore } from '../src/workflow/index.js'
import { WORKFLOW_STATUS } from '../src/workflow/types.js'
import { getWorkflowActor } from '../src/workflow/actors.js'
import {
  allPortalRecords,
  assertClientSafeView,
  assertPortalTransition,
  configurePortalResolvers,
  createPortal,
  DEFAULT_COMPANY_ID,
  getClientPortalView,
  getPortal,
  getPortalActivityForProposal,
  INTERNAL_KEYS,
  PORTAL_ACCESS_REASON,
  PORTAL_CAPABILITIES,
  PORTAL_EVENT,
  PORTAL_ISOLATION_COMPANY_ID,
  PORTAL_STATUS,
  presentClientPortalView,
  publishPortal,
  replacePortalRecords,
  resetPortalResolvers,
  resetPortalStore,
  revokePortal,
  UNRESOLVED_FACT,
} from '../src/portal/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

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

function throws(fn, Type) {
  try {
    fn()
    return false
  } catch (error) {
    return Type ? error instanceof Type : true
  }
}

function caught(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

const studio = DEFAULT_COMPANY_ID
const other = PORTAL_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor('user-studio-sarah')
const sam = getWorkflowActor('user-studio-sam')
const lee = getWorkflowActor('user-harborline-lee')

const proposals = new Map()
const workflowStatus = new Map()

function seedProposal(id, input = {}, companyId = studio) {
  const proposal = makeProposal({
    id,
    title: input.title ?? 'Harborline website',
    clientName: input.clientName ?? 'Jordan Lee',
    company: input.company ?? 'Harborline',
    summary: input.summary ?? 'A website rebuild for Harborline.',
    amount: input.amount ?? 24000,
    currency: 'USD',
    notes: 'INTERNAL ONLY — do not show',
    sections: input.sections ?? [
      { id: 's1', heading: 'Approach', body: 'Discovery, design, and build.' },
      { id: 's2', heading: 'Exclusions', body: 'Paid ads are excluded.' },
      { id: 's3', heading: 'Warranty', body: UNRESOLVED_FACT },
    ],
    items: input.items ?? [{ id: 'i1', description: 'Website', amount: 24000 }],
    ...input,
  })
  proposal.companyId = companyId
  if (input.generation) proposal.generation = input.generation
  if (input.blocks) proposal.blocks = input.blocks
  proposals.set(id, proposal)
  return proposal
}

function keyOf(companyId, proposalId) {
  return `${companyId}:${proposalId}`
}

configurePortalResolvers({
  getProposal(proposalId, companyId) {
    const found = proposals.get(proposalId)
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
  getWorkflowStatus(companyId, proposalId) {
    return workflowStatus.get(keyOf(companyId, proposalId)) ?? WORKFLOW_STATUS.DRAFT
  },
})

resetPortalStore()
resetWorkflowStore()
seedProposal('prop-portal-1')
workflowStatus.set(keyOf(studio, 'prop-portal-1'), WORKFLOW_STATUS.READY_TO_SEND)
getWorkflow({ companyId: studio, proposalId: 'prop-portal-1', actor: sarah })

const created = createPortal({
  companyId: studio,
  proposalId: 'prop-portal-1',
  actor: sarah,
})
assert(
  'Test 1 — Portal creation',
  created.status === PORTAL_STATUS.DRAFT &&
    created.proposalId === 'prop-portal-1' &&
    created.companyId === studio,
)

const published = publishPortal({
  companyId: studio,
  proposalId: 'prop-portal-1',
  actor: sarah,
})
assert(
  'Test 2 — Publish flow',
  published.portal.status === PORTAL_STATUS.PUBLISHED &&
    published.publicPath === `/portal/${published.portal.id}` &&
    published.view.kind === 'client_portal_view',
)

const revoked = revokePortal({
  companyId: studio,
  proposalId: 'prop-portal-1',
  actor: sarah,
})
assert('Test 3 — Revoke flow', revoked.status === PORTAL_STATUS.REVOKED)

seedProposal('prop-portal-expire', { title: 'Expiry demo' })
workflowStatus.set(keyOf(studio, 'prop-portal-expire'), WORKFLOW_STATUS.READY_TO_SEND)
const expiredPublish = publishPortal({
  companyId: studio,
  proposalId: 'prop-portal-expire',
  actor: sarah,
  expiresAt: '2020-01-01T00:00:00.000Z',
})
assert(
  'Test 4 — Expiry',
  expiredPublish.portal.status === PORTAL_STATUS.EXPIRED &&
    throws(
      () => getClientPortalView({ portalId: expiredPublish.portal.id }),
      ForbiddenError,
    ),
)

assert(
  'Test 5 — Invalid transitions',
  throws(() => assertPortalTransition(PORTAL_STATUS.DRAFT, PORTAL_STATUS.EXPIRED), ValidationError) &&
    throws(() => assertPortalTransition(PORTAL_STATUS.REVOKED, PORTAL_STATUS.EXPIRED), ValidationError),
)

seedProposal('prop-portal-invalid')
workflowStatus.set(keyOf(studio, 'prop-portal-invalid'), WORKFLOW_STATUS.READY_TO_SEND)
createPortal({ companyId: studio, proposalId: 'prop-portal-invalid', actor: sarah })
assert(
  'Test 5b — Invalid DRAFT revoke',
  throws(
    () =>
      revokePortal({
        companyId: studio,
        proposalId: 'prop-portal-invalid',
        actor: sarah,
      }),
    ValidationError,
  ),
)

seedProposal('prop-harbor', { title: 'Harbor only' }, other)
workflowStatus.set(keyOf(other, 'prop-harbor'), WORKFLOW_STATUS.READY_TO_SEND)
publishPortal({ companyId: other, proposalId: 'prop-harbor', actor: lee })
assert(
  'Test 6 — Company isolation',
  throws(
    () => getPortal({ companyId: other, proposalId: 'prop-portal-1', actor: lee }),
    ForbiddenError,
  ) &&
    throws(
      () => getPortal({ companyId: studio, proposalId: 'prop-harbor', actor: sarah }),
      ForbiddenError,
    ) &&
    throws(
      () =>
        publishPortal({
          companyId: studio,
          proposalId: 'prop-harbor',
          actor: sarah,
        }),
      ForbiddenError,
    ),
)

const unknown = caught(() => getClientPortalView({ portalId: 'portal-does-not-exist' }))
assert(
  'Test 7 — Unknown portal access',
  unknown instanceof NotFoundError &&
    unknown.reason === PORTAL_ACCESS_REASON.UNKNOWN,
)

const revokedAccess = caught(() => getClientPortalView({ portalId: published.portal.id }))
assert(
  'Test 8 — Revoked portal access',
  revokedAccess instanceof ForbiddenError &&
    revokedAccess.reason === PORTAL_ACCESS_REASON.REVOKED,
)

const expiredAccess = caught(() => getClientPortalView({ portalId: expiredPublish.portal.id }))
assert(
  'Test 9 — Expired portal access',
  expiredAccess instanceof ForbiddenError &&
    expiredAccess.reason === PORTAL_ACCESS_REASON.EXPIRED,
)

seedProposal('prop-portal-view', {
  title: 'Resolved proposal',
  summary: 'Visible summary',
  notes: 'secret notes',
  generation: { provider: 'openai', prompt: 'SYSTEM PROMPT', apiKey: 'sk-test' },
})
workflowStatus.set(keyOf(studio, 'prop-portal-view'), WORKFLOW_STATUS.READY_TO_SEND)
const viewed = publishPortal({
  companyId: studio,
  proposalId: 'prop-portal-view',
  actor: sarah,
})
const client = getClientPortalView({ portalId: viewed.portal.id })
assert(
  'Test 10 — Correct proposal resolution',
  client.view.proposalId === 'prop-portal-view' &&
    client.view.title === 'Resolved proposal' &&
    client.view.summary === 'Visible summary',
)

const unresolvedProposal = seedProposal('prop-portal-unresolved', {
  title: 'Open items',
  summary: UNRESOLVED_FACT,
  amount: 0,
  items: [{ id: 'i2', description: UNRESOLVED_FACT, amount: 0 }],
  sections: [
    { id: 's1', heading: 'Deliverables', body: UNRESOLVED_FACT },
    { id: 's2', heading: 'Timeline', body: UNRESOLVED_FACT },
    { id: 's3', heading: 'Exclusions', body: UNRESOLVED_FACT },
    { id: 's4', heading: 'Warranty', body: UNRESOLVED_FACT },
    { id: 's5', heading: 'Pricing', body: UNRESOLVED_FACT },
  ],
})
workflowStatus.set(keyOf(studio, 'prop-portal-unresolved'), WORKFLOW_STATUS.READY_TO_SEND)
const unresolvedPublish = publishPortal({
  companyId: studio,
  proposalId: 'prop-portal-unresolved',
  actor: sarah,
})
const unresolvedView = unresolvedPublish.view
assert(
  'Test 11 — Client-safe field projection',
  unresolvedView.kind === 'client_portal_view' &&
    assertClientSafeView(unresolvedView) &&
    unresolvedView.title === 'Open items' &&
    Array.isArray(unresolvedView.sections),
)

const viewJson = JSON.stringify(client.view)
assert(
  'Test 12 — Internal fields are excluded',
  !viewJson.includes('secret notes') &&
    !viewJson.includes('SYSTEM PROMPT') &&
    !viewJson.includes('sk-test') &&
    !viewJson.includes('shareToken') &&
    !viewJson.includes('generation') &&
    INTERNAL_KEYS.every((key) => !(key in client.view)),
)

assert(
  'Test 13 — Unresolved To be confirmed values are preserved',
  unresolvedView.summary === UNRESOLVED_FACT &&
    unresolvedView.warranty === UNRESOLVED_FACT &&
    unresolvedView.exclusions === UNRESOLVED_FACT &&
    unresolvedView.deliverables.some((item) => item.body === UNRESOLVED_FACT) &&
    unresolvedView.timeline.some((item) => item.body === UNRESOLVED_FACT) &&
    (unresolvedView.pricing?.notes === UNRESOLVED_FACT ||
      unresolvedView.pricing?.items.some((item) => item.description === UNRESOLVED_FACT)),
)

const publishedEvents = getPortalActivityForProposal({
  companyId: studio,
  proposalId: 'prop-portal-view',
  actor: sarah,
})
assert(
  'Test 14 — Publication activity',
  publishedEvents.some((item) => item.type === PORTAL_EVENT.PUBLISHED) &&
    publishedEvents.every((item) => item.proposalId === 'prop-portal-view'),
)

const revokedEvents = getPortalActivityForProposal({
  companyId: studio,
  proposalId: 'prop-portal-1',
  actor: sarah,
})
assert(
  'Test 15 — Revocation activity',
  revokedEvents.some((item) => item.type === PORTAL_EVENT.REVOKED) &&
    revokedEvents.some((item) => item.type === PORTAL_EVENT.PUBLISHED),
)

const snapshot = allPortalRecords()
resetPortalStore([])
replacePortalRecords(snapshot)
const reloaded = getPortal({
  companyId: studio,
  proposalId: 'prop-portal-view',
  actor: sarah,
  create: false,
})
assert(
  'Test 16 — Persistence',
  reloaded.status === PORTAL_STATUS.PUBLISHED &&
    reloaded.proposalId === 'prop-portal-view',
)

const activityJson = JSON.stringify(publishedEvents)
assert(
  'Test 17 — No secret leakage',
  !activityJson.toLowerCase().includes('sk-') &&
    !activityJson.includes('SYSTEM PROMPT') &&
    !activityJson.includes('apiKey') &&
    !JSON.stringify(reloaded).includes('openai') &&
    PORTAL_CAPABILITIES.emailDelivery === false &&
    PORTAL_CAPABILITIES.whatsapp === false &&
    PORTAL_CAPABILITIES.thirdPartyAuth === false &&
    PORTAL_CAPABILITIES.unguessableUrlIsAuth === false,
)

assert(
  'Test 18 — No proposal duplication',
  !('title' in reloaded && reloaded.title) &&
    !reloaded.sections &&
    !reloaded.blocks &&
    !reloaded.summary &&
    reloaded.proposalId === 'prop-portal-view',
)

assert(
  'Test 19 — Portal references the original proposalId',
  viewed.portal.proposalId === 'prop-portal-view' &&
    client.view.proposalId === 'prop-portal-view' &&
    unresolvedPublish.portal.proposalId === 'prop-portal-unresolved',
)

const workflowBefore = getWorkflow({
  companyId: studio,
  proposalId: 'prop-portal-1',
  actor: sarah,
  create: false,
})
assert(
  'Test 20 — Existing workflow remains unchanged',
  workflowBefore.status === WORKFLOW_STATUS.DRAFT,
)

seedProposal('prop-not-ready')
workflowStatus.set(keyOf(studio, 'prop-not-ready'), WORKFLOW_STATUS.APPROVED)
assert(
  'Test 20b — Ready to Send is required to publish',
  throws(
    () =>
      publishPortal({
        companyId: studio,
        proposalId: 'prop-not-ready',
        actor: sarah,
      }),
    ValidationError,
  ),
)

assert(
  'Test 21 — Viewer cannot publish',
  throws(
    () =>
      publishPortal({
        companyId: studio,
        proposalId: 'prop-portal-view',
        actor: sam,
      }),
    ForbiddenError,
  ),
)

const unpublished = caught(() =>
  getClientPortalView({
    portalId: createPortal({
      companyId: studio,
      proposalId: 'prop-not-ready',
      actor: sarah,
    }).id,
  }),
)
assert(
  'Test 22 — Unpublished portal is inaccessible',
  unpublished instanceof NotFoundError &&
    unpublished.reason === PORTAL_ACCESS_REASON.UNPUBLISHED,
)

const projected = presentClientPortalView(unresolvedProposal, unresolvedPublish.portal)
assert(
  'Test 23 — Projection does not spread the internal proposal',
  projected.kind === 'client_portal_view' &&
    projected.notes === undefined &&
    projected.generation === undefined &&
    projected.comments === undefined,
)

const health = analyzeProposalHealth(unresolvedProposal)
const intelligence = analyzeProposal({
  proposal: unresolvedProposal,
  diagnostics: health.suggestions,
  health,
})
const consistency = analyzeConsistency({
  proposal: unresolvedProposal,
  health,
  diagnostics: health.suggestions,
})
const coach = analyzeProposalCoaching({
  proposal: unresolvedProposal,
  health,
  diagnostics: health.suggestions,
  intelligence,
  consistency,
})
const domainSource = [
  'src/portal/repository.js',
  'src/portal/projection.js',
  'src/portal/transitions.js',
  'src/portal/permissions.js',
]
  .map((file) => sourceOf(file))
  .join('\n')
assert(
  'Test 24 — Existing analysis still runs',
  Number.isFinite(health.overallScore) &&
    intelligence &&
    Number.isFinite(consistency.score) &&
    Array.isArray(coach.items) &&
    !domainSource.includes("from '../insights") &&
    !domainSource.includes("from '../intelligence") &&
    !domainSource.includes("from '../coach") &&
    !domainSource.includes("from '../improve"),
)

const panelCss = sourceOf('src/components/ProposalPortal/PortalPanel.module.css')
const pageCss = sourceOf('src/pages/ProposalPortal/ProposalPortal.module.css')
assert(
  'Test 25 — Mobile overflow guards',
  panelCss.includes('overflow-x: hidden') &&
    panelCss.includes('100vw') &&
    panelCss.includes('390px') &&
    pageCss.includes('overflow-x: hidden') &&
    pageCss.includes('390px'),
)

const pluginSource = sourceOf('server/portalPlugin.js')
const repoSource = sourceOf('src/portal/repository.js')
assert(
  'Test 26 — No client messaging, payments, or proposals.json writes',
  !pluginSource.includes('whatsapp') &&
    !pluginSource.includes('nodemailer') &&
    !repoSource.includes('sendMail') &&
    pluginSource.includes('Never writes `data/proposals.json`') &&
    pluginSource.includes("join(dataDir, 'portal.json')") &&
    PORTAL_CAPABILITIES.digitalSignature === false &&
    PORTAL_CAPABILITIES.paymentProcessing === false &&
    PORTAL_CAPABILITIES.crm === false,
)

resetPortalResolvers()

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
