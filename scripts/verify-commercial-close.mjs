/**
 * H15.1 Commercial Close Domain verification.
 *
 * Never writes data/proposals.json.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import {
  COMMERCIAL_MODULE,
  makeAddonLine,
  makeCommercialLine,
  makeCommercialModule,
} from '../src/models/commercial.js'
import { OFFER_KIND, addOffer, makeOfferGroups } from '../src/models/offer.js'
import { makeProposal, PROPOSAL_STATUS } from '../src/models/proposal.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import {
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  applyLivingDecisions,
  captureLivingAcceptanceDecision,
  configureLivingResolvers,
  getOrCreateLivingSession,
  publishLivingProposal,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
  allLivingEngagementEvents,
  makeLivingSession,
} from '../src/living/index.js'
import {
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_EVENT,
  COMMERCIAL_CLOSE_STATUS,
  createCommercialCloseFromAcceptedDecision,
  getClientCommercialCloseSummary,
  getCommercialCloseForProposal,
  presentClientCommercialClose,
  resetCommercialCloseStore,
  allCommercialCloses,
  studioCanCreateCommercialClose,
  studioCanViewCommercialClose,
} from '../src/commercialClose/index.js'
import { resolveWorkflowActor } from '../src/workflow/actors.js'
import {
  FOLLOWUP_CAPABILITIES,
} from '../src/followup/types.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import { INTERACTION_CAPABILITIES } from '../src/interactions/types.js'
import { PORTAL_CAPABILITIES } from '../src/portal/types.js'
import { WORKFLOW_CAPABILITIES } from '../src/workflow/types.js'

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

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

function runSuite(file) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  }
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

const studio = DEFAULT_COMPANY_ID
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
const owner = resolveWorkflowActor('user-studio-sarah')
const editor = resolveWorkflowActor('user-studio-alex')
const reviewer = resolveWorkflowActor('user-studio-david')
const otherOwner = resolveWorkflowActor('user-harborline-lee')

const modules = [
  makeCommercialModule({
    id: 'mod-table',
    type: COMMERCIAL_MODULE.TABLE,
    items: [
      makeCommercialLine({
        id: 'line-web',
        description: 'Website',
        quantity: 1,
        unitPrice: 24000,
      }),
    ],
  }),
  makeCommercialModule({
    id: 'mod-addons',
    type: COMMERCIAL_MODULE.ADDONS,
    items: [
      makeAddonLine({
        id: 'line-host',
        description: 'Hosting',
        quantity: 1,
        unitPrice: 1200,
        included: false,
      }),
    ],
  }),
]

let offers = makeOfferGroups()
offers = addOffer(offers, OFFER_KIND.PACKAGE, {
  id: 'pkg-premium',
  title: 'Premium',
  amount: 32000,
})
offers = addOffer(offers, OFFER_KIND.ADDON, {
  id: 'oadd-walk',
  title: '3D Walkthrough',
  amount: 1500,
})

function buildProposal(overrides = {}) {
  const proposal = makeProposal({
    id: 'prop-cclose-a',
    title: 'Commercial close proposal',
    clientName: 'Jordan Lee',
    company: 'Harborline',
    status: PROPOSAL_STATUS.SENT,
    shareToken: 'share-cclose-a',
    currency: 'USD',
    amount: 24000,
    currentVersion: 3,
    blocks: [
      makeBlock({
        id: 'blk-cover',
        type: BLOCK_TYPE.COVER,
        data: { heading: 'Commercial close proposal' },
      }),
      makeBlock({
        id: 'blk-pricing',
        type: BLOCK_TYPE.PRICING,
        data: { modules, notes: '', offers },
      }),
    ],
    ...overrides,
  })
  proposal.companyId = overrides.companyId ?? studio
  return proposal
}

const proposal = buildProposal()
const catalog = new Map([[proposal.shareToken, proposal]])

configureLivingResolvers({
  getProposalByShareToken(token) {
    return catalog.get(String(token ?? '').trim()) ?? null
  },
  getProposalById(proposalId, companyId) {
    const found = [...catalog.values()].find((item) => item.id === proposalId) ?? null
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (companyId && ownedBy !== companyId) return null
    return found
  },
})

resetLivingStore([])
resetLivingEventStore([])
resetLivingPublicationStore([])
resetCommercialCloseStore([])

const proposalsBefore = proposalsSnapshot()
const proposalBlocksBefore = JSON.stringify(proposal.blocks)

assert(
  '1. commercialCloseDomain capability is honest',
  COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.digitalSignature === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentProcessing === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.thirdPartyIntegrations === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors === false &&
    COMMERCIAL_CLOSE_EVENT.OPENED === 'close.opened' &&
    LIVING_EVENT.CLOSE_OPENED === 'close.opened',
)

assert(
  '1b. vendor flags remain false across domains',
  PORTAL_CAPABILITIES.digitalSignature === false &&
    PORTAL_CAPABILITIES.paymentProcessing === false &&
    INTERACTION_CAPABILITIES.digitalSignature === false &&
    INTERACTION_CAPABILITIES.paymentProcessing === false &&
    FOLLOWUP_CAPABILITIES.digitalSignature === false &&
    FOLLOWUP_CAPABILITIES.paymentProcessing === false &&
    FORGE_CAPABILITIES.digitalSignature === false &&
    FORGE_CAPABILITIES.paymentProcessing === false &&
    FORGE_CAPABILITIES.thirdPartyIntegrations === false &&
    WORKFLOW_CAPABILITIES.digitalSignature === false &&
    LIVING_CAPABILITIES.rive === false,
)

assert(
  '1c. permissions: owner create, editor view-only',
  studioCanCreateCommercialClose(owner) === true &&
    studioCanViewCommercialClose(owner) === true &&
    studioCanCreateCommercialClose(editor) === false &&
    studioCanViewCommercialClose(editor) === true &&
    studioCanViewCommercialClose(reviewer) === true &&
    studioCanCreateCommercialClose(reviewer) === false,
)

// Prepare locked decision
const published = publishLivingProposal({
  proposalId: proposal.id,
  companyId: studio,
  publishedBy: owner.id,
})
applyLivingDecisions({
  shareToken: proposal.shareToken,
  selectedPackageId: 'pkg-premium',
  selectedAddonIds: ['oadd-walk'],
})
const acceptedAt = '2026-09-07T12:00:00.000Z'
const captured = captureLivingAcceptanceDecision({
  shareToken: proposal.shareToken,
  acceptedAt,
})
proposal.status = PROPOSAL_STATUS.ACCEPTED
proposal.acceptedAt = acceptedAt

assert(
  'prep. decision locked with totals',
  captured.session.decisionLocked === true &&
    captured.decisionSnapshot.selectedTotal === 33500 &&
    captured.decisionSnapshot.currency === 'USD',
)

// 2 — create from locked decision
const created = createCommercialCloseFromAcceptedDecision({
  companyId: studio,
  proposalId: proposal.id,
  actor: owner,
})
assert(
  '2. create close from locked accepted decision',
  created.created === true &&
    created.close?.id?.startsWith('cclose-') &&
    created.close.status === COMMERCIAL_CLOSE_STATUS.OPEN,
)

assert(
  '8. close starts in open state',
  created.close.status === 'open',
)

assert(
  '9. immutable decision information copied',
  created.close.decision.decisionLocked === true &&
    created.close.decision.sessionId === captured.session.id &&
    created.close.decision.proposalId === proposal.id &&
    created.close.decision.companyId === studio &&
    created.close.sessionId === captured.session.id,
)

assert(
  '10. amount matches decision snapshot',
  created.close.decision.selectedTotal === captured.decisionSnapshot.selectedTotal &&
    created.close.decision.selectedSubtotal === captured.decisionSnapshot.selectedSubtotal,
)

assert(
  '11. currency matches decision snapshot',
  created.close.decision.currency === captured.decisionSnapshot.currency,
)

assert(
  '12. publication identity matches decision snapshot',
  created.close.decision.publicationId === captured.decisionSnapshot.publicationId &&
    created.close.decision.snapshotNumber === captured.decisionSnapshot.snapshotNumber &&
    created.close.decision.publicationId === published.publication.id,
)

assert(
  '13. proposalVersion matches decision snapshot',
  created.close.decision.proposalVersion === captured.decisionSnapshot.proposalVersion,
)

assert(
  '9b. package and add-ons retained',
  created.close.decision.selectedPackageId === 'pkg-premium' &&
    created.close.decision.selectedAddonIds.includes('oadd-walk') &&
    created.close.decision.acceptedAt === acceptedAt,
)

const openedEvents = allLivingEngagementEvents().filter(
  (event) => event.type === LIVING_EVENT.CLOSE_OPENED,
)
assert(
  'audit. close.opened recorded once',
  openedEvents.length === 1 &&
    openedEvents[0].metadata.closeId === created.close.id,
)

// 3 — reject unlocked
resetCommercialCloseStore([])
resetLivingStore([])
resetLivingEventStore([])
resetLivingPublicationStore([])
publishLivingProposal({
  proposalId: proposal.id,
  companyId: studio,
  publishedBy: owner.id,
})
getOrCreateLivingSession(proposal.shareToken)
applyLivingDecisions({
  shareToken: proposal.shareToken,
  selectedPackageId: 'pkg-premium',
})
let unlockedRejected = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: proposal.id,
    actor: owner,
  })
} catch (error) {
  unlockedRejected = error instanceof ValidationError
}
assert('3. reject unlocked session', unlockedRejected)

// 4 — reject missing snapshot (locked flag without snapshot)
resetCommercialCloseStore([])
resetLivingStore([
  makeLivingSession({
    id: 'lsess-nosnap',
    proposalId: proposal.id,
    shareToken: proposal.shareToken,
    companyId: studio,
    decisionLocked: true,
    decisionSnapshot: null,
    acceptedAt,
  }),
])
let missingSnapRejected = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: proposal.id,
    actor: owner,
  })
} catch (error) {
  missingSnapRejected = error instanceof ValidationError
}
assert('4. reject missing decision snapshot', missingSnapRejected)

// Restore good locked decision for remaining tests
resetCommercialCloseStore([])
resetLivingStore([])
resetLivingEventStore([])
resetLivingPublicationStore([])
publishLivingProposal({
  proposalId: proposal.id,
  companyId: studio,
  publishedBy: owner.id,
})
applyLivingDecisions({
  shareToken: proposal.shareToken,
  selectedPackageId: 'pkg-premium',
  selectedAddonIds: ['oadd-walk'],
})
captureLivingAcceptanceDecision({
  shareToken: proposal.shareToken,
  acceptedAt,
})
proposal.status = PROPOSAL_STATUS.ACCEPTED

// 5 — reject missing proposal
let missingProposal = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: 'prop-missing',
    actor: owner,
  })
} catch (error) {
  missingProposal = error instanceof NotFoundError
}
assert('5. reject missing proposal', missingProposal)

// 6 — reject cross-company
let crossCompany = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: otherCompany,
    proposalId: proposal.id,
    actor: otherOwner,
  })
} catch (error) {
  crossCompany =
    error instanceof NotFoundError || error instanceof ForbiddenError
}
assert('6. reject cross-company access', crossCompany)

let crossActor = false
try {
  getCommercialCloseForProposal({
    companyId: studio,
    proposalId: proposal.id,
    actor: otherOwner,
  })
} catch (error) {
  crossActor = error instanceof ForbiddenError
}
assert('6b. reject cross-company actor view', crossActor)

// 7 — reject mismatched proposal/session
const foreignSession = makeLivingSession({
  id: 'lsess-foreign',
  proposalId: 'prop-other',
  shareToken: 'share-other',
  companyId: studio,
  decisionLocked: true,
  acceptedAt,
  decisionSnapshot: {
    ...captured.decisionSnapshot,
    acceptedAt,
  },
})
resetLivingStore([
  ...[getOrCreateLivingSession(proposal.shareToken)].filter(Boolean),
])
// Force insert foreign + locked session for this proposal path via create with sessionId
const goodSession = getOrCreateLivingSession(proposal.shareToken)
let mismatchRejected = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: proposal.id,
    actor: owner,
    sessionId: foreignSession.id,
  })
} catch (error) {
  mismatchRejected = error instanceof ValidationError || error instanceof NotFoundError
}
// foreign session is not in store — ValidationError "Living session not found"
assert('7. reject mismatched / unknown session id', mismatchRejected)

// Also assert session/proposal mismatch when session exists but wrong proposal
resetLivingStore([
  {
    ...goodSession,
    decisionLocked: true,
    decisionSnapshot: captured.decisionSnapshot,
    acceptedAt,
  },
  foreignSession,
])
let mismatchProposal = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: proposal.id,
    actor: owner,
    sessionId: foreignSession.id,
  })
} catch (error) {
  mismatchProposal = error instanceof ValidationError
}
assert('7b. reject session for different proposal', mismatchProposal)

// Restore and create for idempotency
resetCommercialCloseStore([])
resetLivingStore([])
resetLivingEventStore([])
resetLivingPublicationStore([])
const pub2 = publishLivingProposal({
  proposalId: proposal.id,
  companyId: studio,
  publishedBy: owner.id,
})
applyLivingDecisions({
  shareToken: proposal.shareToken,
  selectedPackageId: 'pkg-premium',
  selectedAddonIds: ['oadd-walk'],
})
const locked = captureLivingAcceptanceDecision({
  shareToken: proposal.shareToken,
  acceptedAt,
})
proposal.status = PROPOSAL_STATUS.ACCEPTED

const first = createCommercialCloseFromAcceptedDecision({
  companyId: studio,
  proposalId: proposal.id,
  actor: owner,
})
const second = createCommercialCloseFromAcceptedDecision({
  companyId: studio,
  proposalId: proposal.id,
  actor: owner,
})
assert(
  '14. duplicate create is idempotent',
  first.created === true &&
    second.created === false &&
    second.close.id === first.close.id &&
    allCommercialCloses().length === 1,
)

assert(
  '15. no proposal mutation',
  JSON.stringify(proposal.blocks) === proposalBlocksBefore &&
    proposal.shareToken === 'share-cclose-a',
)

assert('16. data/proposals.json untouched', proposalsSnapshot() === proposalsBefore)

const loaded = getCommercialCloseForProposal({
  companyId: studio,
  proposalId: proposal.id,
  actor: owner,
})
assert(
  'get. studio can load close',
  loaded.close?.id === first.close.id &&
    loaded.close.decision.publicationId === pub2.publication.id,
)

let editorCreateDenied = false
try {
  createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: proposal.id,
    actor: editor,
  })
} catch (error) {
  // Idempotent path returns existing before permission? No — permission checked first.
  // Actually create checks permission first, then finds existing — wait, for editor:
  // studioCanCreateCommercialClose(editor) is false, so ForbiddenError before idempotent return.
  editorCreateDenied = error instanceof ForbiddenError
}
assert('perm. editor cannot create', editorCreateDenied)

const editorView = getCommercialCloseForProposal({
  companyId: studio,
  proposalId: proposal.id,
  actor: editor,
})
assert('perm. editor can view', editorView.close?.id === first.close.id)

const clientView = getClientCommercialCloseSummary({
  shareToken: proposal.shareToken,
})
assert(
  'client. projection is read-only and safe',
  clientView.close?.status === 'open' &&
    clientView.close.decision.selectedTotal === 33500 &&
    !('openedByActorId' in (clientView.close || {})) &&
    !('companyId' in (clientView.close || {})) &&
    !('sessionId' in (clientView.close || {})) &&
    !('followups' in (clientView.close || {})),
)

const clientPresent = presentClientCommercialClose(first.close)
assert(
  'client. present strips internals',
  clientPresent &&
    !('openedByActorId' in clientPresent) &&
    !('sourceVersionId' in (clientPresent.decision || {})),
)

assert(
  'plugin. persists commercial-closes.json and never proposals',
  sourceOf('server', 'commercialClosePlugin.js').includes('commercial-closes.json') &&
    sourceOf('server', 'commercialClosePlugin.js').includes(
      'Never writes `data/proposals.json`',
    ) &&
    sourceOf('server', 'productionApi.js').includes('commercialClosePlugin') &&
    sourceOf('vite.config.js').includes('commercialClosePlugin'),
)

assert(
  'decision. not recomputed from live edits',
  (() => {
    // Mutate live catalog amounts — close must keep frozen totals.
    offers = addOffer(offers, OFFER_KIND.PACKAGE, {
      id: 'pkg-premium',
      title: 'Premium',
      amount: 99999,
    })
    proposal.blocks = [
      makeBlock({
        id: 'blk-cover',
        type: BLOCK_TYPE.COVER,
        data: { heading: 'Changed' },
      }),
      makeBlock({
        id: 'blk-pricing',
        type: BLOCK_TYPE.PRICING,
        data: { modules, notes: '', offers },
      }),
    ]
    const again = getCommercialCloseForProposal({
      companyId: studio,
      proposalId: proposal.id,
      actor: owner,
    })
    return again.close.decision.selectedTotal === locked.decisionSnapshot.selectedTotal
  })(),
)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-living-close-binding.mjs',
  'verify-living.mjs',
  'verify-living-session.mjs',
  'verify-living-events.mjs',
  'verify-living-publication.mjs',
  'verify-living-interactions.mjs',
  'verify-living-commercial-selection.mjs',
  'verify-forge-actions.mjs',
  'verify-forge-rive.mjs',
  'verify-followup.mjs',
  'verify-interactions.mjs',
  'verify-portal.mjs',
  'verify-workflow.mjs',
  'verify-offer-authoring.mjs',
]

for (const file of suites) {
  const result = runSuite(file)
  assert(`${file} still passes`, result.ok, result.ok ? '' : result.output.slice(-1200))
}

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`verify-commercial-close: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
