/**
 * H15.2 Commercial Close State Machine verification.
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
import { ForbiddenError, ValidationError } from '../src/services/errors.js'
import {
  LIVING_EVENT,
  applyLivingDecisions,
  captureLivingAcceptanceDecision,
  configureLivingResolvers,
  publishLivingProposal,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
  allLivingEngagementEvents,
} from '../src/living/index.js'
import {
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_STATUS,
  createCommercialCloseFromAcceptedDecision,
  clientCommercialCloseTransitionDenied,
  completeInternalCommercialClosePayment,
  completeInternalCommercialCloseSignature,
  getClientCommercialCloseSummary,
  presentClientCommercialClose,
  resetCommercialCloseStore,
  transitionCommercialClose,
  canTransitionCommercialCloseStatus,
  allowedCommercialCloseTransitions,
} from '../src/commercialClose/index.js'
import { resetFollowupStore } from '../src/followup/index.js'
import { FOLLOWUP_REASON, FOLLOWUP_CAPABILITIES } from '../src/followup/types.js'
import { isOpenFollowupStatus } from '../src/followup/statuses.js'
import { allFollowupRecords as listFollowups } from '../src/followup/store.js'
import { resolveWorkflowActor } from '../src/workflow/actors.js'
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

const proposal = makeProposal({
  id: 'prop-cclose-sm',
  title: 'Close state machine proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-cclose-sm',
  currency: 'USD',
  amount: 24000,
  currentVersion: 2,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close state machine' },
    }),
    makeBlock({
      id: 'blk-pricing',
      type: BLOCK_TYPE.PRICING,
      data: { modules, notes: '', offers },
    }),
  ],
})
proposal.companyId = studio

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

function resetAll() {
  resetLivingStore([])
  resetLivingEventStore([])
  resetLivingPublicationStore([])
  resetCommercialCloseStore([])
  resetFollowupStore([])
}

function openAcceptedClose() {
  resetAll()
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
  const acceptedAt = '2026-09-07T14:00:00.000Z'
  const captured = captureLivingAcceptanceDecision({
    shareToken: proposal.shareToken,
    acceptedAt,
  })
  proposal.status = PROPOSAL_STATUS.ACCEPTED
  proposal.acceptedAt = acceptedAt
  const created = createCommercialCloseFromAcceptedDecision({
    companyId: studio,
    proposalId: proposal.id,
    actor: owner,
  })
  return { created, captured, acceptedAt }
}

const proposalsBefore = proposalsSnapshot()
const blocksBefore = JSON.stringify(proposal.blocks)

assert(
  '0. state machine capability honest',
  COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialClosePaymentPath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.digitalSignature === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentProcessing === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.thirdPartyIntegrations === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.externalWebhooks === false &&
    PORTAL_CAPABILITIES.digitalSignature === false &&
    INTERACTION_CAPABILITIES.paymentProcessing === false &&
    FOLLOWUP_CAPABILITIES.crm === false &&
    FORGE_CAPABILITIES.thirdPartyIntegrations === false &&
    WORKFLOW_CAPABILITIES.digitalSignature === false,
)

assert(
  '0b. transition graph open -> signature_pending allowed',
  canTransitionCommercialCloseStatus('open', 'signature_pending') &&
    !canTransitionCommercialCloseStatus('open', 'paid') &&
    !canTransitionCommercialCloseStatus('closed', 'open'),
)

const { created, captured } = openAcceptedClose()
assert(
  '9. H15.1 create still works',
  created.created === true && created.close.status === COMMERCIAL_CLOSE_STATUS.OPEN,
)
assert(
  '10. immutable decision binding preserved at create',
  created.close.decision.selectedTotal === captured.decisionSnapshot.selectedTotal &&
    created.close.decision.currency === 'USD' &&
    created.close.decision.decisionLocked === true,
)

const eventsBeforeTransition = allLivingEngagementEvents().length

// 1 — valid transition
const toSig = transitionCommercialClose({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  to: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
})
assert(
  '1. open can transition to signature_pending',
  toSig.close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING &&
    toSig.transition.from === 'open' &&
    toSig.transition.to === 'signature_pending' &&
    toSig.transition.actorId === owner.id &&
    toSig.close.lastTransitionByActorId === owner.id &&
    toSig.close.statusHistory.length === 1,
)

assert(
  '6. event emitted for valid transition',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.CLOSE_STATE_CHANGED &&
      event.metadata.closeId === created.close.id &&
      event.metadata.to === 'signature_pending',
  ) && allLivingEngagementEvents().length > eventsBeforeTransition,
)

assert(
  '8. timestamps recorded',
  Boolean(toSig.close.lastTransitionAt) &&
    toSig.close.statusHistory[0].at === toSig.transition.at,
)

const sigFollowups = listFollowups().filter(
  (item) =>
    item.reason === FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING &&
    item.proposalId === proposal.id &&
    isOpenFollowupStatus(item.status),
)
assert(
  '15. H13 signature pending follow-up created',
  sigFollowups.length === 1 &&
    sigFollowups[0].sourceType === 'commercial_close' &&
    !sourceOf('src', 'commercialClose', 'signals.js').includes('emailDelivery') &&
    !sourceOf('src', 'commercialClose', 'signals.js').includes('whatsapp'),
)

// 2 — invalid transition
let invalidRejected = false
const eventsBeforeInvalid = allLivingEngagementEvents().length
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.PAID,
  })
} catch (error) {
  invalidRejected = error instanceof ValidationError
}
assert('2. invalid transition rejected', invalidRejected)
assert(
  '7. no event for rejected transition',
  allLivingEngagementEvents().length === eventsBeforeInvalid,
)

// 3 — wrong current state (try open -> signature again from signature_pending)
let wrongStateRejected = false
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.OPEN,
  })
} catch (error) {
  wrongStateRejected = error instanceof ValidationError
}
assert('3. transition from wrong current state rejected', wrongStateRejected)

// 4 — permission
let editorDenied = false
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: editor,
    to: COMMERCIAL_CLOSE_STATUS.SIGNED,
  })
} catch (error) {
  editorDenied = error instanceof ForbiddenError
}
assert('4. permission enforcement', editorDenied)

// 5 — company isolation
let crossDenied = false
try {
  transitionCommercialClose({
    companyId: otherCompany,
    closeId: created.close.id,
    actor: otherOwner,
    to: COMMERCIAL_CLOSE_STATUS.SIGNED,
  })
} catch (error) {
  crossDenied =
    error instanceof ForbiddenError || error?.name === 'NotFoundError'
}
assert('5. company isolation', crossDenied)

// Continue happy path and preserve decision
const decisionSnapshot = { ...toSig.close.decision }

// H15.3: signed requires evidence — bare transition must fail, then complete via internal path
let bareSignedRejected = false
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.SIGNED,
  })
} catch (error) {
  bareSignedRejected = error instanceof ValidationError
}
assert('2b. signed without evidence rejected', bareSignedRejected)

const signed = completeInternalCommercialCloseSignature({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  signerDisplayName: 'Jordan Lee',
})
assert(
  '1c. internal signature completes to signed',
  signed.close.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
    signed.close.signature?.status === 'completed' &&
    (signed.close.signature?.evidence?.length ?? 0) >= 1,
)

const payPending = transitionCommercialClose({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  to: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
})
assert(
  '15b. payment pending follow-up created',
  listFollowups().some(
    (item) =>
      item.reason === FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING &&
      item.proposalId === proposal.id &&
      isOpenFollowupStatus(item.status),
  ) &&
    !listFollowups().some(
      (item) =>
        item.reason === FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING &&
        isOpenFollowupStatus(item.status),
    ),
)

// H15.4: paid requires evidence — bare transition must fail, then complete via internal path
let barePaidRejected = false
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.PAID,
  })
} catch (error) {
  barePaidRejected = error instanceof ValidationError
}
assert('2c. paid without evidence rejected', barePaidRejected)

const paid = completeInternalCommercialClosePayment({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  payerDisplayName: 'Jordan Lee',
})
const closed = transitionCommercialClose({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  to: COMMERCIAL_CLOSE_STATUS.CLOSED,
})
assert(
  '1b. full happy path to closed',
  signed.close.status === 'signed' &&
    payPending.close.status === 'payment_pending' &&
    paid.close.status === 'paid' &&
    closed.close.status === 'closed' &&
    closed.close.closedAt &&
    allowedCommercialCloseTransitions('closed').length === 0,
)

assert(
  '6b. close.completed emitted',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.CLOSE_COMPLETED &&
      event.metadata.closeId === created.close.id,
  ),
)

assert(
  '10b. decision binding unchanged after transitions',
  closed.close.decision.selectedTotal === decisionSnapshot.selectedTotal &&
    closed.close.decision.publicationId === decisionSnapshot.publicationId &&
    closed.close.decision.proposalVersion === decisionSnapshot.proposalVersion &&
    closed.close.decision.currency === decisionSnapshot.currency &&
    JSON.stringify(closed.close.decision.selectedAddonIds) ===
      JSON.stringify(decisionSnapshot.selectedAddonIds),
)

assert(
  '11. proposal content not mutated',
  JSON.stringify(proposal.blocks) === blocksBefore,
)
assert('12. data/proposals.json untouched', proposalsSnapshot() === proposalsBefore)

// 13 / 14 public
let publicDenied = false
try {
  clientCommercialCloseTransitionDenied()
} catch (error) {
  publicDenied = error instanceof ForbiddenError
}
assert('13. public client cannot transition', publicDenied)

const clientView = getClientCommercialCloseSummary({
  shareToken: proposal.shareToken,
})
const clientPresent = presentClientCommercialClose(closed.close)
assert(
  '14. public projection strips internals',
  clientView.close?.status === 'closed' &&
    !('openedByActorId' in (clientView.close || {})) &&
    !('statusHistory' in (clientView.close || {})) &&
    !('lastTransitionByActorId' in (clientView.close || {})) &&
    !('companyId' in (clientView.close || {})) &&
    !('allowedTransitions' in clientView) &&
    clientPresent &&
    !('statusHistory' in clientPresent),
)

assert(
  '16. no vendor/email/CRM behavior in close plugin',
  sourceOf('server', 'commercialClosePlugin.js').includes('Never writes `data/proposals.json`') &&
    !sourceOf('server', 'commercialClosePlugin.js').includes('stripe') &&
    !sourceOf('server', 'commercialClosePlugin.js').includes('docusign') &&
    !sourceOf('src', 'commercialClose', 'types.js').includes('digitalSignature: true'),
)

assert(
  '17. plugin exposes transition route',
  sourceOf('server', 'commercialClosePlugin.js').includes('/transition') &&
    sourceOf('server', 'commercialClosePlugin.js').includes('transitionCommercialClose'),
)

// Cancel path events
const again = openAcceptedClose()
const cancelled = transitionCommercialClose({
  companyId: studio,
  closeId: again.created.close.id,
  actor: owner,
  to: COMMERCIAL_CLOSE_STATUS.CANCELLED,
})
assert(
  'cancel. cancelled state + event',
  cancelled.close.status === 'cancelled' &&
    cancelled.close.cancelledAt &&
    allLivingEngagementEvents().some((event) => event.type === LIVING_EVENT.CLOSE_CANCELLED),
)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-commercial-close.mjs',
  'verify-living-close-binding.mjs',
  'verify-living.mjs',
  'verify-living-session.mjs',
  'verify-living-events.mjs',
  'verify-living-publication.mjs',
  'verify-living-interactions.mjs',
  'verify-living-commercial-selection.mjs',
  'verify-followup.mjs',
  'verify-interactions.mjs',
  'verify-portal.mjs',
  'verify-workflow.mjs',
  'verify-forge-actions.mjs',
  'verify-forge-rive.mjs',
  'verify-offer-authoring.mjs',
]

for (const file of suites) {
  const result = runSuite(file)
  assert(`${file} still passes`, result.ok, result.ok ? '' : result.output.slice(-1200))
}

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`verify-commercial-close-state-machine: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
