/**
 * H15.6 Commercial Close Provider Adapter Architecture verification.
 *
 * Never writes data/proposals.json.
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
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
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
  CLOSE_PAYMENT_METHOD,
  CLOSE_SIGNATURE_METHOD,
  COMMERCIAL_CLOSE_CAPABILITIES,
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
  digestProviderPayload,
  evaluateProviderSignalOrdering,
  getCommercialCloseProviderConfig,
  getProviderAdapter,
  hasProviderEventReceipt,
  isValidProviderEventEnvelope,
  isValidProviderRef,
  listProviderAdapters,
  makeClosePaymentEvidence,
  makeCloseSignatureEvidence,
  makeCommercialClose,
  makeProviderEventEnvelope,
  makeProviderIdempotencyKey,
  makeProviderRef,
  makeProviderSignal,
  mapPaymentSignalToEvidence,
  mapSignatureSignalToEvidence,
  normalizeProviderEvent,
  presentClientProviderConfig,
  processProviderWebhookFoundation,
  recordProviderEventReceipt,
  registerProviderAdapter,
  rejectUnknownProvider,
  requestCommercialClosePayment,
  requestCommercialCloseSignature,
  resetCommercialCloseStore,
  resetProviderAdapterRegistry,
  resetProviderWebhookReceipts,
  resolveEnabledProviderAdapter,
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
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      // Prevent accidental interactive waits in nested suites.
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
const otherCompany = WORKFLOW_ISOLATION_COMPANY_ID
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
  id: 'prop-cclose-providers',
  title: 'Close provider adapter architecture proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-cclose-providers',
  currency: 'USD',
  amount: 24000,
  currentVersion: 2,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close providers' },
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
  const acceptedAt = '2026-09-07T17:00:00.000Z'
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

const proposalsBefore = proposalsSnapshot()
const blocksBefore = JSON.stringify(proposal.blocks)
const decisionTotalExpected = 33500

const providerSrc = [
  sourceOf('src', 'commercialClose', 'providers', 'types.js'),
  sourceOf('src', 'commercialClose', 'providers', 'adapter.js'),
  sourceOf('src', 'commercialClose', 'providers', 'webhook.js'),
  sourceOf('src', 'commercialClose', 'providers', 'evidenceMap.js'),
  sourceOf('src', 'commercialClose', 'providers', 'applySignal.js'),
  sourceOf('src', 'commercialClose', 'providerConfig.js'),
].join('\n')

assert(
  '31. capability flags remain honest',
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
  'no real vendor SDKs / OAuth / live webhook routes',
  !providerSrc.includes('stripe') &&
    !providerSrc.includes('docusign') &&
    !providerSrc.includes('paypal') &&
    !providerSrc.includes('oauth') &&
    !sourceOf('package.json').includes('stripe') &&
    !sourceOf('package.json').includes('docusign') &&
    !sourceOf('server', 'commercialClosePlugin.js').includes(
      '/providers/',
    ) &&
    !sourceOf('server', 'commercialClosePlugin.js').includes('webhook'),
)

resetProviderAdapterRegistry()

assert(
  '1. adapter registry',
  listProviderAdapters().length === 2 &&
    listProviderAdapters(PROVIDER_KIND.SIGNATURE).length === 1 &&
    listProviderAdapters(PROVIDER_KIND.PAYMENT).length === 1 &&
    getProviderAdapter(PROVIDER_KIND.SIGNATURE, NULL_PROVIDER_ID.SIGNATURE)
      ?.id === NULL_PROVIDER_ID.SIGNATURE &&
    getProviderAdapter(PROVIDER_KIND.PAYMENT, NULL_PROVIDER_ID.PAYMENT)?.id ===
      NULL_PROVIDER_ID.PAYMENT,
)

const nullSig = getProviderAdapter(
  PROVIDER_KIND.SIGNATURE,
  NULL_PROVIDER_ID.SIGNATURE,
)
const nullPay = getProviderAdapter(
  PROVIDER_KIND.PAYMENT,
  NULL_PROVIDER_ID.PAYMENT,
)
const emptyConfig = getCommercialCloseProviderConfig(studio, NULL_PROVIDER_ID.SIGNATURE)

assert(
  '2. null adapters',
  nullSig?.kind === PROVIDER_KIND.SIGNATURE &&
    nullPay?.kind === PROVIDER_KIND.PAYMENT &&
    typeof nullSig.createSignatureRequest === 'function' &&
    typeof nullSig.cancelSignatureRequest === 'function' &&
    typeof nullSig.mapProviderEvent === 'function' &&
    typeof nullSig.toCloseEvidence === 'function' &&
    typeof nullSig.verifyWebhook === 'function' &&
    typeof nullPay.createPaymentRequest === 'function' &&
    typeof nullPay.cancelPaymentRequest === 'function' &&
    typeof nullPay.mapProviderEvent === 'function' &&
    typeof nullPay.toCloseEvidence === 'function' &&
    typeof nullPay.verifyWebhook === 'function',
)

assert(
  '3. disabled adapters',
  nullSig.isEnabled(emptyConfig) === false &&
    nullPay.isEnabled(emptyConfig) === false &&
    resolveEnabledProviderAdapter(
      PROVIDER_KIND.SIGNATURE,
      NULL_PROVIDER_ID.SIGNATURE,
      emptyConfig,
    ).ok === false &&
    resolveEnabledProviderAdapter(
      PROVIDER_KIND.SIGNATURE,
      NULL_PROVIDER_ID.SIGNATURE,
      emptyConfig,
    ).reason === PROVIDER_REJECTION_REASON.DISABLED_ADAPTER &&
    nullSig.createSignatureRequest({}).rejected === true &&
    nullPay.createPaymentRequest({}).rejected === true &&
    nullSig.verifyWebhook({}).rejected === true,
)

assert(
  '4. provider contract validation',
  (() => {
    try {
      registerProviderAdapter({
        id: 'broken',
        kind: PROVIDER_KIND.SIGNATURE,
      })
      return false
    } catch {
      return true
    }
  })(),
)

const validRef = makeProviderRef({
  providerId: NULL_PROVIDER_ID.SIGNATURE,
  providerKind: PROVIDER_KIND.SIGNATURE,
  externalId: 'env-1',
  externalStatus: 'sent',
})

assert(
  '5. provider reference validation',
  isValidProviderRef(validRef) === true &&
    isValidProviderRef({ providerId: 'x' }) === false &&
    isValidProviderRef(null) === false,
)

const { created, acceptedAt } = openAcceptedClose()
const close = created.close
const closeId = close.id

assert(
  '6. company isolation',
  applyProviderSignatureSignal(close, {
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    providerKind: PROVIDER_KIND.SIGNATURE,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    companyId: otherCompany,
    closeId,
    signerDisplayName: 'Client',
  }).reason === PROVIDER_REJECTION_REASON.COMPANY_MISMATCH &&
    applyProviderSignatureSignal(
      close,
      {
        providerId: NULL_PROVIDER_ID.SIGNATURE,
        providerKind: PROVIDER_KIND.SIGNATURE,
        outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
        companyId: studio,
        closeId,
        signerDisplayName: 'Client',
      },
      { expectedCompanyId: otherCompany },
    ).reason === PROVIDER_REJECTION_REASON.COMPANY_MISMATCH,
)

assert(
  '7. cross-company provider reference rejection',
  applyProviderPaymentSignal(
    { ...close, companyId: otherCompany },
    {
      providerId: NULL_PROVIDER_ID.PAYMENT,
      providerKind: PROVIDER_KIND.PAYMENT,
      outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
      companyId: studio,
      closeId,
      amount: decisionTotalExpected,
      currency: 'USD',
    },
  ).reason === PROVIDER_REJECTION_REASON.COMPANY_MISMATCH,
)

const envelope = makeProviderEventEnvelope({
  providerId: NULL_PROVIDER_ID.SIGNATURE,
  providerKind: PROVIDER_KIND.SIGNATURE,
  providerEventId: 'evt-1',
  providerEventType: 'envelope.completed',
  companyId: studio,
  closeId,
  providerRef: validRef,
  payloadDigest: digestProviderPayload({ ok: true }),
  rawVerified: true,
})

assert(
  '8. event envelope validation',
  isValidProviderEventEnvelope(envelope) === true &&
    isValidProviderEventEnvelope({
      ...envelope,
      rawVerified: false,
    }) === false &&
    isValidProviderEventEnvelope({
      providerId: 'x',
      providerKind: PROVIDER_KIND.SIGNATURE,
      providerEventId: 'e',
      companyId: '',
      rawVerified: true,
    }) === false,
)

const idem = makeProviderIdempotencyKey(studio, NULL_PROVIDER_ID.SIGNATURE, 'evt-1')

assert(
  '9. idempotency key generation',
  idem === `${studio}|${NULL_PROVIDER_ID.SIGNATURE}|evt-1` &&
    makeProviderIdempotencyKey('', 'a', 'b') === null,
)

resetProviderWebhookReceipts()
const firstReceipt = recordProviderEventReceipt(envelope)
const secondReceipt = recordProviderEventReceipt(envelope)

assert(
  '10. duplicate event safety',
  firstReceipt.ok === true &&
    firstReceipt.duplicate === false &&
    secondReceipt.ok === true &&
    secondReceipt.duplicate === true &&
    hasProviderEventReceipt(studio, NULL_PROVIDER_ID.SIGNATURE, 'evt-1') === true,
)

assert(
  '11. replay safety',
  recordProviderEventReceipt({
    ...envelope,
    receivedAt: '2026-09-07T18:00:00.000Z',
  }).duplicate === true,
)

assert(
  '12. unknown provider rejection',
  rejectUnknownProvider(PROVIDER_KIND.SIGNATURE, 'stripe').ok === false &&
    rejectUnknownProvider(PROVIDER_KIND.SIGNATURE, 'stripe').reason ===
      PROVIDER_REJECTION_REASON.UNKNOWN_PROVIDER &&
    resolveEnabledProviderAdapter(PROVIDER_KIND.PAYMENT, 'paypal', emptyConfig)
      .reason === PROVIDER_REJECTION_REASON.UNKNOWN_PROVIDER,
)

assert(
  '13. unknown event handling',
  applyProviderSignatureSignal(close, {
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    providerKind: PROVIDER_KIND.SIGNATURE,
    outcome: PROVIDER_SIGNAL_OUTCOME.IGNORED,
    companyId: studio,
    closeId,
  }).result === PROVIDER_APPLY_RESULT.IGNORED &&
    mapSignatureSignalToEvidence(close, {
      providerId: NULL_PROVIDER_ID.SIGNATURE,
      providerKind: PROVIDER_KIND.SIGNATURE,
      outcome: PROVIDER_SIGNAL_OUTCOME.FAILED,
      companyId: studio,
      closeId,
      signerDisplayName: 'X',
    }).reason === PROVIDER_REJECTION_REASON.UNKNOWN_EVENT,
)

assert(
  '14. disabled provider rejection',
  processProviderWebhookFoundation({
    providerKind: PROVIDER_KIND.SIGNATURE,
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    companyId: studio,
    close,
    storedProviderRef: validRef,
    rawBody: '{"id":"evt"}',
  }).reason === PROVIDER_REJECTION_REASON.DISABLED_ADAPTER &&
    processProviderWebhookFoundation({
      providerKind: PROVIDER_KIND.PAYMENT,
      providerId: NULL_PROVIDER_ID.PAYMENT,
      companyId: studio,
      close,
      storedProviderRef: makeProviderRef({
        providerId: NULL_PROVIDER_ID.PAYMENT,
        providerKind: PROVIDER_KIND.PAYMENT,
        externalId: 'pi_1',
      }),
      rawBody: '{}',
    }).reason === PROVIDER_REJECTION_REASON.DISABLED_ADAPTER,
)

const pendingClose = {
  ...close,
  status: COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING,
}
const signedClose = {
  ...close,
  status: COMMERCIAL_CLOSE_STATUS.SIGNED,
}
const stale = evaluateProviderSignalOrdering(
  signedClose,
  makeProviderSignal({
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    providerKind: PROVIDER_KIND.SIGNATURE,
    outcome: PROVIDER_SIGNAL_OUTCOME.FAILED,
    companyId: studio,
    closeId,
  }),
)

assert(
  '15. out-of-order protection',
  stale.ignore === true &&
    stale.reason === PROVIDER_REJECTION_REASON.STALE_SIGNAL &&
    applyProviderSignatureSignal(signedClose, {
      providerId: NULL_PROVIDER_ID.SIGNATURE,
      providerKind: PROVIDER_KIND.SIGNATURE,
      outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
      companyId: studio,
      closeId,
      signerDisplayName: 'Client',
    }).result === PROVIDER_APPLY_RESULT.IGNORED,
)

const closedClose = {
  ...close,
  status: COMMERCIAL_CLOSE_STATUS.CLOSED,
  closedAt: '2026-09-07T19:00:00.000Z',
}

assert(
  '16. terminal close protection',
  applyProviderSignatureSignal(closedClose, {
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    providerKind: PROVIDER_KIND.SIGNATURE,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    companyId: studio,
    closeId,
    signerDisplayName: 'Client',
  }).reason === PROVIDER_REJECTION_REASON.TERMINAL_CLOSE &&
    applyProviderPaymentSignal(
      { ...close, status: COMMERCIAL_CLOSE_STATUS.CANCELLED },
      {
        providerId: NULL_PROVIDER_ID.PAYMENT,
        providerKind: PROVIDER_KIND.PAYMENT,
        outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
        companyId: studio,
        closeId,
        amount: decisionTotalExpected,
        currency: 'USD',
      },
    ).reason === PROVIDER_REJECTION_REASON.TERMINAL_CLOSE,
)

assert(
  '17. decision/revision binding',
  mapSignatureSignalToEvidence(close, {
    providerId: NULL_PROVIDER_ID.SIGNATURE,
    providerKind: PROVIDER_KIND.SIGNATURE,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    companyId: studio,
    closeId: 'other-close',
    signerDisplayName: 'Client',
  }).reason === PROVIDER_REJECTION_REASON.BINDING_MISMATCH &&
    mapSignatureSignalToEvidence(close, {
      providerId: NULL_PROVIDER_ID.SIGNATURE,
      providerKind: PROVIDER_KIND.SIGNATURE,
      outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
      companyId: studio,
      closeId,
      signerDisplayName: 'Client',
    }).ok === true &&
    mapSignatureSignalToEvidence(close, {
      providerId: NULL_PROVIDER_ID.SIGNATURE,
      providerKind: PROVIDER_KIND.SIGNATURE,
      outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
      companyId: studio,
      closeId,
      signerDisplayName: 'Client',
    }).evidence.binding.acceptedAt === acceptedAt,
)

const sigMapped = mapSignatureSignalToEvidence(pendingClose, {
  providerId: NULL_PROVIDER_ID.SIGNATURE,
  providerKind: PROVIDER_KIND.SIGNATURE,
  outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
  companyId: studio,
  closeId,
  providerEventId: 'sig-evt-9',
  signerDisplayName: 'Client Signer',
  providerRef: validRef,
  providerOccurredAt: '2026-09-07T17:30:00.000Z',
})

assert(
  '18. signature evidence mapping',
  sigMapped.ok === true &&
    sigMapped.evidence.signerDisplayName === 'Client Signer' &&
    sigMapped.evidence.method === CLOSE_SIGNATURE_METHOD.INTERNAL &&
    sigMapped.evidence.providerEventId === 'sig-evt-9' &&
    sigMapped.evidence.binding.closeId === closeId &&
    makeCloseSignatureEvidence(sigMapped.evidence).providerId ===
      NULL_PROVIDER_ID.SIGNATURE,
)

const payMapped = mapPaymentSignalToEvidence(
  {
    ...close,
    status: COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING,
  },
  {
    providerId: NULL_PROVIDER_ID.PAYMENT,
    providerKind: PROVIDER_KIND.PAYMENT,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    companyId: studio,
    closeId,
    providerEventId: 'pay-evt-9',
    amount: decisionTotalExpected,
    currency: 'USD',
    payerDisplayName: 'Client Payer',
    providerRef: makeProviderRef({
      providerId: NULL_PROVIDER_ID.PAYMENT,
      providerKind: PROVIDER_KIND.PAYMENT,
      externalId: 'pi_test',
    }),
  },
)

assert(
  '19. payment evidence mapping',
  payMapped.ok === true &&
    payMapped.evidence.amount === decisionTotalExpected &&
    payMapped.evidence.currency === 'USD' &&
    payMapped.evidence.method === CLOSE_PAYMENT_METHOD.INTERNAL &&
    payMapped.evidence.providerEventId === 'pay-evt-9' &&
    makeClosePaymentEvidence(payMapped.evidence).providerKind ===
      PROVIDER_KIND.PAYMENT,
)

assert(
  '20. amount/currency protection',
  mapPaymentSignalToEvidence(close, {
    providerId: NULL_PROVIDER_ID.PAYMENT,
    providerKind: PROVIDER_KIND.PAYMENT,
    outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
    companyId: studio,
    closeId,
    amount: decisionTotalExpected,
    currency: 'EUR',
  }).reason === PROVIDER_REJECTION_REASON.CURRENCY_MISMATCH &&
    mapPaymentSignalToEvidence(close, {
      providerId: NULL_PROVIDER_ID.PAYMENT,
      providerKind: PROVIDER_KIND.PAYMENT,
      outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
      companyId: studio,
      closeId,
      amount: decisionTotalExpected * 2,
      currency: 'USD',
    }).reason === PROVIDER_REJECTION_REASON.AMOUNT_MISMATCH,
)

const appliedSig = applyProviderSignatureSignal(pendingClose, {
  providerId: NULL_PROVIDER_ID.SIGNATURE,
  providerKind: PROVIDER_KIND.SIGNATURE,
  outcome: PROVIDER_SIGNAL_OUTCOME.COMPLETED,
  companyId: studio,
  closeId,
  signerDisplayName: 'Client Signer',
  providerEventId: 'sig-evt-apply',
})

assert(
  'vendor completion rejected while flags false (no close mutation)',
  appliedSig.result === PROVIDER_APPLY_RESULT.REJECTED &&
    appliedSig.reason === PROVIDER_REJECTION_REASON.VENDORS_DISABLED &&
    appliedSig.transitionTo === null &&
    appliedSig.mappedEvidence?.signerDisplayName === 'Client Signer',
)

// Internal signature / payment still work
const live = openAcceptedClose()
const requestedSig = requestCommercialCloseSignature({
  companyId: studio,
  closeId: live.created.close.id,
  actor: owner,
})
const completedSig = completeInternalCommercialCloseSignature({
  companyId: studio,
  closeId: live.created.close.id,
  actor: owner,
  signerDisplayName: 'Internal Signer',
  evidenceRef: 'internal-sig-h156',
})
const requestedPay = requestCommercialClosePayment({
  companyId: studio,
  closeId: live.created.close.id,
  actor: owner,
})
const completedPay = completeInternalCommercialClosePayment({
  companyId: studio,
  closeId: live.created.close.id,
  actor: owner,
  payerDisplayName: 'Internal Payer',
  amount: decisionTotalExpected,
  currency: 'USD',
  evidenceRef: 'internal-pay-h156',
})

assert(
  '21. internal signature/payment still work',
  requestedSig.close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING &&
    completedSig.close.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
    completedSig.created === true &&
    requestedPay.close.status === COMMERCIAL_CLOSE_STATUS.PAYMENT_PENDING &&
    completedPay.close.status === COMMERCIAL_CLOSE_STATUS.PAID &&
    completedPay.created === true,
)

const followups = listFollowups().filter(
  (item) =>
    item.proposalId === proposal.id &&
    (item.reason === FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING ||
      item.reason === FOLLOWUP_REASON.CLOSE_PAYMENT_PENDING),
)

assert(
  '29. H13 regression (close follow-ups complete after paid)',
  followups.every((item) => !isOpenFollowupStatus(item.status)),
)

assert(
  'provider config never leaks secrets to client',
  presentClientProviderConfig(
    getCommercialCloseProviderConfig(studio, 'stripe'),
  ).enabled === false &&
    !('apiKeyRef' in presentClientProviderConfig(emptyConfig)) &&
    !('webhookSecretRef' in presentClientProviderConfig(emptyConfig)),
)

assert(
  'unbound provider reference rejected',
  processProviderWebhookFoundation({
    providerKind: PROVIDER_KIND.SIGNATURE,
    providerId: 'unknown_vendor',
    companyId: studio,
    close: null,
    storedProviderRef: null,
    rawBody: '{}',
  }).reason === PROVIDER_REJECTION_REASON.UNKNOWN_PROVIDER,
)

assert(
  'normalize requires server-resolved company',
  normalizeProviderEvent(
    {
      providerId: NULL_PROVIDER_ID.SIGNATURE,
      providerKind: PROVIDER_KIND.SIGNATURE,
      providerEventId: 'n1',
      rawVerified: true,
    },
    { companyId: '', rawVerified: true },
  ).ok === false,
)

assert(
  'schema defaults remain backward compatible',
  makeCommercialClose({
    id: 'cclose-compat',
    companyId: studio,
    proposalId: proposal.id,
    sessionId: 'sess-x',
    decision: close.decision,
  }).signature.providerId == null &&
    makeCloseSignatureEvidence({
      signerDisplayName: 'A',
      binding: { closeId },
    }).providerEventId == null &&
    makeClosePaymentEvidence({
      amount: 1,
      currency: 'USD',
      binding: { closeId },
    }).providerRef == null,
)

assert(
  'no authored proposal mutation',
  JSON.stringify(proposal.blocks) === blocksBefore &&
    proposal.amount === 24000,
)

assert(
  '32. data/proposals.json unchanged',
  proposalsSnapshot() === proposalsBefore,
)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-commercial-close-contract-invoice.mjs',
]
let nestedOk = true
for (const file of suites) {
  const result = runSuite(file)
  assert(`nested ${file}`, result.ok, result.ok ? '' : result.output.slice(-800))
  if (!result.ok) nestedOk = false
}

assert(
  '22-30. H15.1–H15.5 / H14 / H12–H13 / Forge regressions via nested contract-invoice suite',
  nestedOk,
)

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`H15.6 provider adapter checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
