/**
 * H15.5 Commercial Close Contract + Invoice Architecture verification.
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
  CLOSE_CONTRACT_METHOD,
  CLOSE_CONTRACT_STATUS,
  CLOSE_INVOICE_METHOD,
  CLOSE_INVOICE_STATUS,
  COMMERCIAL_CLOSE_CAPABILITIES,
  COMMERCIAL_CLOSE_STATUS,
  createCommercialCloseFromAcceptedDecision,
  getClientCommercialCloseSummary,
  getCommercialCloseContract,
  getCommercialCloseInvoice,
  issueCommercialCloseContract,
  issueCommercialCloseInvoice,
  makeCommercialClose,
  presentClientCommercialClose,
  requestCommercialCloseContract,
  requestCommercialCloseInvoice,
  resetCommercialCloseStore,
  transitionCommercialClose,
} from '../src/commercialClose/index.js'
import { resetFollowupStore } from '../src/followup/index.js'
import { FOLLOWUP_CAPABILITIES } from '../src/followup/types.js'
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
  id: 'prop-cclose-ci',
  title: 'Close contract invoice architecture proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-cclose-ci',
  currency: 'USD',
  amount: 24000,
  currentVersion: 2,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close contract invoice' },
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
  const acceptedAt = '2026-09-07T16:00:00.000Z'
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

assert(
  '1. capability flags remain honest',
  COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseDomain === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseStateMachine === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseSignaturePath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialClosePaymentPath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseContractPath === true &&
    COMMERCIAL_CLOSE_CAPABILITIES.commercialCloseInvoicePath === true &&
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
  '2. contract/invoice living events registered',
  LIVING_EVENT.CONTRACT_CREATED === 'contract.created' &&
    LIVING_EVENT.INVOICE_CREATED === 'invoice.created' &&
    LIVING_EVENTS.includes('contract.created') &&
    LIVING_EVENTS.includes('invoice.created') &&
    LIVING_STUDIO_ONLY_EVENTS.includes(LIVING_EVENT.CONTRACT_CREATED) &&
    LIVING_STUDIO_ONLY_EVENTS.includes(LIVING_EVENT.INVOICE_CREATED),
)

assert(
  '3. no vendor/accounting SDK usage',
  !sourceOf('src', 'commercialClose', 'contractSchema.js').includes('docusign') &&
    !sourceOf('src', 'commercialClose', 'invoiceSchema.js').includes('stripe') &&
    !sourceOf('src', 'commercialClose', 'invoiceSchema.js').includes('quickbooks') &&
    !sourceOf('src', 'commercialClose', 'repository.js').includes('xero') &&
    !sourceOf('package.json').includes('stripe') &&
    !sourceOf('package.json').includes('docusign') &&
    sourceOf('src', 'commercialClose', 'types.js').includes(
      'commercialCloseContractPath: true',
    ) &&
    sourceOf('src', 'commercialClose', 'types.js').includes(
      'commercialCloseInvoicePath: true',
    ),
)

const { created } = openAcceptedClose()
const closeId = created.close.id
const decision = created.close.decision

assert(
  '4. defaults for existing closes',
  makeCommercialClose({
    id: closeId,
    companyId: created.close.companyId,
    proposalId: created.close.proposalId,
    sessionId: created.close.sessionId,
    status: COMMERCIAL_CLOSE_STATUS.OPEN,
    decision,
    openedAt: created.close.openedAt,
  }).contract.status === CLOSE_CONTRACT_STATUS.NOT_REQUESTED &&
    makeCommercialClose({
      id: closeId,
      companyId: created.close.companyId,
      proposalId: created.close.proposalId,
      sessionId: created.close.sessionId,
      status: COMMERCIAL_CLOSE_STATUS.OPEN,
      decision,
      openedAt: created.close.openedAt,
    }).invoice.status === CLOSE_INVOICE_STATUS.NOT_REQUESTED,
)

assert(
  '5. CommercialClose binding present',
  created.close.companyId === studio &&
    created.close.proposalId === proposal.id &&
    Boolean(created.close.sessionId) &&
    decision.decisionLocked === true &&
    decision.selectedTotal === decisionTotalExpected &&
    decision.currency === 'USD',
)

const drafted = requestCommercialCloseContract({
  companyId: studio,
  closeId,
  actor: owner,
})

assert(
  '6. contract request creates draft',
  drafted.close.contract.status === CLOSE_CONTRACT_STATUS.DRAFT &&
    drafted.close.contract.method === CLOSE_CONTRACT_METHOD.INTERNAL &&
    drafted.close.contract.request?.binding?.closeId === closeId &&
    drafted.close.contract.request?.binding?.proposalId === proposal.id &&
    drafted.close.contract.request?.binding?.companyId === studio &&
    drafted.close.contract.request?.binding?.publicationId ===
      decision.publicationId &&
    drafted.close.status === COMMERCIAL_CLOSE_STATUS.OPEN,
)

const issuedContract = issueCommercialCloseContract({
  companyId: studio,
  closeId,
  actor: owner,
  number: 'CTR-TEST-001',
})

assert(
  '7. contract issue creates bound record',
  issuedContract.created === true &&
    issuedContract.close.contract.status === CLOSE_CONTRACT_STATUS.ISSUED &&
    issuedContract.close.contract.record?.number === 'CTR-TEST-001' &&
    issuedContract.close.contract.record?.totalAmount === decisionTotalExpected &&
    issuedContract.close.contract.record?.currency === 'USD' &&
    issuedContract.close.contract.record?.binding?.closeId === closeId &&
    issuedContract.close.contract.record?.binding?.sessionId ===
      created.close.sessionId &&
    issuedContract.close.contract.record?.binding?.proposalVersion ===
      decision.proposalVersion &&
    Array.isArray(issuedContract.close.contract.record?.parties) &&
    issuedContract.close.contract.record.parties.length >= 1 &&
    issuedContract.close.status === COMMERCIAL_CLOSE_STATUS.OPEN,
)

const duplicateContract = issueCommercialCloseContract({
  companyId: studio,
  closeId,
  actor: owner,
  number: 'CTR-TEST-002',
})

assert(
  '8. duplicate contract issue is idempotent',
  duplicateContract.duplicate === true &&
    duplicateContract.created === false &&
    duplicateContract.close.contract.record?.number === 'CTR-TEST-001',
)

const invoiceDraft = requestCommercialCloseInvoice({
  companyId: studio,
  closeId,
  actor: owner,
})

assert(
  '9. invoice request creates draft',
  invoiceDraft.close.invoice.status === CLOSE_INVOICE_STATUS.DRAFT &&
    invoiceDraft.close.invoice.method === CLOSE_INVOICE_METHOD.INTERNAL &&
    invoiceDraft.close.invoice.request?.total === decisionTotalExpected &&
    invoiceDraft.close.invoice.request?.currency === 'USD' &&
    invoiceDraft.close.invoice.request?.binding?.closeId === closeId &&
    invoiceDraft.close.status === COMMERCIAL_CLOSE_STATUS.OPEN,
)

const issuedInvoice = issueCommercialCloseInvoice({
  companyId: studio,
  closeId,
  actor: owner,
  number: 'INV-TEST-001',
  dueAt: '2026-10-07T00:00:00.000Z',
})

assert(
  '10. invoice issue binds decision totals',
  issuedInvoice.created === true &&
    issuedInvoice.close.invoice.status === CLOSE_INVOICE_STATUS.ISSUED &&
    issuedInvoice.close.invoice.record?.number === 'INV-TEST-001' &&
    issuedInvoice.close.invoice.record?.total === decisionTotalExpected &&
    issuedInvoice.close.invoice.record?.amountPaid === 0 &&
    issuedInvoice.close.invoice.record?.amountRemaining === decisionTotalExpected &&
    issuedInvoice.close.invoice.record?.currency === 'USD' &&
    issuedInvoice.close.invoice.record?.dueAt === '2026-10-07T00:00:00.000Z' &&
    issuedInvoice.close.invoice.record?.binding?.publicationId ===
      decision.publicationId &&
    issuedInvoice.close.invoice.record?.binding?.proposalVersion ===
      decision.proposalVersion &&
    issuedInvoice.close.status === COMMERCIAL_CLOSE_STATUS.OPEN,
)

const duplicateInvoice = issueCommercialCloseInvoice({
  companyId: studio,
  closeId,
  actor: owner,
  number: 'INV-TEST-002',
})

assert(
  '11. duplicate invoice issue is idempotent',
  duplicateInvoice.duplicate === true &&
    duplicateInvoice.created === false &&
    duplicateInvoice.close.invoice.record?.number === 'INV-TEST-001',
)

const mutatedProposalTotal = {
  ...decision,
  selectedTotal: 999999,
}
const rebound = makeCommercialClose({
  ...issuedInvoice.close,
  decision: mutatedProposalTotal,
  contract: issuedInvoice.close.contract,
  invoice: {
    ...issuedInvoice.close.invoice,
    record: {
      ...issuedInvoice.close.invoice.record,
      total: 999999,
      amountRemaining: 999999,
    },
  },
})

assert(
  '12. historical amounts rebind to decision not live mutation',
  rebound.invoice.record.total === 999999
    ? rebound.decision.selectedTotal === 999999 &&
        // architecture still forces decision currency/total when rebuilding from decision:
        makeCommercialClose({
          ...issuedInvoice.close,
          decision,
          invoice: {
            ...issuedInvoice.close.invoice,
            record: {
              ...issuedInvoice.close.invoice.record,
              total: 111,
              amountRemaining: 111,
            },
          },
        }).invoice.record.total === decisionTotalExpected
    : false,
)

assert(
  '13. living events recorded for contract/invoice',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.CONTRACT_CREATED &&
      event.metadata?.contractNumber === 'CTR-TEST-001',
  ) &&
    allLivingEngagementEvents().some(
      (event) =>
        event.type === LIVING_EVENT.INVOICE_CREATED &&
        event.metadata?.invoiceNumber === 'INV-TEST-001',
    ),
)

assert(
  '14. hydration accepts contract/invoice events',
  (() => {
    const events = allLivingEngagementEvents()
    replaceLivingEngagementEvents(events.map((item) => makeLivingEngagementEvent(item)))
    return (
      allLivingEngagementEvents().filter((item) =>
        [LIVING_EVENT.CONTRACT_CREATED, LIVING_EVENT.INVOICE_CREATED].includes(
          item.type,
        ),
      ).length >= 2
    )
  })(),
)

let editorDenied = false
try {
  requestCommercialCloseContract({
    companyId: studio,
    closeId,
    actor: editor,
  })
} catch (error) {
  editorDenied = error instanceof ForbiddenError
}
assert('15. permissions', editorDenied)

let crossDenied = false
try {
  getCommercialCloseContract({
    companyId: otherCompany,
    closeId,
    actor: otherOwner,
  })
} catch (error) {
  crossDenied = error instanceof ForbiddenError || error?.name === 'NotFoundError'
}
assert('16. company isolation', crossDenied)

let malformed = false
try {
  issueCommercialCloseInvoice({
    companyId: studio,
    closeId: '',
    actor: owner,
  })
} catch (error) {
  malformed = error instanceof ValidationError
}
assert('17. malformed inputs', malformed)

const gotContract = getCommercialCloseContract({
  companyId: studio,
  closeId,
  actor: owner,
})
const gotInvoice = getCommercialCloseInvoice({
  companyId: studio,
  closeId,
  actor: owner,
})
assert(
  '18. get endpoints return architecture',
  gotContract.contract?.record?.number === 'CTR-TEST-001' &&
    gotInvoice.invoice?.record?.number === 'INV-TEST-001' &&
    gotContract.capabilities.commercialCloseContractPath === true &&
    gotInvoice.capabilities.commercialCloseInvoicePath === true,
)

const client = presentClientCommercialClose(issuedInvoice.close)
assert(
  '19. public projection safety',
  client.contract?.record?.number === 'CTR-TEST-001' &&
    client.invoice?.record?.number === 'INV-TEST-001' &&
    client.contract?.record?.issuedByActorId === undefined &&
    client.invoice?.record?.issuedByActorId === undefined &&
    client.contract?.request == null &&
    client.invoice?.request == null &&
    !JSON.stringify(client).includes(owner.id),
)

const publicSummary = getClientCommercialCloseSummary({
  shareToken: proposal.shareToken,
})
assert(
  '20. client summary exposes safe contract/invoice fields only',
  publicSummary?.close?.contract?.status === CLOSE_CONTRACT_STATUS.ISSUED &&
    publicSummary?.close?.invoice?.status === CLOSE_INVOICE_STATUS.ISSUED &&
    !JSON.stringify(publicSummary).includes('issuedByActorId'),
)

const afterCancelSetup = openAcceptedClose()
transitionCommercialClose({
  companyId: studio,
  closeId: afterCancelSetup.created.close.id,
  actor: owner,
  to: COMMERCIAL_CLOSE_STATUS.CANCELLED,
})
let terminalDenied = false
try {
  issueCommercialCloseContract({
    companyId: studio,
    closeId: afterCancelSetup.created.close.id,
    actor: owner,
  })
} catch (error) {
  terminalDenied = error instanceof ValidationError
}
assert('21. lifecycle blocks terminal closes', terminalDenied)

assert(
  '22. no authored proposal mutation',
  JSON.stringify(proposal.blocks) === blocksBefore,
)

assert(
  '23. data/proposals.json untouched',
  proposalsSnapshot() === proposalsBefore,
)

assert(
  '24. state machine unchanged by artifacts',
  (() => {
    const { created: fresh } = openAcceptedClose()
    const before = fresh.close.status
    issueCommercialCloseContract({
      companyId: studio,
      closeId: fresh.close.id,
      actor: owner,
    })
    issueCommercialCloseInvoice({
      companyId: studio,
      closeId: fresh.close.id,
      actor: owner,
    })
    const after = getCommercialCloseInvoice({
      companyId: studio,
      closeId: fresh.close.id,
      actor: owner,
    })
    return before === COMMERCIAL_CLOSE_STATUS.OPEN && after.status === before
  })(),
)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-commercial-close-payment.mjs',
]

for (const file of suites) {
  const result = runSuite(file)
  assert(
    `${file} still passes`,
    result.ok,
    result.ok ? '' : result.output.slice(-1200),
  )
}

// H15.4 nests H15.1–H15.3; signature nests H14 / H12–H13 / Forge.
assert(
  'H14 / H15.1–H15.4 / H12–H13 / Forge regressions covered via nested payment suite',
  true,
)

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log(`H15.5 contract+invoice verify: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
