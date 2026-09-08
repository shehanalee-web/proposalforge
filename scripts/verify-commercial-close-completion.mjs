/**
 * H15.7 Commercial Close Completion / Reconciliation verification.
 *
 * Requirement-driven completion. Never writes data/proposals.json.
 * No real vendor SDKs, OAuth, or live webhook HTTP ingress.
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
import {
  applyLivingDecisions,
  captureLivingAcceptanceDecision,
  configureLivingResolvers,
  publishLivingProposal,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
} from '../src/living/index.js'
import {
  CLOSE_CONTRACT_STATUS,
  CLOSE_INVOICE_STATUS,
  CLOSE_PAYMENT_STATUS,
  CLOSE_SIGNATURE_STATUS,
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_COMPLETION_BLOCKER,
  COMMERCIAL_CLOSE_COMPLETION_RESULT,
  COMMERCIAL_CLOSE_STATUS,
  NULL_PROVIDER_ID,
  PROVIDER_APPLY_RESULT,
  PROVIDER_KIND,
  PROVIDER_REJECTION_REASON,
  PROVIDER_SIGNAL_OUTCOME,
  applyProviderPaymentSignal,
  applyProviderSignatureSignal,
  completeInternalCommercialClosePayment,
  completeInternalCommercialCloseSignature,
  createCommercialCloseFromAcceptedDecision,
  evaluateCommercialCloseCompletion,
  findCommercialClose,
  getCommercialCloseCompletion,
  issueCommercialCloseContract,
  issueCommercialCloseInvoice,
  presentCommercialCloseCompletionSummary,
  reconcileCommercialCloseCompletion,
  reconcileCommercialCloseCompletionForStudio,
  requestCommercialCloseContract,
  requestCommercialCloseInvoice,
  requestCommercialClosePayment,
  requestCommercialCloseSignature,
  resetCommercialCloseStore,
  resetProviderAdapterRegistry,
  resetProviderWebhookReceipts,
  transitionCommercialClose,
} from '../src/commercialClose/index.js'
import { resetFollowupStore } from '../src/followup/index.js'
import { FOLLOWUP_CAPABILITIES } from '../src/followup/types.js'
import { FORGE_CAPABILITIES } from '../src/forge/types.js'
import { buildForgeLivingSummary } from '../src/forge/summary.js'
import { INTERACTION_CAPABILITIES } from '../src/interactions/types.js'
import { PORTAL_CAPABILITIES } from '../src/portal/types.js'
import { WORKFLOW_CAPABILITIES } from '../src/workflow/types.js'
import { resolveWorkflowActor } from '../src/workflow/actors.js'
import { ValidationError } from '../src/services/errors.js'

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
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      CI: process.env.CI || '1',
    },
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
    status: result.status,
    error: result.error ? String(result.error) : '',
  }
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

const studio = DEFAULT_COMPANY_ID
const owner = resolveWorkflowActor('user-studio-sarah')

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
  id: 'prop-cclose-completion',
  title: 'Close completion reconciliation proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-cclose-completion',
  currency: 'USD',
  amount: 24000,
  currentVersion: 2,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close completion' },
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
  resetProviderAdapterRegistry()
  resetProviderWebhookReceipts()
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
  const acceptedAt = '2026-09-08T10:00:00.000Z'
  captureLivingAcceptanceDecision({
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
  return { created, acceptedAt }
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
    signedAt: '2026-09-08T10:05:00.000Z',
  })
}

function payClose(closeId, amount) {
  requestCommercialClosePayment({
    companyId: studio,
    closeId,
    actor: owner,
  })
  return completeInternalCommercialClosePayment({
    companyId: studio,
    closeId,
    actor: owner,
    payerDisplayName: 'Jordan Lee',
    amount,
    currency: 'USD',
    paidAt: '2026-09-08T10:10:00.000Z',
  })
}

const proposalsBefore = proposalsSnapshot()
const blocksBefore = JSON.stringify(proposal.blocks)
const decisionTotal = 33500

assert(
  '1. capability flag commercialCloseCompletionReconciliation true; vendors false',
  COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseCompletionReconciliation === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialClosePaymentPath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseContractPath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseInvoicePath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseProviderAdapterArchitecture ===
      true &&
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
  '2. completion module exists and H15.2 graph unchanged',
  sourceOf('src', 'commercialClose', 'completion.js').includes(
    'evaluateCommercialCloseCompletion',
  ) &&
    sourceOf('src', 'commercialClose', 'transitions.js').includes(
      "[COMMERCIAL_CLOSE_STATUS.SIGNED]: [",
    ) &&
    sourceOf('src', 'commercialClose', 'transitions.js').includes(
      'COMMERCIAL_CLOSE_STATUS.CLOSED',
    ) &&
    !sourceOf('src', 'commercialClose', 'completion.js').includes('stripe') &&
    !sourceOf('src', 'commercialClose', 'completion.js').includes('docusign'),
)

// --- Signed-only completion (payment not required) ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  const decisionBefore = JSON.stringify(created.close.decision)
  const signed = signClose(closeId)
  const evaluation = evaluateCommercialCloseCompletion(signed.close)
  assert(
    '3. signed-only: ready when payment not required',
    evaluation.ready === true &&
      evaluation.requirements.signature === true &&
      evaluation.requirements.payment === false &&
      evaluation.satisfied.signature === true &&
      evaluation.blockers.length === 0 &&
      signed.close.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
      signed.close.payment.status === CLOSE_PAYMENT_STATUS.NOT_REQUESTED,
  )
  const closed = transitionCommercialClose({
    companyId: studio,
    closeId,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.CLOSED,
  })
  assert(
    '4. signed → closed preserved when payment not required',
    closed.close.status === COMMERCIAL_CLOSE_STATUS.CLOSED &&
      closed.close.closedAt &&
      closed.completion?.alreadyComplete === true &&
      JSON.stringify(closed.close.decision) === decisionBefore,
  )
  const again = reconcileCommercialCloseCompletion(closed.close)
  const againStudio = reconcileCommercialCloseCompletionForStudio({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '5. already closed is safe no-op / idempotent',
    again.result === COMMERCIAL_CLOSE_COMPLETION_RESULT.ALREADY_COMPLETE &&
      again.mutated === false &&
      againStudio.result === COMMERCIAL_CLOSE_COMPLETION_RESULT.ALREADY_COMPLETE &&
      againStudio.mutated === false &&
      JSON.stringify(againStudio.close.decision) === decisionBefore,
  )
}

// --- Payment-only completion (signature not required) ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  const decisionBefore = JSON.stringify(created.close.decision)
  const paid = payClose(closeId, decisionTotal)
  const evaluation = evaluateCommercialCloseCompletion(paid.close)
  assert(
    '6. payment-only: ready when signature not required',
    evaluation.ready === true &&
      evaluation.requirements.payment === true &&
      evaluation.requirements.signature === false &&
      evaluation.satisfied.payment === true &&
      paid.close.status === COMMERCIAL_CLOSE_STATUS.PAID &&
      paid.close.signature.status === CLOSE_SIGNATURE_STATUS.NOT_REQUESTED,
  )
  const closed = transitionCommercialClose({
    companyId: studio,
    closeId,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.CLOSED,
  })
  assert(
    '7. paid → closed preserved when signature not required',
    closed.close.status === COMMERCIAL_CLOSE_STATUS.CLOSED &&
      JSON.stringify(closed.close.decision) === decisionBefore,
  )
}

// --- Signature + payment both required ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  const signed = signClose(closeId)
  const afterSign = evaluateCommercialCloseCompletion(signed.close)
  assert(
    '8. after signature only, payment not yet required → ready (skip path)',
    afterSign.ready === true && afterSign.requirements.payment === false,
  )

  requestCommercialClosePayment({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const afterPayReq = reconcileCommercialCloseCompletionForStudio({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '9. signature + payment required: incomplete payment blocks completion',
    afterPayReq.result === COMMERCIAL_CLOSE_COMPLETION_RESULT.BLOCKED &&
      afterPayReq.completion.requirements.signature === true &&
      afterPayReq.completion.requirements.payment === true &&
      afterPayReq.completion.blockers.includes(
        COMMERCIAL_CLOSE_COMPLETION_BLOCKER.PAYMENT_INCOMPLETE,
      ),
  )

  let closeRejected = false
  try {
    transitionCommercialClose({
      companyId: studio,
      closeId,
      actor: owner,
      to: COMMERCIAL_CLOSE_STATUS.CLOSED,
    })
  } catch (error) {
    closeRejected = error instanceof ValidationError
  }
  assert('10. gate rejects signed → closed when payment required', closeRejected)

  const paid = completeInternalCommercialClosePayment({
    companyId: studio,
    closeId,
    actor: owner,
    payerDisplayName: 'Jordan Lee',
    amount: decisionTotal,
    currency: 'USD',
    paidAt: '2026-09-08T10:20:00.000Z',
  })
  const bothReady = evaluateCommercialCloseCompletion(paid.close)
  assert(
    '11. signature + payment both satisfied → ready',
    bothReady.ready === true &&
      bothReady.satisfied.signature === true &&
      bothReady.satisfied.payment === true &&
      paid.close.status === COMMERCIAL_CLOSE_STATUS.PAID,
  )
  const closed = transitionCommercialClose({
    companyId: studio,
    closeId,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.CLOSED,
  })
  assert(
    '12. both requirements: paid → closed succeeds',
    closed.close.status === COMMERCIAL_CLOSE_STATUS.CLOSED,
  )
}

// --- Incomplete signature blocks when required ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  requestCommercialCloseSignature({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const pending = getCommercialCloseCompletion({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '13. incomplete signature blocks when required',
    pending.completion.ready === false &&
      pending.completion.requirements.signature === true &&
      pending.completion.blockers.includes(
        COMMERCIAL_CLOSE_COMPLETION_BLOCKER.SIGNATURE_INCOMPLETE,
      ) &&
      pending.completion.blockers.includes(
        COMMERCIAL_CLOSE_COMPLETION_BLOCKER.STATUS_NOT_CLOSABLE,
      ),
  )
}

// --- Partial payment blocks when payment required ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  requestCommercialClosePayment({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const partial = completeInternalCommercialClosePayment({
    companyId: studio,
    closeId,
    actor: owner,
    payerDisplayName: 'Jordan Lee',
    amount: 1000,
    currency: 'USD',
    paidAt: '2026-09-08T10:25:00.000Z',
  })
  const evaluation = evaluateCommercialCloseCompletion(partial.close)
  assert(
    '14. partial payment blocks when payment required',
    partial.settled === false &&
      partial.close.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING &&
      evaluation.ready === false &&
      evaluation.blockers.includes(
        COMMERCIAL_CLOSE_COMPLETION_BLOCKER.PAYMENT_PARTIAL,
      ),
  )
  let rejected = false
  try {
    transitionCommercialClose({
      companyId: studio,
      closeId,
      actor: owner,
      to: COMMERCIAL_CLOSE_STATUS.CLOSED,
    })
  } catch (error) {
    rejected = error instanceof ValidationError
  }
  assert('15. partial payment cannot transition to closed', rejected)
}

// --- Artifacts orthogonal unless required ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  signClose(closeId)
  const readyWithout = getCommercialCloseCompletion({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '16. artifacts do not block when not required',
    readyWithout.completion.ready === true &&
      readyWithout.completion.requirements.contract === false &&
      readyWithout.completion.requirements.invoice === false,
  )

  requestCommercialCloseContract({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const contractRequired = getCommercialCloseCompletion({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '17. contract blocks only when explicitly required and not issued',
    contractRequired.completion.ready === false &&
      contractRequired.completion.requirements.contract === true &&
      contractRequired.completion.blockers.includes(
        COMMERCIAL_CLOSE_COMPLETION_BLOCKER.CONTRACT_INCOMPLETE,
      ),
  )

  issueCommercialCloseContract({
    companyId: studio,
    closeId,
    actor: owner,
  })
  requestCommercialCloseInvoice({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const invoiceRequired = getCommercialCloseCompletion({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '18. invoice blocks only when explicitly required and not issued',
    invoiceRequired.completion.ready === false &&
      invoiceRequired.completion.requirements.invoice === true &&
      invoiceRequired.completion.blockers.includes(
        COMMERCIAL_CLOSE_COMPLETION_BLOCKER.INVOICE_INCOMPLETE,
      ) &&
      invoiceRequired.completion.satisfied.contract === true,
  )

  issueCommercialCloseInvoice({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const artifactsReady = getCommercialCloseCompletion({
    companyId: studio,
    closeId,
    actor: owner,
  })
  assert(
    '19. issued required artifacts unlock completion',
    artifactsReady.completion.ready === true &&
      artifactsReady.completion.satisfied.contract === true &&
      artifactsReady.completion.satisfied.invoice === true,
  )
  const closed = transitionCommercialClose({
    companyId: studio,
    closeId,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.CLOSED,
  })
  assert(
    '20. close succeeds after required artifacts issued',
    closed.close.status === COMMERCIAL_CLOSE_STATUS.CLOSED &&
      closed.close.contract.status === CLOSE_CONTRACT_STATUS.ISSUED &&
      closed.close.invoice.status === CLOSE_INVOICE_STATUS.ISSUED,
  )
}

// --- Reconciliation idempotent + provider signals cannot force completion ---
{
  const { created } = openAcceptedClose()
  const closeId = created.close.id
  const decisionBefore = JSON.stringify(created.close.decision)
  requestCommercialCloseSignature({
    companyId: studio,
    closeId,
    actor: owner,
  })
  const first = reconcileCommercialCloseCompletionForStudio({
    companyId: studio,
    closeId,
    actor: owner,
    providerSignals: [
      {
        providerId: NULL_PROVIDER_ID.SIGNATURE,
        providerKind: PROVIDER_KIND.SIGNATURE,
        outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
        closeId,
      },
    ],
  })
  const second = reconcileCommercialCloseCompletionForStudio({
    companyId: studio,
    closeId,
    actor: owner,
    providerSignals: [
      {
        providerId: NULL_PROVIDER_ID.SIGNATURE,
        providerKind: PROVIDER_KIND.SIGNATURE,
        outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
        closeId,
      },
      {
        providerId: NULL_PROVIDER_ID.PAYMENT,
        providerKind: PROVIDER_KIND.PAYMENT,
        outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
        closeId,
        amount: decisionTotal,
        currency: 'USD',
      },
    ],
  })
  assert(
    '21. reconciliation idempotent while blocked',
    first.result === COMMERCIAL_CLOSE_COMPLETION_RESULT.BLOCKED &&
      second.result === COMMERCIAL_CLOSE_COMPLETION_RESULT.BLOCKED &&
      first.mutated === false &&
      second.mutated === false &&
      first.providerSignalsIgnored === 1 &&
      second.providerSignalsIgnored === 2 &&
      JSON.stringify(second.close.decision) === decisionBefore &&
      second.close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
  )

  const stored = findCommercialClose(closeId)
  const applySig = applyProviderSignatureSignal(stored, {
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    providerKind: PROVIDER_KIND.SIGNATURE,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    closeId,
    companyId: studio,
    signerDisplayName: 'Client Signer',
  })
  const applyPay = applyProviderPaymentSignal(stored, {
    providerId: NULL_PROVIDER_ID.PAYMENT,
    providerKind: PROVIDER_KIND.PAYMENT,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    closeId,
    companyId: studio,
    amount: decisionTotal,
    currency: 'USD',
  })
  const afterVendor = reconcileCommercialCloseCompletion(stored, {
    providerSignals: [
      { outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED },
      { outcome: PROVIDER_SIGNAL_OUTCOME.FAILED },
    ],
  })
  assert(
    '22. stale/conflicting provider signals cannot force completion; adapters non-mutating',
    applySig.result === PROVIDER_APPLY_RESULT.REJECTED &&
      applySig.reason === PROVIDER_REJECTION_REASON.VENDORS_DISABLED &&
      applyPay.result === PROVIDER_APPLY_RESULT.REJECTED &&
      applyPay.reason === PROVIDER_REJECTION_REASON.VENDORS_DISABLED &&
      afterVendor.mutated === false &&
      afterVendor.result === COMMERCIAL_CLOSE_COMPLETION_RESULT.BLOCKED &&
      afterVendor.vendorsDisabled === true &&
      afterVendor.close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING &&
      findCommercialClose(closeId).status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
  )
}

// --- Thin Forge summary from CommercialClose only ---
{
  const { created } = openAcceptedClose()
  const signed = signClose(created.close.id)
  const summaryProjection = presentCommercialCloseCompletionSummary(signed.close)
  const forgeSummary = buildForgeLivingSummary({
    proposal,
    commercialCloseCompletion: summaryProjection,
  })
  assert(
    '23. thin Forge completion summary derived from CommercialClose',
    summaryProjection?.ready === true &&
      forgeSummary.commercialCloseCompletion?.ready === true &&
      forgeSummary.commercialCloseCompletion?.closeId === signed.close.id &&
      forgeSummary.facts.some((fact) =>
        String(fact).includes('Commercial close is ready to complete'),
      ),
  )
}

assert(
  '24. authored proposal content unchanged',
  JSON.stringify(proposal.blocks) === blocksBefore && proposal.amount === 24000,
)

assert(
  '25. data/proposals.json unchanged so far',
  proposalsSnapshot() === proposalsBefore,
)

assert(
  '26. plugin exposes completion endpoints; no live webhook ingress',
  sourceOf('server', 'commercialClosePlugin.js').includes(
    '/api/commercial-close/:closeId/completion',
  ) &&
    sourceOf('server', 'commercialClosePlugin.js').includes(
      'getCommercialCloseCompletion',
    ) &&
    !sourceOf('server', 'commercialClosePlugin.js').includes('webhook') &&
    !sourceOf('package.json').includes('stripe') &&
    !sourceOf('package.json').includes('docusign'),
)

assert(
  '27. requirement-driven evaluator exported',
  typeof evaluateCommercialCloseCompletion === 'function' &&
    typeof reconcileCommercialCloseCompletion === 'function' &&
    typeof presentCommercialCloseCompletionSummary === 'function',
)

console.log('')
console.log('— Regression suites —')
const suites = ['verify-commercial-close-providers.mjs']
let nestedOk = true
for (const file of suites) {
  const result = runSuite(file)
  assert(`nested ${file}`, result.ok, result.ok ? '' : result.output.slice(-1200))
  if (!result.ok) nestedOk = false
}

assert(
  '28. H15.1–H15.6 regressions via nested providers suite',
  nestedOk,
)

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`H15.7 completion reconciliation checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
