/**
 * H14 Phase 6 — Living commercial selection → H13 COMMERCIAL_SELECTION.
 *
 * Never writes data/proposals.json. Follow-ups stay in the H13 store.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import {
  COMMERCIAL_MODULE,
  makeAddonLine,
  makeCommercialLine,
  makeCommercialModule,
} from '../src/models/commercial.js'
import {
  OFFER_KIND,
  addOffer,
  makeOfferGroups,
} from '../src/models/offer.js'
import { makeProposal, PROPOSAL_STATUS } from '../src/models/proposal.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { ValidationError, ForbiddenError } from '../src/services/errors.js'
import { getWorkflowActor } from '../src/workflow/actors.js'
import { resetWorkflowStore } from '../src/workflow/index.js'
import { resetPortalStore } from '../src/portal/index.js'
import { resetInteractionStore } from '../src/interactions/index.js'
import {
  FOLLOWUP_CAPABILITIES,
  FOLLOWUP_ISOLATION_COMPANY_ID,
  FOLLOWUP_REASON,
  FOLLOWUP_REASON_ACTIONS,
  FOLLOWUP_REASON_LABELS,
  FOLLOWUP_SOURCE,
  FOLLOWUP_STATUS,
  allFollowupRecords,
  clientFollowupApiDenied,
  completeFollowup,
  configureFollowupResolvers,
  dismissFollowup,
  evaluateFollowupSignals,
  listStudioFollowups,
  resetFollowupResolvers,
  resetFollowupStore,
  syncFollowupsForProposal,
} from '../src/followup/index.js'
import {
  LIVING_CAPABILITIES,
  applyLivingDecisions,
  configureLivingResolvers,
  getOrCreateLivingSession,
  presentLivingSession,
  reconcileLivingCommercialSelectionFollowup,
  resetLivingEventStore,
  resetLivingStore,
  allLivingSessions,
} from '../src/living/index.js'

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

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
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
    status: result.status,
  }
}

function commercialOpen(records, proposalId) {
  return (records ?? []).filter(
    (item) =>
      item.proposalId === proposalId &&
      item.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION &&
      (item.status === FOLLOWUP_STATUS.OPEN || item.status === FOLLOWUP_STATUS.IN_PROGRESS),
  )
}

function commercialAll(records, proposalId) {
  return (records ?? []).filter(
    (item) =>
      item.proposalId === proposalId && item.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION,
  )
}

const studio = DEFAULT_COMPANY_ID
const other = FOLLOWUP_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor('user-studio-sarah')
const lee = getWorkflowActor('user-harborline-lee')
const now = Date.parse('2026-09-06T12:00:00.000Z')

const tableLine = makeCommercialLine({
  id: 'line-web',
  description: 'Website',
  quantity: 1,
  unitPrice: 24000,
})
const addonLine = makeAddonLine({
  id: 'line-host',
  description: 'Hosting',
  quantity: 1,
  unitPrice: 1200,
  included: false,
})
const modules = [
  makeCommercialModule({
    id: 'mod-table',
    type: COMMERCIAL_MODULE.TABLE,
    items: [tableLine],
  }),
  makeCommercialModule({
    id: 'mod-addons',
    type: COMMERCIAL_MODULE.ADDONS,
    items: [addonLine],
  }),
]

function proposalWithOffers(offers, extras = {}) {
  const proposal = makeProposal({
    id: extras.id ?? 'prop-cs-a',
    title: extras.title ?? 'Harborline website',
    clientName: 'Jordan Lee',
    company: extras.company ?? 'Harborline',
    status: PROPOSAL_STATUS.SENT,
    shareToken: extras.shareToken ?? 'share-cs-a',
    currency: 'USD',
    amount: 24000,
    lastViewedAt: new Date(now - 60_000).toISOString(),
    lastEmail: { sentAt: new Date(now - 120_000).toISOString() },
    items: [{ id: 'legacy-1', description: 'Website', amount: 24000 }],
    blocks: [
      makeBlock({
        id: 'blk-cover',
        type: BLOCK_TYPE.COVER,
        data: { heading: extras.title ?? 'Harborline website' },
      }),
      makeBlock({
        id: 'blk-pricing',
        type: BLOCK_TYPE.PRICING,
        data: {
          modules,
          notes: '',
          offers: makeOfferGroups(offers),
        },
      }),
    ],
  })
  proposal.companyId = extras.companyId ?? studio
  return proposal
}

let offers = makeOfferGroups()
offers = addOffer(offers, OFFER_KIND.PACKAGE, {
  id: 'pkg-essential',
  title: 'Essential',
  amount: 18000,
})
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
offers = addOffer(offers, OFFER_KIND.ADDON, {
  id: 'oadd-boards',
  title: 'Additional Presentation Boards',
  amount: 800,
})
offers = addOffer(offers, OFFER_KIND.ADDON, {
  id: 'oadd-model',
  title: 'Physical Model',
  amount: 2200,
  enabled: false,
})
offers = addOffer(offers, OFFER_KIND.ALTERNATIVE, {
  id: 'alt-a',
  title: 'Option A',
  amount: 2000,
})
offers = addOffer(offers, OFFER_KIND.ALTERNATIVE, {
  id: 'alt-b',
  title: 'Option B',
  amount: 3500,
})

const proposalA = proposalWithOffers(offers)
const proposalB = proposalWithOffers(offers, {
  id: 'prop-cs-b',
  shareToken: 'share-cs-b',
  companyId: other,
  company: 'Northwind',
  title: 'Northwind rebuild',
})
const proposalEmpty = proposalWithOffers(makeOfferGroups(), {
  id: 'prop-cs-empty',
  shareToken: 'share-cs-empty',
  title: 'No offers yet',
})

const catalog = new Map([
  [proposalA.shareToken, proposalA],
  [proposalB.shareToken, proposalB],
  [proposalEmpty.shareToken, proposalEmpty],
])

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

configureFollowupResolvers({
  getProposal(proposalId, companyId) {
    const found = [...catalog.values()].find((item) => item.id === proposalId) ?? null
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
  listProposals(companyId) {
    return [...catalog.values()].filter((item) => {
      const ownedBy = String(item.companyId ?? studio).trim() || studio
      return ownedBy === companyId
    })
  },
  getLivingSession(companyId, proposalId) {
    return (
      allLivingSessions().find(
        (item) => item.proposalId === proposalId && item.companyId === companyId,
      ) ?? null
    )
  },
})

resetLivingStore([])
resetLivingEventStore([])
resetFollowupStore()
resetWorkflowStore()
resetPortalStore()
resetInteractionStore()

const proposalsBefore = proposalsSnapshot()

function listCommercial(proposalId, companyId = studio, actor = sarah) {
  return listStudioFollowups({
    companyId,
    proposalId,
    actor,
    now,
    sync: false,
  }).filter((item) => item.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION)
}

// 1 package selection creates COMMERCIAL_SELECTION
getOrCreateLivingSession(proposalA.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})
let open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
assert(
  '1. valid package selection creates COMMERCIAL_SELECTION',
  open.length === 1 &&
    open[0].sourceType === FOLLOWUP_SOURCE.LIVING &&
    open[0].status === FOLLOWUP_STATUS.OPEN &&
    open[0].title === FOLLOWUP_REASON_ACTIONS[FOLLOWUP_REASON.COMMERCIAL_SELECTION] &&
    /Premium/i.test(open[0].description) &&
    FOLLOWUP_REASON_LABELS[FOLLOWUP_REASON.COMMERCIAL_SELECTION] === 'Commercial selection',
)

// 2 alternative selection
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalA.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAlternativeId: 'alt-a',
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
assert(
  '2. valid alternative selection creates COMMERCIAL_SELECTION',
  open.length === 1 && /Option A/i.test(open[0].description),
)

// 3 add-on selection
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalA.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAddonIds: ['oadd-walk'],
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
assert(
  '3. valid add-on selection creates COMMERCIAL_SELECTION',
  open.length === 1 && /3D Walkthrough/i.test(open[0].description),
)

// 4 multiple add-ons
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAddonIds: ['oadd-walk', 'oadd-boards'],
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
assert(
  '4. multiple add-ons behave correctly',
  open.length === 1 &&
    /3D Walkthrough/i.test(open[0].description) &&
    /Additional Presentation Boards/i.test(open[0].description),
)

// 5 repeated same selection — no duplicate open
const beforeRepeat = open[0].id
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAddonIds: ['oadd-walk', 'oadd-boards'],
})
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAddonIds: ['oadd-walk', 'oadd-boards'],
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
assert(
  '5. repeated same selection does not create duplicate open follow-up',
  open.length === 1 && open[0].id === beforeRepeat,
)

// 6 changed selection updates open record (history rules)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
  selectedAddonIds: [],
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
const afterPremium = open[0]
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
assert(
  '6. changed selection follows deterministic history rules',
  open.length === 1 &&
    open[0].id === afterPremium.id &&
    /Essential/i.test(open[0].description) &&
    !/Premium/i.test(open[0].description),
)

// 7 completed history preserved
const completed = completeFollowup({
  companyId: studio,
  followupId: open[0].id,
  actor: sarah,
  now,
})
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})
const afterComplete = commercialAll(listCommercial(proposalA.id), proposalA.id)
assert(
  '7. completed follow-up history is preserved',
  completed.status === FOLLOWUP_STATUS.COMPLETED &&
    afterComplete.some((item) => item.id === completed.id && item.status === FOLLOWUP_STATUS.COMPLETED) &&
    commercialOpen(afterComplete, proposalA.id).length === 0,
)

// 8 dismissed history preserved
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalA.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
const dismissed = dismissFollowup({
  companyId: studio,
  followupId: open[0].id,
  actor: sarah,
  now,
})
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
})
const afterDismiss = commercialAll(listCommercial(proposalA.id), proposalA.id)
assert(
  '8. dismissed follow-up history is preserved',
  dismissed.status === FOLLOWUP_STATUS.DISMISSED &&
    afterDismiss.some((item) => item.id === dismissed.id && item.status === FOLLOWUP_STATUS.DISMISSED) &&
    commercialOpen(afterDismiss, proposalA.id).length === 0,
)

// 9–13 invalid / disabled / malformed — no new signal (fresh proposal)
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalA.shareToken)
const countBeforeInvalid = allFollowupRecords().length

assert(
  '9. invalid package ID does not create signal',
  throws(
    () =>
      applyLivingDecisions({
        shareToken: proposalA.shareToken,
        selectedPackageId: 'pkg-does-not-exist',
      }),
    ValidationError,
  ) &&
    commercialOpen(listCommercial(proposalA.id), proposalA.id).length === 0 &&
    allFollowupRecords().length === countBeforeInvalid,
)

assert(
  '10. invalid alternative ID does not create signal',
  throws(
    () =>
      applyLivingDecisions({
        shareToken: proposalA.shareToken,
        selectedAlternativeId: 'alt-missing',
      }),
    ValidationError,
  ) && commercialOpen(listCommercial(proposalA.id), proposalA.id).length === 0,
)

assert(
  '11. invalid add-on ID does not create signal',
  throws(
    () =>
      applyLivingDecisions({
        shareToken: proposalA.shareToken,
        selectedAddonIds: ['oadd-missing'],
      }),
    ValidationError,
  ) && commercialOpen(listCommercial(proposalA.id), proposalA.id).length === 0,
)

assert(
  '12. disabled/unknown offer does not create signal',
  throws(
    () =>
      applyLivingDecisions({
        shareToken: proposalA.shareToken,
        selectedAddonIds: ['oadd-model'],
      }),
    ValidationError,
  ) && commercialOpen(listCommercial(proposalA.id), proposalA.id).length === 0,
)

assert(
  '13. malformed selection does not create signal',
  throws(
    () =>
      applyLivingDecisions({
        shareToken: proposalA.shareToken,
        selectedAddonIds: 'not-an-array',
      }),
    ValidationError,
  ) && commercialOpen(listCommercial(proposalA.id), proposalA.id).length === 0,
)

// 14 client amount ignored — selection still works; amount not in follow-up
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
  amount: 1,
  total: 2,
  selectedTotal: 3,
  packageAmount: 4,
})
open = commercialOpen(listCommercial(proposalA.id), proposalA.id)
const session = getOrCreateLivingSession(proposalA.shareToken)
assert(
  '14. client amount is ignored',
  open.length === 1 &&
    session.selectedPackageId === 'pkg-premium' &&
    !String(open[0].description).includes('1') &&
    !String(JSON.stringify(open[0])).includes('"amount":1') &&
    presentLivingSession(session).selectedPackageId === 'pkg-premium',
)

// 15 company isolation
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalA.shareToken)
getOrCreateLivingSession(proposalB.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})
applyLivingDecisions({
  shareToken: proposalB.shareToken,
  selectedPackageId: 'pkg-essential',
})
const studioList = listCommercial(proposalA.id, studio, sarah)
const otherList = listCommercial(proposalB.id, other, lee)
const studioSeesB = listStudioFollowups({
  companyId: studio,
  actor: sarah,
  now,
  sync: false,
}).some((item) => item.proposalId === proposalB.id)
const crossAsStudioCompany = (() => {
  try {
    completeFollowup({
      companyId: studio,
      followupId: otherList[0]?.id,
      actor: sarah,
      now,
    })
    return false
  } catch (error) {
    return error instanceof ForbiddenError || error?.name === 'NotFoundError'
  }
})()
const crossAsOtherActor = (() => {
  try {
    completeFollowup({
      companyId: other,
      followupId: otherList[0]?.id,
      actor: sarah,
      now,
    })
    return false
  } catch (error) {
    return error instanceof ForbiddenError
  }
})()
assert(
  '15. company A cannot touch company B follow-ups',
  studioList.length === 1 &&
    otherList.length === 1 &&
    studioList[0].companyId === studio &&
    otherList[0].companyId === other &&
    !studioSeesB &&
    crossAsStudioCompany &&
    crossAsOtherActor,
)

// 16 public client cannot read follow-ups
const portalSource = sourceOf('src', 'portal', 'PortalApp.jsx')
const livingProvider = sourceOf('src', 'living', 'LivingSessionProvider.jsx')
assert(
  '16. public client cannot read follow-ups',
  throws(() => clientFollowupApiDenied(), ForbiddenError) &&
    !portalSource.toLowerCase().includes('followup') &&
    !livingProvider.toLowerCase().includes('followup') &&
    sourceOf('server', 'livingPlugin.js').includes('Never writes `data/proposals.json`'),
)

// 17 follow-up failure does not break selection
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalA.shareToken)
configureFollowupResolvers({
  getProposal() {
    throw new Error('follow-up store offline')
  },
  listProposals() {
    throw new Error('follow-up store offline')
  },
  getLivingSession() {
    throw new Error('follow-up store offline')
  },
})
let selectionOk = false
try {
  applyLivingDecisions({
    shareToken: proposalA.shareToken,
    selectedPackageId: 'pkg-premium',
  })
  selectionOk = getOrCreateLivingSession(proposalA.shareToken).selectedPackageId === 'pkg-premium'
} catch {
  selectionOk = false
}
const reconcileNull = reconcileLivingCommercialSelectionFollowup({
  companyId: studio,
  proposalId: proposalA.id,
})
assert(
  '17. follow-up failure does not break selection',
  selectionOk && reconcileNull === null && allFollowupRecords().length === 0,
)

// restore resolvers
configureFollowupResolvers({
  getProposal(proposalId, companyId) {
    const found = [...catalog.values()].find((item) => item.id === proposalId) ?? null
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
  listProposals(companyId) {
    return [...catalog.values()].filter((item) => {
      const ownedBy = String(item.companyId ?? studio).trim() || studio
      return ownedBy === companyId
    })
  },
  getLivingSession(companyId, proposalId) {
    return (
      allLivingSessions().find(
        (item) => item.proposalId === proposalId && item.companyId === companyId,
      ) ?? null
    )
  },
})

// 18–19 proposal content / proposals.json unchanged
assert(
  '18. proposal content remains unchanged',
  proposalA.blocks.find((b) => b.type === BLOCK_TYPE.PRICING)?.data?.offers?.packages?.length ===
    2 &&
    catalog.get(proposalA.shareToken) === proposalA,
)
assert(
  '19. data/proposals.json is not written',
  proposalsSnapshot() === proposalsBefore &&
    !sourceOf('src', 'living', 'signals.js').includes("data/proposals.json") &&
    !sourceOf('src', 'followup', 'repository.js').includes('writeFileSync') &&
    sourceOf('server', 'livingPlugin.js').includes("join(dataDir, 'followups.json')"),
)

// 20 no second follow-up persistence model
assert(
  '20. no second follow-up persistence model',
  !sourceOf('src', 'living', 'signals.js').includes('commercialFollowupStore') &&
    !sourceOf('src', 'living', 'repository.js').includes('livingFollowupStore') &&
    sourceOf('src', 'living', 'signals.js').includes('syncFollowupsForProposal') &&
    FOLLOWUP_CAPABILITIES.commercialSelection === true &&
    LIVING_CAPABILITIES.commercialSelectionFollowup === true,
)

// Deterministic signal evaluation without UI
const sessionFresh = getOrCreateLivingSession(proposalA.shareToken)
const signals = evaluateFollowupSignals({
  proposal: proposalA,
  livingSession: sessionFresh,
  now,
})
const signalsAgain = evaluateFollowupSignals({
  proposal: proposalA,
  livingSession: sessionFresh,
  now,
})
assert(
  'bonus. evaluateFollowupSignals is deterministic for COMMERCIAL_SELECTION',
  JSON.stringify(signals) === JSON.stringify(signalsAgain) &&
    signals.some((item) => item.reason === FOLLOWUP_REASON.COMMERCIAL_SELECTION),
)

// Empty offers / opening alone does not create commercial signal
resetFollowupStore()
resetLivingStore([])
getOrCreateLivingSession(proposalEmpty.shareToken)
syncFollowupsForProposal({
  companyId: studio,
  proposalId: proposalEmpty.id,
  actor: sarah,
  now,
})
assert(
  'bonus. opening / empty offers do not create COMMERCIAL_SELECTION',
  commercialOpen(listCommercial(proposalEmpty.id), proposalEmpty.id).length === 0,
)

// Capability surface
assert(
  'bonus. capability flags honest',
  LIVING_CAPABILITIES.commercialSelectionFollowup === true &&
    FOLLOWUP_CAPABILITIES.commercialSelection === true &&
    LIVING_CAPABILITIES.forgeActions === true &&
    LIVING_CAPABILITIES.decisionSnapshots === true &&
    LIVING_CAPABILITIES.rive === false &&
    FOLLOWUP_CAPABILITIES.whatsapp === false &&
    FOLLOWUP_CAPABILITIES.crm === false &&
    FOLLOWUP_CAPABILITIES.emailDelivery === false &&
    FOLLOWUP_CAPABILITIES.digitalSignature === false &&
    FOLLOWUP_CAPABILITIES.paymentProcessing === false,
)

console.log('')
console.log('— Regression suites —')

const suites = [
  'verify-followup.mjs',
  'verify-living-session.mjs',
  'verify-living-events.mjs',
  'verify-living-interactions.mjs',
  'verify-living-publication.mjs',
  'verify-workflow.mjs',
  'verify-living.mjs',
  'verify-offer-authoring.mjs',
]

for (const file of suites) {
  const result = runSuite(file)
  assert(`${file} still passes`, result.ok, result.ok ? '' : result.output.slice(-800))
}

assert(
  'final. proposals.json still untouched',
  proposalsSnapshot() === proposalsBefore,
)

resetFollowupResolvers()

console.log('')
console.log(`verify-living-commercial-selection: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
