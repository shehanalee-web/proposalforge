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
import { computeCommercials } from '../src/utils/commercialTotals.js'
import { FOLLOWUP_REASON, FOLLOWUP_REASONS } from '../src/followup/types.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import {
  applyLivingDecisions,
  configureLivingResolvers,
  deriveSelectedCommercialState,
  getLivingClientView,
  getOrCreateLivingSession,
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  onLivingEvent,
  presentLivingProposal,
  resetLivingEventListeners,
  resetLivingStore,
  allLivingSessions,
} from '../src/living/index.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../src/services/errors.js'

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

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

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
  return makeProposal({
    id: extras.id ?? 'prop-session-a',
    title: extras.title ?? 'Harborline website',
    clientName: 'Jordan Lee',
    company: extras.company ?? 'Harborline',
    companyId: extras.companyId ?? DEFAULT_COMPANY_ID,
    status: PROPOSAL_STATUS.SENT,
    shareToken: extras.shareToken ?? 'share-session-a',
    currency: 'USD',
    amount: 24000,
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
const proposalB = proposalWithOffers(
  addOffer(makeOfferGroups(), OFFER_KIND.PACKAGE, {
    id: 'pkg-other',
    title: 'Other package',
    amount: 99,
  }),
  {
    id: 'prop-session-b',
    shareToken: 'share-session-b',
    company: 'Northwind',
    title: 'Northwind rebuild',
  },
)
const proposalEmpty = proposalWithOffers(makeOfferGroups(), {
  id: 'prop-session-empty',
  shareToken: 'share-session-empty',
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
  getProposalById(proposalId) {
    return [...catalog.values()].find((item) => item.id === proposalId) ?? null
  },
})

resetLivingStore([])
const proposalsBefore = proposalsSnapshot()

// 1–3 session create / retrieve / persist
const created = getOrCreateLivingSession(proposalA.shareToken)
const retrieved = getOrCreateLivingSession(proposalA.shareToken)
assert(
  '1. session creation',
  created?.id &&
    created.proposalId === proposalA.id &&
    created.shareToken === proposalA.shareToken &&
    created.selectedPackageId === null &&
    created.selectedAlternativeId === null &&
    created.selectedAddonIds.length === 0,
)
assert(
  '2. session retrieval',
  retrieved.id === created.id &&
    retrieved.proposalId === created.proposalId &&
    allLivingSessions().length === 1,
)

applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
})
const afterPersist = getOrCreateLivingSession(proposalA.shareToken)
assert(
  '3. session persistence',
  afterPersist.id === created.id && afterPersist.selectedPackageId === 'pkg-essential',
)

// 4–5 package selection + exclusivity
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})
const afterPackage = getOrCreateLivingSession(proposalA.shareToken)
assert('4. package selection', afterPackage.selectedPackageId === 'pkg-premium')
assert(
  '5. package exclusivity',
  afterPackage.selectedPackageId === 'pkg-premium' &&
    afterPackage.selectedPackageId !== 'pkg-essential',
)

// 6–7 alternative selection + exclusivity
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAlternativeId: 'alt-a',
})
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedAlternativeId: 'alt-b',
})
const afterAlt = getOrCreateLivingSession(proposalA.shareToken)
assert('6. alternative selection', afterAlt.selectedAlternativeId === 'alt-b')
assert(
  '7. alternative exclusivity',
  afterAlt.selectedAlternativeId === 'alt-b' &&
    afterAlt.selectedAlternativeId !== 'alt-a',
)

// 8–9 add-on toggle + multiple
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  toggleAddonId: 'oadd-walk',
})
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  toggleAddonId: 'oadd-boards',
})
const afterAddons = getOrCreateLivingSession(proposalA.shareToken)
assert(
  '8. add-on toggle',
  afterAddons.selectedAddonIds.includes('oadd-walk') &&
    afterAddons.selectedAddonIds.includes('oadd-boards'),
)
assert(
  '9. multiple add-ons',
  afterAddons.selectedAddonIds.length === 2 &&
    afterAddons.selectedPackageId === 'pkg-premium' &&
    afterAddons.selectedAlternativeId === 'alt-b',
)

// 10 disabled offer rejection
let disabledRejected = false
try {
  applyLivingDecisions({
    shareToken: proposalA.shareToken,
    toggleAddonId: 'oadd-model',
  })
} catch (error) {
  disabledRejected = error instanceof ValidationError
}
assert('10. disabled offer rejection', disabledRejected)

// 11 unknown offer rejection
let unknownRejected = false
try {
  applyLivingDecisions({
    shareToken: proposalA.shareToken,
    selectedPackageId: 'pkg-does-not-exist',
  })
} catch (error) {
  unknownRejected = error instanceof ValidationError
}
assert('11. unknown offer rejection', unknownRejected)

// 12 derived total
const commercial = deriveSelectedCommercialState(
  proposalA,
  getOrCreateLivingSession(proposalA.shareToken),
)
assert(
  '12. derived total calculation',
  commercial.selectedPackageId === 'pkg-premium' &&
    commercial.packageAmount === 32000 &&
    commercial.alternativeAmount === 3500 &&
    commercial.addonsAmount === 2300 &&
    commercial.selectedTotal === 37800 &&
    commercial.baseGrandTotal === computeCommercials(modules).grandTotal,
)

// 13–14 authored proposal unchanged
const pricing = proposalA.blocks.find((block) => block.type === BLOCK_TYPE.PRICING)
assert(
  '13. authored proposal remains unchanged',
  pricing.data.offers.packages[0].title === 'Essential' &&
    pricing.data.offers.packages[0].amount === 18000 &&
    proposalA.items[0].amount === 24000 &&
    proposalsSnapshot() === proposalsBefore,
)
assert(
  '14. pricing line amounts remain unchanged',
  pricing.data.modules[0].items[0].unitPrice === 24000 &&
    pricing.data.modules[1].items[0].unitPrice === 1200,
)

// 15 no second proposal store
assert(
  '15. no second proposal store',
  sourceOf('server', 'livingPlugin.js').includes('living.json') &&
    !sourceOf('server', 'livingPlugin.js').includes('writeJson(proposalsFile') &&
    sourceOf('server', 'livingPlugin.js').includes('Never writes `data/proposals.json`') &&
    !sourceOf('src', 'living', 'schema.js').includes('blocks:') &&
    allLivingSessions().every((session) => !('blocks' in session) && !('items' in session)),
)

// 16–19 no H13 / analytics / Forge / Rive
const livingRepo = sourceOf('src', 'living', 'repository.js')
const livingPlugin = sourceOf('server', 'livingPlugin.js')
assert(
  '16. H13 commercial selection is wired without proposal writes',
  FOLLOWUP_REASONS.includes('commercial_selection') &&
    'COMMERCIAL_SELECTION' in FOLLOWUP_REASON &&
    livingRepo.includes('reconcileLivingCommercialSelectionFollowup') &&
    livingPlugin.includes('followups.json') &&
    !livingPlugin.includes('/api/followups'),
)
assert(
  '17. no analytics persistence',
  LIVING_CAPABILITIES.commercialEvents === true &&
    !livingPlugin.includes('activityEvents') &&
    !livingRepo.includes('activityEvent') &&
    !sourceOf('src', 'living', 'events.js').includes('writeFile'),
)
assert(
  '18. studio Forge enabled; client portal has no Forge UI',
  LIVING_CAPABILITIES.forgeActions === true &&
    LIVING_CAPABILITIES.rive === false &&
    !sourceOf('src', 'portal', 'PortalApp.jsx').includes('Forge') &&
    !sourceOf('src', 'portal', 'PortalApp.jsx').includes('/api/forge'),
)
assert(
  '19. no Rive',
  LIVING_CAPABILITIES.rive === false &&
    !sourceOf('src', 'living', 'types.js').includes('.riv') &&
    !sourceOf('src', 'portal', 'PortalApp.jsx').includes('rive'),
)

// 20 unpublished proposals stay authored-compatible (no fake snapshot)
const view = getLivingClientView({ shareToken: proposalA.shareToken })
assert(
  '20. unpublished proposals stay authored-compatible',
  LIVING_CAPABILITIES.snapshots === true &&
    view.publication.snapshot === false &&
    view.publication.revision === null &&
    view.publication.source === 'authored' &&
    livingPlugin.includes('/publish') &&
    livingPlugin.includes('living-publications.json'),
)

// 21 capability flags
assert(
  '21. capability flags',
  LIVING_CAPABILITIES.packages === true &&
    LIVING_CAPABILITIES.addons === true &&
    LIVING_CAPABILITIES.alternatives === true &&
    LIVING_CAPABILITIES.selections === true &&
    LIVING_CAPABILITIES.livingSession === true &&
    LIVING_CAPABILITIES.commercialEvents === true &&
    LIVING_CAPABILITIES.snapshots === true &&
    LIVING_CAPABILITIES.h12Interactions === true &&
    LIVING_CAPABILITIES.commercialSelectionFollowup === true &&
    LIVING_CAPABILITIES.forgeActions === true &&
    LIVING_CAPABILITIES.rive === false &&
    view.capabilities === LIVING_CAPABILITIES,
)

// 22 client UI read-only except selections
const offerDoc = sourceOf('src', 'components', 'CommercialBuilder', 'OfferDocument.jsx')
const portalApp = sourceOf('src', 'portal', 'PortalApp.jsx')
assert(
  '22. client UI is read-only except selections',
  portalApp.includes('data-readonly="true"') &&
    portalApp.includes('LivingSessionProvider') &&
    offerDoc.includes('data-offer-selectable="true"') &&
    offerDoc.includes('data-offer-selectable="false"') &&
    !offerDoc.includes('data-offer-authoring') &&
    sourceOf('src', 'components', 'CommercialBuilder', 'OfferAuthoring.jsx').includes(
      'data-offer-authoring="true"',
    ) &&
    !portalApp.includes('OfferAuthoring'),
)

// 23 session isolation
getOrCreateLivingSession(proposalB.shareToken)
applyLivingDecisions({
  shareToken: proposalB.shareToken,
  selectedPackageId: 'pkg-other',
})
const sessionA = getOrCreateLivingSession(proposalA.shareToken)
const sessionB = getOrCreateLivingSession(proposalB.shareToken)
assert(
  '23. session isolation',
  sessionA.id !== sessionB.id &&
    sessionA.shareToken !== sessionB.shareToken &&
    sessionA.selectedPackageId === 'pkg-premium' &&
    sessionB.selectedPackageId === 'pkg-other' &&
    sessionA.selectedAddonIds.includes('oadd-walk') &&
    sessionB.selectedAddonIds.length === 0,
)

// 24 cross-proposal rejection
let crossRejected = false
try {
  applyLivingDecisions({
    shareToken: proposalA.shareToken,
    selectedPackageId: 'pkg-other',
  })
} catch (error) {
  crossRejected = error instanceof ValidationError
}
let missingRejected = false
try {
  getLivingClientView({ shareToken: 'share-does-not-exist' })
} catch (error) {
  missingRejected = error instanceof NotFoundError
}
assert(
  '24. cross-proposal rejection',
  crossRejected &&
    missingRejected &&
    sessionA.proposalId !== sessionB.proposalId,
)

// 25 backward compatibility — no offers
const emptyLiving = presentLivingProposal(proposalEmpty)
const emptyView = getLivingClientView({ shareToken: proposalEmpty.shareToken })
assert(
  '25. backward compatibility for proposals with no offers',
  emptyLiving.authoredOffers.packages.length === 0 &&
    emptyLiving.commercialState === null &&
    emptyView.commercialState === null &&
    emptyView.session?.selectedPackageId === null &&
    emptyView.sections.length >= 1,
)

// Spoofed client amount ignored
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
  amount: 1,
  selectedTotal: 2,
  packageAmount: 3,
})
const ignoredAmount = deriveSelectedCommercialState(
  proposalA,
  getOrCreateLivingSession(proposalA.shareToken),
)
assert(
  'Client-supplied amounts are ignored',
  ignoredAmount.packageAmount === 18000 &&
    ignoredAmount.selectedTotal === 18000 + ignoredAmount.alternativeAmount + ignoredAmount.addonsAmount,
)

// Disabled ids normalize away on retrieve
resetLivingStore([
  {
    id: 'lsess-stale',
    proposalId: proposalA.id,
    shareToken: proposalA.shareToken,
    selectedPackageId: 'pkg-gone',
    selectedAlternativeId: 'alt-gone',
    selectedAddonIds: ['oadd-model', 'oadd-walk'],
  },
])
const normalized = getOrCreateLivingSession(proposalA.shareToken)
assert(
  'Invalid/disabled offer ids normalize away',
  normalized.selectedPackageId === null &&
    normalized.selectedAlternativeId === null &&
    normalized.selectedAddonIds.length === 1 &&
    normalized.selectedAddonIds[0] === 'oadd-walk',
)

// Events emit in-memory only (no Phase 4 persistence)
resetLivingEventListeners()
const events = []
const stop = onLivingEvent((event) => events.push(event))
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})
stop()
assert(
  'Selection events stay in-memory extension points',
  events.some((event) => event.type === LIVING_EVENT.PACKAGE_SELECTED) &&
    !livingPlugin.includes('activityEvents.json') &&
    LIVING_CAPABILITIES.commercialEvents === true,
)

// Forbidden path sanity
let forbiddenUnused = true
try {
  void ForbiddenError
} catch {
  forbiddenUnused = false
}
assert('Error types available for isolation', forbiddenUnused && Boolean(ForbiddenError))

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
