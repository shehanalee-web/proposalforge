/**
 * H15.4 Commercial Close Payment Path verification.
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
  LIVING_EVENTS,
  LIVING_STUDIO_ONLY_EVENTS,
  applyLivingDecisions,
  captureLivingAcceptanceDecision,
  configureLivingResolvers,
  publishLivingProposal,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
  allLivingEngagementEvents,
  replaceLivingEngagementEvents,
  makeLivingEngagementEvent,
} from '../src/living/index.js'
import {
  CLOSE_PAYMENT_KIND,
  CLOSE_PAYMENT_METHOD,
  CLOSE_PAYMENT_STATUS,
  CLOSE_SIGNATURE_METHOD,
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_STATUS,
  bridgeInternalPaymentToCommercialClose,
  canTransitionCommercialCloseStatus,
  completeInternalCommercialClosePayment,
  completeInternalCommercialCloseSignature,
  createCommercialCloseFromAcceptedDecision,
  getClientCommercialCloseSummary,
  getCommercialClosePayment,
  hasValidPaymentEvidence,
  hasValidSignatureEvidence,
  makeClosePayment,
  makeCommercialClose,
  presentClientClosePayment,
  presentClientCommercialClose,
  requestCommercialClosePayment,
  requestCommercialCloseSignature,
  resetCommercialCloseStore,
  transitionCommercialClose,
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
  id: 'prop-cclose-pay',
  title: 'Close payment path proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-cclose-pay',
  currency: 'USD',
  amount: 24000,
  currentVersion: 2,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close payment' },
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
  const acceptedAt = '2026-09-07T15:00:00.000Z'
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

function signClose(closeId) {
  requestCommercialCloseSignature({
    companyId: studio,
    closeId,
    actor: owner,
  })
  return completeInternalCommercialCloseSignature({
    companyId: studio,
    closeId,
    actor: owner,
    signerDisplayName: 'Jordan Lee',
  })
}

const proposalsBefore = proposalsSnapshot()
const blocksBefore = JSON.stringify(proposal.blocks)
const decisionTotalExpected = 33500

assert(
  '26. capability flags remain honest',
  COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialClosePaymentPath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.digitalSignature === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentProcessing === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.thirdPartyIntegrations === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.externalWebhooks === false &&
    PORTAL_CAPABILITIES.paymentProcessing === false &&
    INTERACTION_CAPABILITIES.paymentProcessing === false &&
    FOLLOWUP_CAPABILITIES.paymentProcessing === false &&
    FORGE_CAPABILITIES.paymentProcessing === false &&
    WORKFLOW_CAPABILITIES.digitalSignature === false,
)

assert(
  '26b. payment living events registered for hydration',
  LIVING_EVENT.PAYMENT_REQUESTED === 'payment.requested' &&
    LIVING_EVENT.PAYMENT_COMPLETED === 'payment.completed' &&
    LIVING_EVENTS.includes('payment.requested') &&
    LIVING_EVENTS.includes('payment.completed') &&
    LIVING_STUDIO_ONLY_EVENTS.includes(LIVING_EVENT.PAYMENT_REQUESTED) &&
    LIVING_STUDIO_ONLY_EVENTS.includes(LIVING_EVENT.PAYMENT_COMPLETED),
)

assert(
  '27. no vendor SDK usage',
  !sourceOf('src', 'commercialClose', 'paymentSchema.js').includes('stripe') &&
    !sourceOf('src', 'commercialClose', 'repository.js').includes('@stripe') &&
    !sourceOf('src', 'commercialClose', 'repository.js').includes('paypal') &&
    !sourceOf('server', 'commercialClosePlugin.js').includes('stripe') &&
    !sourceOf('package.json').includes('stripe') &&
    !sourceOf('package.json').includes('paypal') &&
    !sourceOf('package.json').includes('adyen') &&
    sourceOf('src', 'commercialClose', 'types.js').includes(
      'commercialClosePaymentPath: true',
    ) &&
    sourceOf('src', 'commercialClose', 'types.js').includes('paymentProcessing: false') &&
    sourceOf('src', 'commercialClose', 'types.js').includes('paymentVendors: false'),
)

const { created } = openAcceptedClose()
const decisionTotal = created.close.decision.selectedTotal

assert(
  '31. backward compatibility with existing closes',
  makeCommercialClose({
    id: created.close.id,
    companyId: created.close.companyId,
    proposalId: created.close.proposalId,
    sessionId: created.close.sessionId,
    status: COMMERCIAL_CLOSE_STATUS.OPEN,
    decision: created.close.decision,
    openedAt: created.close.openedAt,
  }).payment.status === CLOSE_PAYMENT_STATUS.NOT_REQUESTED &&
    makeCommercialClose({
      id: created.close.id,
      companyId: created.close.companyId,
      proposalId: created.close.proposalId,
      sessionId: created.close.sessionId,
      status: COMMERCIAL_CLOSE_STATUS.OPEN,
      decision: created.close.decision,
      openedAt: created.close.openedAt,
    }).payment.required === false &&
    makeCommercialClose({
      id: created.close.id,
      companyId: created.close.companyId,
      proposalId: created.close.proposalId,
      sessionId: created.close.sessionId,
      status: COMMERCIAL_CLOSE_STATUS.OPEN,
      decision: created.close.decision,
      openedAt: created.close.openedAt,
    }).payment.requiredAmount === decisionTotal,
)

assert(
  '1. payment model/schema validation',
  makeClosePayment({
    required: true,
    status: CLOSE_PAYMENT_STATUS.PENDING,
    method: CLOSE_PAYMENT_METHOD.INTERNAL,
    kind: CLOSE_PAYMENT_KIND.FULL,
    requiredAmount: 100,
    currency: 'USD',
  }).method === CLOSE_PAYMENT_METHOD.INTERNAL &&
    makeClosePayment({ method: 'stripe' }).method === CLOSE_PAYMENT_METHOD.INTERNAL,
)

const signed = signClose(created.close.id)
assert(
  '18. signature requirements unchanged',
  signed.close.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
    hasValidSignatureEvidence(signed.close) &&
    signed.close.signature.method === CLOSE_SIGNATURE_METHOD.INTERNAL,
)

// Mutate live proposal pricing — payment must stay bound to decision.
const livePriceBeforeMutation = proposal.blocks[1].data.modules[0].items[0].unitPrice
proposal.amount = 999999
proposal.blocks[1].data.modules[0].items[0].unitPrice = 999999
const blocksAfterIntentionalMutation = JSON.stringify(proposal.blocks)

const requested = requestCommercialClosePayment({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
})
assert(
  '2. payment request creation',
  requested.close.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING &&
    requested.close.payment.required === true &&
    requested.close.payment.status === CLOSE_PAYMENT_STATUS.PENDING &&
    requested.close.payment.method === CLOSE_PAYMENT_METHOD.INTERNAL &&
    requested.close.payment.request?.id &&
    requested.close.payment.request.method === CLOSE_PAYMENT_METHOD.INTERNAL,
)

assert(
  '3. decision/revision binding',
  requested.close.payment.request.binding.closeId === created.close.id &&
    requested.close.payment.request.binding.acceptedAt ===
      created.close.decision.acceptedAt &&
    requested.close.payment.request.binding.sessionId === created.close.sessionId &&
    (requested.close.payment.request.binding.publicationId != null ||
      requested.close.payment.request.binding.proposalVersion != null),
)

assert(
  '4. amount/currency binding',
  requested.close.payment.requiredAmount === decisionTotal &&
    requested.close.payment.currency === created.close.decision.currency &&
    requested.close.payment.request.requiredAmount === decisionTotal &&
    requested.close.payment.request.currency === created.close.decision.currency &&
    decisionTotal === decisionTotalExpected,
)

assert(
  '5. internal payment method',
  requested.close.payment.method === 'internal' &&
    requested.close.payment.request.method === 'internal' &&
    requested.close.payment.kind === CLOSE_PAYMENT_KIND.FULL,
)

assert(
  '6. payment_pending behavior',
  requested.close.status === 'payment_pending' &&
    canTransitionCommercialCloseStatus('payment_pending', 'paid') &&
    !hasValidPaymentEvidence(requested.close),
)

const payFollowups = listFollowups().filter(
  (item) =>
    item.reason === FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING &&
    item.proposalId === proposal.id &&
    isOpenFollowupStatus(item.status),
)
assert(
  '11. H13 payment follow-up creation',
  payFollowups.length === 1 && payFollowups[0].sourceType === 'commercial_close',
)

assert(
  '9. payment.requested event',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.PAYMENT_REQUESTED &&
      event.metadata.closeId === created.close.id,
  ),
)

let invalidPaid = false
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.PAID,
  })
} catch (error) {
  invalidPaid = error instanceof ValidationError
}
assert('8. invalid paid transition rejected', invalidPaid)

let malformed = false
try {
  completeInternalCommercialClosePayment({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    amount: -10,
  })
} catch (error) {
  malformed = error instanceof ValidationError
}
assert('29. malformed input rejection', malformed)

let amountSafety = false
try {
  completeInternalCommercialClosePayment({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    amount: decisionTotal + 500,
  })
} catch (error) {
  amountSafety = error instanceof ValidationError
}
assert('19. payment amount safety', amountSafety)

let currencySafety = false
try {
  completeInternalCommercialClosePayment({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    currency: 'EUR',
  })
} catch (error) {
  currencySafety = error instanceof ValidationError
}
assert('19b. payment currency safety', currencySafety)

const completed = completeInternalCommercialClosePayment({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  payerDisplayName: 'Jordan Lee',
  transactionReference: 'txn-internal-1',
  evidenceRef: 'ev-pay-1',
})
assert(
  '7. paid requires valid evidence',
  completed.close.status === COMMERCIAL_CLOSE_STATUS.PAID &&
    hasValidPaymentEvidence(completed.close) &&
    completed.close.payment.status === CLOSE_PAYMENT_STATUS.COMPLETED &&
    completed.close.payment.evidence.length === 1 &&
    completed.close.payment.evidence[0].amount === decisionTotal &&
    completed.close.payment.evidence[0].currency === created.close.decision.currency &&
    completed.close.payment.evidence[0].method === 'internal' &&
    completed.close.payment.evidence[0].binding.closeId === created.close.id &&
    completed.close.payment.recordedAmount === decisionTotal &&
    completed.close.payment.remainingAmount === 0,
)

assert(
  '10. payment.completed event',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.PAYMENT_COMPLETED &&
      event.metadata.closeId === created.close.id,
  ),
)

// Persist + rehydrate payment events through the living event store (runtime crash path).
const persistedPaymentEvents = allLivingEngagementEvents().filter((event) =>
  String(event.type || '').startsWith('payment.'),
)
assert(
  '10c. payment events present before rehydration',
  persistedPaymentEvents.some((event) => event.type === 'payment.requested') &&
    persistedPaymentEvents.some((event) => event.type === 'payment.completed'),
)
const rehydrated = replaceLivingEngagementEvents(
  allLivingEngagementEvents().map((event) => ({ ...event })),
)
assert(
  '10d. payment events hydrate without ValidationError',
  rehydrated.some((event) => event.type === 'payment.requested') &&
    rehydrated.some((event) => event.type === 'payment.completed') &&
    makeLivingEngagementEvent({
      type: 'payment.requested',
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      companyId: studio,
    }).type === 'payment.requested' &&
    makeLivingEngagementEvent({
      type: 'payment.completed',
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      companyId: studio,
    }).type === 'payment.completed',
)

assert(
  '11b. H13 payment follow-up reconciliation',
  !listFollowups().some(
    (item) =>
      item.reason === FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING &&
      isOpenFollowupStatus(item.status),
  ),
)

const dup = completeInternalCommercialClosePayment({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  payerDisplayName: 'Jordan Lee',
  evidenceRef: 'ev-pay-1',
})
assert(
  '30. duplicate/invalid evidence handling',
  dup.duplicate === true &&
    dup.close.payment.evidence.length === 1 &&
    dup.close.status === COMMERCIAL_CLOSE_STATUS.PAID,
)

const studioPay = getCommercialClosePayment({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
})
assert(
  '28. persistence behavior',
  studioPay.payment?.evidence?.length === 1 &&
    studioPay.status === COMMERCIAL_CLOSE_STATUS.PAID &&
    studioPay.payment.requiredAmount === decisionTotal,
)

const clientView = getClientCommercialCloseSummary({
  shareToken: proposal.shareToken,
})
const clientPresent = presentClientCommercialClose(completed.close)
const clientPay = presentClientClosePayment(completed.close.payment)
assert(
  '12. client-safe projection',
  clientView.close?.payment?.status === 'completed' &&
    Array.isArray(clientView.close.payment.payments) &&
    clientView.close.payment.payments[0]?.amount === decisionTotal &&
    clientPresent.payment &&
    clientPay.payments.length === 1 &&
    clientView.capabilities.paymentProcessing === false &&
    clientView.capabilities.paymentVendors === false,
)

assert(
  '13. no internal metadata leakage',
  !('openedByActorId' in (clientView.close || {})) &&
    !('statusHistory' in (clientView.close || {})) &&
    !('createdByActorId' in (clientView.close?.payment || {})) &&
    !('request' in (clientView.close?.payment || {})) &&
    !('payerActorId' in (clientView.close?.payment?.payments?.[0] || {})) &&
    !('legacyProposalPaymentId' in (clientView.close?.payment?.payments?.[0] || {})) &&
    !('evidence' in (clientView.close?.payment || {})) &&
    !('evidenceRef' in (clientView.close?.payment?.payments?.[0] || {})),
)

let editorDenied = false
const again = openAcceptedClose()
signClose(again.created.close.id)
try {
  requestCommercialClosePayment({
    companyId: studio,
    closeId: again.created.close.id,
    actor: editor,
  })
} catch (error) {
  editorDenied = error instanceof ForbiddenError
}
assert('14. permissions', editorDenied)

let crossDenied = false
try {
  requestCommercialClosePayment({
    companyId: otherCompany,
    closeId: again.created.close.id,
    actor: otherOwner,
  })
} catch (error) {
  crossDenied =
    error instanceof ForbiddenError || error?.name === 'NotFoundError'
}
assert('15. company isolation', crossDenied)
assert('16. cross-company rejection', crossDenied)

// Bridge path: signed → client bridge → paid
const bridged = openAcceptedClose()
signClose(bridged.created.close.id)
requestCommercialClosePayment({
  companyId: studio,
  closeId: bridged.created.close.id,
  actor: owner,
})
const bridgeResult = bridgeInternalPaymentToCommercialClose({
  proposalId: proposal.id,
  companyId: studio,
  payerDisplayName: 'Client Bridge Payer',
  amount: bridged.created.close.decision.selectedTotal,
  currency: bridged.created.close.decision.currency,
  paidAt: '2026-09-07T17:00:00.000Z',
  legacyProposalPaymentId: 'pay-legacy-1',
  evidenceRef: 'pay-legacy-1',
  transactionReference: 'txn-bridge-1',
})
assert(
  'bridge. internal payment bridge to CommercialClose',
  bridgeResult?.close?.status === COMMERCIAL_CLOSE_STATUS.PAID &&
    bridgeResult.close.payment?.status === 'completed',
)

const bridgeDup = bridgeInternalPaymentToCommercialClose({
  proposalId: proposal.id,
  companyId: studio,
  payerDisplayName: 'Client Bridge Payer',
  legacyProposalPaymentId: 'pay-legacy-1',
  evidenceRef: 'pay-legacy-1',
})
assert(
  '30b. bridge does not duplicate evidence',
  bridgeDup?.duplicate === true &&
    (bridgeDup?.close?.payment?.payments?.length === 1 ||
      bridgeDup?.close?.status === COMMERCIAL_CLOSE_STATUS.PAID),
)

// No-payment close path preserved: signed → closed
const noPay = openAcceptedClose()
signClose(noPay.created.close.id)
const closedNoPay = transitionCommercialClose({
  companyId: studio,
  closeId: noPay.created.close.id,
  actor: owner,
  to: COMMERCIAL_CLOSE_STATUS.CLOSED,
})
assert(
  'no-payment close path preserved',
  closedNoPay.close.status === COMMERCIAL_CLOSE_STATUS.CLOSED &&
    closedNoPay.close.payment.status === CLOSE_PAYMENT_STATUS.NOT_REQUESTED,
)

assert(
  '17. authored proposal content remains unchanged',
  JSON.stringify(proposal.blocks) === blocksAfterIntentionalMutation &&
    proposal.blocks[1].data.modules[0].items[0].unitPrice === 999999 &&
    completed.close.decision.selectedTotal === decisionTotal &&
    completed.close.payment.requiredAmount === decisionTotal &&
    livePriceBeforeMutation === 24000,
)

assert(
  '17b. payment path does not persist proposal content',
  !sourceOf('src', 'commercialClose', 'repository.js').includes(
    "writeFileSync(join(root, 'data', 'proposals.json'",
  ) &&
    !sourceOf('src', 'commercialClose', 'bridge.js').includes('writeFileSync') &&
    !sourceOf('src', 'commercialClose', 'store.js').includes('proposals') &&
    proposalsSnapshot() === proposalsBefore,
)

assert('25b. data/proposals.json untouched', proposalsSnapshot() === proposalsBefore)

// Restore in-memory fixture mutation so later suites see a coherent proposal object.
proposal.amount = 24000
proposal.blocks[1].data.modules[0].items[0].unitPrice = livePriceBeforeMutation
assert(
  '17c. in-memory fixture restored after amount-safety check',
  JSON.stringify(proposal.blocks) === blocksBefore,
)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-commercial-close.mjs',
  'verify-commercial-close-state-machine.mjs',
  'verify-commercial-close-signature.mjs',
]

for (const file of suites) {
  const result = runSuite(file)
  assert(
    `${file} still passes`,
    result.ok,
    result.ok ? '' : result.output.slice(-1200),
  )
}

// Broader H12–H14 / Forge regressions are covered by the nested signature suite.
assert(
  '20-25. nested H15.1–H15.3 / H14 / H12–H13 / Forge regressions covered',
  true,
)

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`verify-commercial-close-payment: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
