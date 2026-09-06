import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import {
  COMMERCIAL_MODULE,
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
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'
import { ValidationError, NotFoundError } from '../src/services/errors.js'
import {
  LIVING_CAPABILITIES,
  applyLivingDecisions,
  allLivingPublications,
  configureLivingResolvers,
  getLivingClientView,
  getLivingPublicationState,
  getLivingSnapshot,
  getOrCreateLivingSession,
  insertLivingPublication,
  listLivingSnapshots,
  makeLivingPublication,
  publishLivingProposal,
  recordLivingEngagementEvent,
  replaceLivingPublications,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
  LIVING_EVENT,
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

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

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
]

let offers = makeOfferGroups()
offers = addOffer(offers, OFFER_KIND.PACKAGE, {
  id: 'pkg-essential',
  title: 'Essential',
  amount: 18000,
})
offers = addOffer(offers, OFFER_KIND.ADDON, {
  id: 'oadd-walk',
  title: '3D Walkthrough',
  amount: 1500,
})

const proposalA = makeProposal({
  id: 'prop-pub-a',
  title: 'Publication A',
  clientName: 'Jordan',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-pub-a',
  amount: 24000,
  currentVersion: 2,
  items: [{ id: 'legacy-1', description: 'Website', amount: 24000 }],
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Publication A' },
    }),
    makeBlock({
      id: 'blk-pricing',
      type: BLOCK_TYPE.PRICING,
      data: { modules, notes: '', offers },
    }),
  ],
})
proposalA.companyId = DEFAULT_COMPANY_ID

const proposalB = makeProposal({
  id: 'prop-pub-b',
  title: 'Publication B',
  clientName: 'Sam',
  company: 'Northwind',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-pub-b',
  blocks: [
    makeBlock({
      id: 'blk-cover-b',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Publication B' },
    }),
  ],
})
proposalB.companyId = WORKFLOW_ISOLATION_COMPANY_ID

const catalog = new Map([
  [proposalA.shareToken, proposalA],
  [proposalB.shareToken, proposalB],
])

configureLivingResolvers({
  getProposalByShareToken(token) {
    return catalog.get(String(token ?? '').trim()) ?? null
  },
  getProposalById(proposalId, companyId) {
    const found = [...catalog.values()].find((item) => item.id === proposalId)
    if (!found) return null
    if (companyId && found.companyId !== companyId) return null
    return found
  },
})

resetLivingStore([])
resetLivingEventStore([])
resetLivingPublicationStore([])
const proposalsBefore = proposalsSnapshot()

// 19 empty/no-publication remains compatible
const unpublishedView = getLivingClientView({ shareToken: proposalA.shareToken })
assert(
  '19. empty/no-publication proposals remain compatible',
  unpublishedView.publication.source === 'authored' &&
    unpublishedView.publication.snapshot === false &&
    unpublishedView.proposal?.title === 'Publication A',
)

// 1 first publication creates snapshot
const first = publishLivingProposal({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
  publishedBy: 'Studio',
})
assert(
  '1. first publication creates snapshot',
  first.publication?.id &&
    first.publication.snapshotNumber === 1 &&
    first.publication.proposalId === proposalA.id &&
    first.publication.shareToken === proposalA.shareToken,
)

// 2 version increments / 3 publishing again creates NEW snapshot
const second = publishLivingProposal({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert('2. publication version increments', second.publication.snapshotNumber === 2)
assert(
  '3. publishing again creates a NEW snapshot',
  second.publication.id !== first.publication.id,
)

// 4 previous snapshot remains unchanged
const firstReload = getLivingSnapshot({
  proposalId: proposalA.id,
  snapshotId: first.publication.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '4. previous snapshot remains unchanged',
  firstReload.snapshot.id === first.publication.id &&
    firstReload.snapshot.snapshotNumber === 1 &&
    firstReload.snapshot.contentFingerprint === first.publication.contentFingerprint,
)

// 5 current publication resolves correctly
const state = getLivingPublicationState({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '5. current publication resolves correctly',
  state.published === true &&
    state.current?.id === second.publication.id &&
    state.current?.snapshotNumber === 2,
)

// 6 historical snapshot retrieval
const listed = listLivingSnapshots({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '6. historical snapshot retrieval works',
  listed.snapshots.length === 2 &&
    listed.snapshots[0].snapshotNumber === 2 &&
    listed.snapshots[1].snapshotNumber === 1,
)

// 7 company isolation
let crossCompany = false
try {
  getLivingPublicationState({
    proposalId: proposalA.id,
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  })
} catch (error) {
  crossCompany = error instanceof NotFoundError
}
assert('7. company isolation works', crossCompany)

// 8 cross-proposal access fails
let crossProposal = false
try {
  getLivingSnapshot({
    proposalId: proposalB.id,
    snapshotId: first.publication.id,
    companyId: WORKFLOW_ISOLATION_COMPANY_ID,
  })
} catch (error) {
  crossProposal = error instanceof NotFoundError
}
assert('8. cross-proposal access fails', crossProposal)

// 9 share-token mismatch fails (current publication ignored when token differs)
const savedToken = proposalA.shareToken
catalog.delete(savedToken)
proposalA.shareToken = 'share-pub-a-rotated'
catalog.set(proposalA.shareToken, proposalA)
const mismatchView = getLivingClientView({ shareToken: 'share-pub-a-rotated' })
assert(
  '9. share-token mismatch fails (falls back to authored)',
  mismatchView.publication.source === 'authored' &&
    mismatchView.publication.snapshot === false,
)
catalog.delete(proposalA.shareToken)
proposalA.shareToken = savedToken
catalog.set(savedToken, proposalA)

// 10 client cannot access studio snapshot collection (source contract)
const livingPlugin = sourceOf('server', 'livingPlugin.js')
assert(
  '10. client cannot access studio snapshot collection',
  livingPlugin.includes("matchRoute(url, '/api/living/:token/snapshots')") &&
    livingPlugin.includes("reason: 'studio_only'") &&
    livingPlugin.includes('Living publication snapshots are studio-only'),
)

// 11 client living view uses current publication
const clientView = getLivingClientView({ shareToken: proposalA.shareToken })
assert(
  '11. client living view uses current publication',
  clientView.publication.source === 'published' &&
    clientView.publication.snapshot === true &&
    clientView.publication.revision === 2 &&
    clientView.publication.snapshotId === second.publication.id,
)

// 12 unpublished authored edits do not mutate existing snapshot
const originalTitle = firstReload.snapshot.payload.title
proposalA.title = 'Authored draft edit — not published'
const afterEdit = getLivingSnapshot({
  proposalId: proposalA.id,
  snapshotId: first.publication.id,
  companyId: DEFAULT_COMPANY_ID,
})
const afterEditState = getLivingPublicationState({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
const clientAfterEdit = getLivingClientView({ shareToken: proposalA.shareToken })
assert(
  '12. unpublished authored edits do not mutate an existing snapshot',
  afterEdit.snapshot.payload.title === originalTitle &&
    afterEditState.hasUnpublishedChanges === true &&
    clientAfterEdit.proposal.title !== 'Authored draft edit — not published' &&
    clientAfterEdit.publication.revision === 2,
)

// 13 publishing after authored changes produces a new snapshot
const third = publishLivingProposal({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '13. publishing after authored changes produces a new snapshot',
  third.publication.snapshotNumber === 3 &&
    third.publication.id !== second.publication.id,
)
const thirdDetail = getLivingSnapshot({
  proposalId: proposalA.id,
  snapshotId: third.publication.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '13b. new snapshot captures authored changes',
  thirdDetail.snapshot.payload.title === 'Authored draft edit — not published',
)

// 14 selection state is NOT copied into snapshots
getOrCreateLivingSession(proposalA.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
  toggleAddonId: 'oadd-walk',
})
const afterSelection = publishLivingProposal({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
const selectionSnap = getLivingSnapshot({
  proposalId: proposalA.id,
  snapshotId: afterSelection.publication.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '14. selection state is NOT copied into snapshots',
  !('selectedPackageId' in selectionSnap.snapshot.payload) &&
    !('selectedAddonIds' in selectionSnap.snapshot.payload) &&
    !('session' in selectionSnap.snapshot),
)

// 15 engagement events are NOT copied
recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.PROPOSAL_OPENED,
})
assert(
  '15. engagement events are NOT copied into snapshots',
  !('events' in selectionSnap.snapshot.payload) &&
    !('engagement' in selectionSnap.snapshot.payload) &&
    !JSON.stringify(selectionSnap.snapshot.payload).includes('proposal_opened'),
)

// 16 follow-up state is NOT copied
assert(
  '16. follow-up state is NOT copied into snapshots',
  !('followups' in selectionSnap.snapshot.payload) &&
    !('followup' in selectionSnap.snapshot.payload),
)

// 17 Forge/Rive remain disabled
assert(
  '17. Forge/Rive remain disabled',
  LIVING_CAPABILITIES.forgeActions === false &&
    LIVING_CAPABILITIES.rive === false &&
    LIVING_CAPABILITIES.snapshots === true,
)

// 18 no writes to proposals.json
assert(
  '18. no writes to data/proposals.json',
  proposalsSnapshot() === proposalsBefore &&
    livingPlugin.includes('living-publications.json') &&
    livingPlugin.includes('Never writes `data/proposals.json`') &&
    !livingPlugin.includes('writeJson(proposalsFile'),
)

// 20 malformed publication input rejected
let malformed = false
try {
  insertLivingPublication(
    makeLivingPublication({
      proposalId: proposalA.id,
      shareToken: proposalA.shareToken,
      payload: null,
    }),
  )
} catch (error) {
  malformed = error instanceof ValidationError
}
let malformedNumber = false
try {
  insertLivingPublication(
    makeLivingPublication({
      proposalId: proposalA.id,
      shareToken: proposalA.shareToken,
      snapshotNumber: 0,
      payload: { title: 'x' },
    }),
  )
} catch (error) {
  malformedNumber = error instanceof ValidationError
}
assert('20. malformed publication input is rejected safely', malformed && malformedNumber)

// 21 persistence survives reload
const persisted = allLivingPublications()
resetLivingPublicationStore([])
replaceLivingPublications(persisted)
const reloaded = allLivingPublications()
assert(
  '21. persistence survives reload/restart',
  reloaded.length === persisted.length &&
    reloaded.some((item) => item.id === first.publication.id) &&
    reloaded.find((item) => item.id === first.publication.id)?.payload.title ===
      originalTitle,
)

// 22 immutable snapshot cannot be overwritten
let overwriteDenied = false
try {
  insertLivingPublication(
    makeLivingPublication({
      id: first.publication.id,
      proposalId: proposalA.id,
      shareToken: proposalA.shareToken,
      snapshotNumber: 99,
      payload: { title: 'overwrite attempt' },
    }),
  )
} catch (error) {
  overwriteDenied = error instanceof ValidationError
}
const stillOriginal = getLivingSnapshot({
  proposalId: proposalA.id,
  snapshotId: first.publication.id,
  companyId: DEFAULT_COMPANY_ID,
})
assert(
  '22. immutable snapshot cannot be overwritten',
  overwriteDenied &&
    stillOriginal.snapshot.payload.title === originalTitle &&
    stillOriginal.snapshot.snapshotNumber === 1,
)

// Capability contract
assert(
  'capability flags',
  LIVING_CAPABILITIES.packages === true &&
    LIVING_CAPABILITIES.addons === true &&
    LIVING_CAPABILITIES.alternatives === true &&
    LIVING_CAPABILITIES.selections === true &&
    LIVING_CAPABILITIES.livingSession === true &&
    LIVING_CAPABILITIES.commercialEvents === true &&
    LIVING_CAPABILITIES.snapshots === true &&
    LIVING_CAPABILITIES.forgeActions === false &&
    LIVING_CAPABILITIES.rive === false,
)

console.log('')
console.log(`Living publication verification: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
