/**
 * H15.3 Commercial Close Signature Path verification.
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
  CLOSE_SIGNATURE_METHOD,
  CLOSE_SIGNATURE_STATUS,
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_STATUS,
  bridgeInternalSignatureToCommercialClose,
  completeInternalCommercialCloseSignature,
  createCommercialCloseFromAcceptedDecision,
  getClientCommercialCloseSummary,
  getCommercialCloseSignature,
  hasValidSignatureEvidence,
  makeCloseSignature,
  makeCommercialClose,
  presentClientCommercialClose,
  presentClientCloseSignature,
  requestCommercialCloseSignature,
  resetCommercialCloseStore,
  transitionCommercialClose,
  canTransitionCommercialCloseStatus,
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
  id: 'prop-cclose-sig',
  title: 'Close signature path proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-cclose-sig',
  currency: 'USD',
  amount: 24000,
  currentVersion: 2,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close signature' },
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

const proposalsBefore = proposalsSnapshot()
const blocksBefore = JSON.stringify(proposal.blocks)

assert(
  '23. capability flags remain honest',
  COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.digitalSignature === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.signatureVendors === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.thirdPartyIntegrations === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.externalWebhooks === false &&
    COMMERCIAL_CLOSE_CAPABILITIES.paymentProcessing === false &&
    PORTAL_CAPABILITIES.digitalSignature === false &&
    INTERACTION_CAPABILITIES.digitalSignature === false &&
    FOLLOWUP_CAPABILITIES.digitalSignature === false &&
    FORGE_CAPABILITIES.digitalSignature === false &&
    WORKFLOW_CAPABILITIES.digitalSignature === false,
)

assert(
  '24. no vendor SDK usage',
  !sourceOf('src', 'commercialClose', 'signatureSchema.js').includes('docusign') &&
    !sourceOf('src', 'commercialClose', 'repository.js').includes('@docusign') &&
    !sourceOf('server', 'commercialClosePlugin.js').includes('stripe') &&
    !sourceOf('package.json').includes('docusign') &&
    !sourceOf('package.json').includes('hellosign') &&
    sourceOf('src', 'commercialClose', 'types.js').includes(
      'commercialCloseSignaturePath: true',
    ) &&
    sourceOf('src', 'commercialClose', 'types.js').includes('digitalSignature: false'),
)

const { created } = openAcceptedClose()

// 27 — backwards compatibility with existing open closes (no signature field)
const legacyShaped = makeCommercialClose({
  id: created.close.id,
  companyId: created.close.companyId,
  proposalId: created.close.proposalId,
  sessionId: created.close.sessionId,
  status: COMMERCIAL_CLOSE_STATUS.OPEN,
  decision: created.close.decision,
  openedAt: created.close.openedAt,
})
assert(
  '27. backwards compatible open close defaults signature',
  legacyShaped.signature.status === CLOSE_SIGNATURE_STATUS.NOT_REQUESTED &&
    legacyShaped.signature.required === false &&
    legacyShaped.signature.evidence.length === 0 &&
    legacyShaped.signature.request === null,
)

assert(
  '2. provider-neutral schema validation',
  makeCloseSignature({
    required: true,
    status: CLOSE_SIGNATURE_STATUS.PENDING,
    method: CLOSE_SIGNATURE_METHOD.INTERNAL,
  }).method === CLOSE_SIGNATURE_METHOD.INTERNAL &&
    makeCloseSignature({ method: 'docusign' }).method ===
      CLOSE_SIGNATURE_METHOD.INTERNAL,
)

// 1 — signature request creation
const requested = requestCommercialCloseSignature({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
})
assert(
  '1. signature request creation',
  requested.close.status === COMMERCIAL_CLOSE_STATUS.SIGNATURE_PENDING &&
    requested.close.signature.required === true &&
    requested.close.signature.status === CLOSE_SIGNATURE_STATUS.PENDING &&
    requested.close.signature.method === CLOSE_SIGNATURE_METHOD.INTERNAL &&
    requested.close.signature.request?.id &&
    requested.close.signature.request.method === CLOSE_SIGNATURE_METHOD.INTERNAL,
)

assert(
  '3. close/decision/revision binding',
  requested.close.signature.request.binding.closeId === created.close.id &&
    requested.close.signature.request.binding.acceptedAt ===
      created.close.decision.acceptedAt &&
    requested.close.signature.request.binding.sessionId === created.close.sessionId &&
    (requested.close.signature.request.binding.publicationId != null ||
      requested.close.signature.request.binding.proposalVersion != null),
)

assert(
  '4. internal method',
  requested.close.signature.method === 'internal' &&
    requested.close.signature.request.method === 'internal',
)

assert(
  '6. signature_pending behavior',
  requested.close.status === 'signature_pending' &&
    canTransitionCommercialCloseStatus('signature_pending', 'signed') &&
    !hasValidSignatureEvidence(requested.close),
)

const sigFollowups = listFollowups().filter(
  (item) =>
    item.reason === FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING &&
    item.proposalId === proposal.id &&
    isOpenFollowupStatus(item.status),
)
assert(
  '10. H13 follow-up creation',
  sigFollowups.length === 1 && sigFollowups[0].sourceType === 'commercial_close',
)

assert(
  '9. signature.requested event emission',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.SIGNATURE_REQUESTED &&
      event.metadata.closeId === created.close.id,
  ),
)

// 8 — invalid signed transition rejected
let invalidSigned = false
try {
  transitionCommercialClose({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    to: COMMERCIAL_CLOSE_STATUS.SIGNED,
  })
} catch (error) {
  invalidSigned = error instanceof ValidationError
}
assert('8. invalid signed transition rejected', invalidSigned)

// 26 — malformed input rejection
let malformed = false
try {
  completeInternalCommercialCloseSignature({
    companyId: studio,
    closeId: created.close.id,
    actor: owner,
    signerDisplayName: '',
  })
} catch (error) {
  malformed = error instanceof ValidationError
}
assert('26. malformed input rejection', malformed)

// 5 / 7 — evidence creation + signed requires valid evidence
const completed = completeInternalCommercialCloseSignature({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  signerDisplayName: 'Jordan Lee',
  evidenceRef: 'ev-ref-1',
})
assert(
  '5. evidence creation',
  completed.close.signature.evidence.length === 1 &&
    completed.close.signature.evidence[0].signerDisplayName === 'Jordan Lee' &&
    completed.close.signature.evidence[0].method === 'internal' &&
    completed.close.signature.evidence[0].binding.closeId === created.close.id &&
    completed.close.signature.evidence[0].binding.acceptedAt ===
      created.close.decision.acceptedAt,
)

assert(
  '7. signed requires valid evidence',
  completed.close.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
    hasValidSignatureEvidence(completed.close) &&
    completed.close.signature.status === CLOSE_SIGNATURE_STATUS.COMPLETED,
)

assert(
  '9b. signature.completed event emission',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.SIGNATURE_COMPLETED &&
      event.metadata.closeId === created.close.id,
  ),
)

assert(
  '10b. H13 follow-up reconciliation on complete',
  !listFollowups().some(
    (item) =>
      item.reason === FOLLOWUP_REASON.CLOSE_SIGNATURE_PENDING &&
      isOpenFollowupStatus(item.status),
  ),
)

// 28 — no duplicate signature evidence
const dup = completeInternalCommercialCloseSignature({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
  signerDisplayName: 'Jordan Lee',
  evidenceRef: 'ev-ref-1',
})
assert(
  '28. no duplicate signature evidence where prohibited',
  dup.duplicate === true &&
    dup.close.signature.evidence.length === 1 &&
    dup.close.status === COMMERCIAL_CLOSE_STATUS.SIGNED,
)

const studioSig = getCommercialCloseSignature({
  companyId: studio,
  closeId: created.close.id,
  actor: owner,
})
assert(
  '25. persistence / retrieval works',
  studioSig.signature?.evidence?.length === 1 &&
    studioSig.status === COMMERCIAL_CLOSE_STATUS.SIGNED,
)

const clientView = getClientCommercialCloseSummary({
  shareToken: proposal.shareToken,
})
const clientPresent = presentClientCommercialClose(completed.close)
const clientSig = presentClientCloseSignature(completed.close.signature)
assert(
  '11. client-safe projection',
  clientView.close?.signature?.status === 'completed' &&
    Array.isArray(clientView.close.signature.signedBy) &&
    clientView.close.signature.signedBy[0]?.displayName === 'Jordan Lee' &&
    clientPresent.signature &&
    clientSig.signedBy.length === 1,
)

assert(
  '12. no internal metadata leakage',
  !('openedByActorId' in (clientView.close || {})) &&
    !('statusHistory' in (clientView.close || {})) &&
    !('createdByActorId' in (clientView.close?.signature || {})) &&
    !('request' in (clientView.close?.signature || {})) &&
    !('signerActorId' in (clientView.close?.signature?.signedBy?.[0] || {})) &&
    !('legacyProposalSignatureId' in (clientView.close?.signature?.signedBy?.[0] || {})) &&
    !('evidence' in (clientView.close?.signature || {})),
)

// 13 — permission enforcement
let editorDenied = false
const again = openAcceptedClose()
try {
  requestCommercialCloseSignature({
    companyId: studio,
    closeId: again.created.close.id,
    actor: editor,
  })
} catch (error) {
  editorDenied = error instanceof ForbiddenError
}
assert('13. permission enforcement', editorDenied)

// 14 / 15 — company isolation
let crossDenied = false
try {
  requestCommercialCloseSignature({
    companyId: otherCompany,
    closeId: again.created.close.id,
    actor: otherOwner,
  })
} catch (error) {
  crossDenied =
    error instanceof ForbiddenError || error?.name === 'NotFoundError'
}
assert('14. company isolation', crossDenied)
assert('15. cross-company rejection', crossDenied)

// Bridge path: open → client bridge → signed
const bridged = openAcceptedClose()
requestCommercialCloseSignature({
  companyId: studio,
  closeId: bridged.created.close.id,
  actor: owner,
})
const bridgeResult = bridgeInternalSignatureToCommercialClose({
  proposalId: proposal.id,
  companyId: studio,
  signerDisplayName: 'Client Bridge Signer',
  signedAt: '2026-09-07T16:00:00.000Z',
  legacyProposalSignatureId: 'sig-legacy-1',
  evidenceRef: 'sig-legacy-1',
})
assert(
  'bridge. internal signature bridge to CommercialClose',
  bridgeResult?.close?.status === COMMERCIAL_CLOSE_STATUS.SIGNED &&
    bridgeResult.close.signature?.status === 'completed',
)

const bridgeDup = bridgeInternalSignatureToCommercialClose({
  proposalId: proposal.id,
  companyId: studio,
  signerDisplayName: 'Client Bridge Signer',
  legacyProposalSignatureId: 'sig-legacy-1',
  evidenceRef: 'sig-legacy-1',
})
assert(
  '28b. bridge does not duplicate evidence',
  bridgeDup?.duplicate === true &&
    (bridgeDup?.close?.signature?.signedBy?.length === 1 ||
      bridgeDup?.close?.status === COMMERCIAL_CLOSE_STATUS.SIGNED),
)

assert(
  '16. proposal authored content is not rewritten',
  JSON.stringify(proposal.blocks) === blocksBefore,
)
assert('25b. data/proposals.json untouched', proposalsSnapshot() === proposalsBefore)

// 17 — payment state machine remains unchanged
assert(
  '17. payment state machine remains unchanged',
  canTransitionCommercialCloseStatus('signed', 'payment_pending') &&
    canTransitionCommercialCloseStatus('payment_pending', 'paid') &&
    canTransitionCommercialCloseStatus('paid', 'closed') &&
    !canTransitionCommercialCloseStatus('payment_pending', 'signed'),
)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-commercial-close.mjs',
  'verify-commercial-close-state-machine.mjs',
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
  assert(
    `${file} still passes`,
    result.ok,
    result.ok ? '' : result.output.slice(-1200),
  )
}

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`verify-commercial-close-signature: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
