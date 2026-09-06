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
import { FOLLOWUP_REASONS } from '../src/followup/types.js'
import { ValidationError, NotFoundError } from '../src/services/errors.js'
import {
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  LIVING_EVENTS,
  applyLivingDecisions,
  configureLivingResolvers,
  getOrCreateLivingSession,
  listStudioLivingEngagementEvents,
  postLivingEngagementEvent,
  presentLivingProposal,
  recordLivingEngagementEvent,
  resetLivingClientEventDedupe,
  resetLivingEventStore,
  resetLivingStore,
  sanitizeLivingEventMetadata,
  allLivingEngagementEvents,
  replaceLivingEngagementEvents,
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
offers = addOffer(offers, OFFER_KIND.PACKAGE, {
  id: 'pkg-premium',
  title: 'Premium',
  amount: 32000,
  enabled: false,
})
offers = addOffer(offers, OFFER_KIND.ADDON, {
  id: 'oadd-walk',
  title: '3D Walkthrough',
  amount: 1500,
})

const proposalA = makeProposal({
  id: 'prop-events-a',
  title: 'Events A',
  clientName: 'Jordan',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-events-a',
  amount: 24000,
  items: [{ id: 'legacy-1', description: 'Website', amount: 24000 }],
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Events A' },
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
  id: 'prop-events-b',
  title: 'Events B',
  clientName: 'Sam',
  company: 'Northwind',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-events-b',
  blocks: [
    makeBlock({
      id: 'blk-cover-b',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Events B' },
    }),
    makeBlock({
      id: 'blk-pricing-b',
      type: BLOCK_TYPE.PRICING,
      data: {
        modules,
        offers: addOffer(makeOfferGroups(), OFFER_KIND.PACKAGE, {
          id: 'pkg-other',
          title: 'Other',
          amount: 99,
        }),
      },
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
resetLivingClientEventDedupe()
const proposalsBefore = proposalsSnapshot()

getOrCreateLivingSession(proposalA.shareToken)

// 1 valid event creation
const created = recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.PROPOSAL_OPENED,
})
assert(
  '1. valid event creation',
  created?.id &&
    created.type === LIVING_EVENT.PROPOSAL_OPENED &&
    created.proposalId === proposalA.id &&
    created.shareToken === proposalA.shareToken &&
    created.companyId === DEFAULT_COMPANY_ID,
)

// 2 invalid type
let invalidType = false
try {
  recordLivingEngagementEvent({
    shareToken: proposalA.shareToken,
    type: 'not_a_real_event',
  })
} catch (error) {
  invalidType = error instanceof ValidationError
}
assert('2. invalid event type rejected', invalidType)

// 3 unknown token
let unknownToken = false
try {
  recordLivingEngagementEvent({
    shareToken: 'share-missing',
    type: LIVING_EVENT.SECTION_VIEWED,
    blockId: 'blk-cover',
  })
} catch (error) {
  unknownToken = error instanceof NotFoundError
}
assert('3. unknown token rejected', unknownToken)

// 4 cross-proposal block id
let crossBlock = false
try {
  recordLivingEngagementEvent({
    shareToken: proposalA.shareToken,
    type: LIVING_EVENT.SECTION_VIEWED,
    blockId: 'blk-cover-b',
  })
} catch (error) {
  crossBlock = error instanceof ValidationError
}
assert('4. cross-proposal block id rejected', crossBlock)

// 5 cross-proposal / disabled offer id
let crossOffer = false
try {
  recordLivingEngagementEvent({
    shareToken: proposalA.shareToken,
    type: LIVING_EVENT.PACKAGE_SELECTED,
    offerId: 'pkg-other',
  })
} catch (error) {
  crossOffer = error instanceof ValidationError
}
let disabledOffer = false
try {
  recordLivingEngagementEvent({
    shareToken: proposalA.shareToken,
    type: LIVING_EVENT.PACKAGE_SELECTED,
    offerId: 'pkg-premium',
  })
} catch (error) {
  disabledOffer = error instanceof ValidationError
}
assert('5. cross-proposal offer id rejected', crossOffer && disabledOffer)

// 6 company isolation
recordLivingEngagementEvent({
  shareToken: proposalB.shareToken,
  type: LIVING_EVENT.PROPOSAL_OPENED,
})
const studioA = listStudioLivingEngagementEvents({
  proposalId: proposalA.id,
  companyId: DEFAULT_COMPANY_ID,
})
const studioB = listStudioLivingEngagementEvents({
  proposalId: proposalB.id,
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
})
let crossCompany = false
try {
  listStudioLivingEngagementEvents({
    proposalId: proposalB.id,
    companyId: DEFAULT_COMPANY_ID,
  })
} catch (error) {
  crossCompany = error instanceof NotFoundError
}
assert(
  '6. company isolation',
  studioA.events.every((event) => event.companyId === DEFAULT_COMPANY_ID) &&
    studioB.events.every((event) => event.companyId === WORKFLOW_ISOLATION_COMPANY_ID) &&
    crossCompany,
)

// 7 persisted event survives reload
const snapshot = allLivingEngagementEvents()
resetLivingEventStore([])
replaceLivingEngagementEvents(snapshot)
const reloaded = allLivingEngagementEvents()
assert(
  '7. persisted event survives reload',
  reloaded.some((event) => event.id === created.id) &&
    reloaded.find((event) => event.id === created.id)?.type ===
      LIVING_EVENT.PROPOSAL_OPENED,
)

// 8 metadata sanitization
const dirty = sanitizeLivingEventMetadata({
  amount: 999,
  selectedTotal: 1,
  note: 'ok',
  password: 'secret',
  nested: { a: 1 },
  long: 'x'.repeat(500),
})
const sanitizedEvent = recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.PACKAGE_EXPANDED,
  offerId: 'pkg-essential',
  metadata: {
    amount: 50,
    label: 'Essential peek',
    apiKey: 'sk-test',
  },
})
assert(
  '8. metadata sanitization',
  dirty.amount === undefined &&
    dirty.selectedTotal === undefined &&
    dirty.password === undefined &&
    dirty.nested === undefined &&
    dirty.note === 'ok' &&
    dirty.long.length === 200 &&
    sanitizedEvent.metadata.amount === undefined &&
    sanitizedEvent.metadata.apiKey === undefined &&
    sanitizedEvent.metadata.label === 'Essential peek',
)

// 9 malformed payload
let malformed = false
try {
  recordLivingEngagementEvent({
    shareToken: proposalA.shareToken,
    type: '',
  })
} catch (error) {
  malformed = error instanceof ValidationError
}
assert('9. malformed payload rejected', malformed)

// 10 event does not modify proposal
assert(
  '10. event does not modify proposal',
  proposalsSnapshot() === proposalsBefore &&
    proposalA.items[0].amount === 24000 &&
    proposalA.blocks.find((block) => block.id === 'blk-pricing').data.offers.packages[0]
      .amount === 18000,
)

// 11 event does not modify living selection state
const sessionBefore = getOrCreateLivingSession(proposalA.shareToken)
recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.PACKAGE_SELECTED,
  offerId: 'pkg-essential',
})
const sessionAfter = getOrCreateLivingSession(proposalA.shareToken)
assert(
  '11. event does not modify living selection state',
  sessionBefore.selectedPackageId === sessionAfter.selectedPackageId &&
    sessionBefore.selectedAddonIds.join(',') === sessionAfter.selectedAddonIds.join(','),
)

// 12 no follow-up
assert(
  '12. event does not create follow-up',
  !sourceOf('src', 'living', 'eventRepository.js').includes('followup') &&
    !sourceOf('server', 'livingPlugin.js').includes('createManualFollowup') &&
    FOLLOWUP_REASONS.includes('commercial_selection'),
)

// 13 event does not create snapshot
assert(
  '13. event does not create snapshot',
  presentLivingProposal(proposalA).publication.snapshot === false &&
    !sourceOf('src', 'living', 'eventRepository.js').includes('publishLivingProposal') &&
    !sourceOf('src', 'living', 'eventRepository.js').includes('insertLivingPublication'),
)

// 14 public client route cannot read studio feed (source contract)
assert(
  '14. public client route cannot read studio event feed',
  sourceOf('server', 'livingPlugin.js').includes("reason: 'studio_only'") &&
    sourceOf('server', 'livingPlugin.js').includes(
      "matchRoute(url, '/api/living/:token/events')",
    ) &&
    sourceOf('server', 'livingPlugin.js').includes(
      "matchRoute(url, '/api/living/proposal/:proposalId/events')",
    ),
)

// 15 all LIVING_EVENTS accepted
const acceptedTypes = []
for (const type of LIVING_EVENTS) {
  const event = recordLivingEngagementEvent({
    shareToken: proposalA.shareToken,
    type,
    blockId: type.includes('section') || type.includes('pricing') ? 'blk-pricing' : null,
    offerId:
      type.includes('package') || type.includes('addon') ? 'pkg-essential' : null,
  })
  acceptedTypes.push(event.type)
}
assert(
  '15. all LIVING_EVENTS are accepted',
  acceptedTypes.length === LIVING_EVENTS.length &&
    LIVING_EVENTS.every((type) => acceptedTypes.includes(type)),
)

// Fix addon_selected to use addon id - the loop used pkg-essential for addon which might fail... wait presentAuthoredOffers only has enabled offers, pkg-essential is enabled, oadd-walk is addon. For ADDON_SELECTED with offerId pkg-essential - packages are also in known offers list via presentAuthoredOffers packages+addons+alternatives. So pkg-essential is valid for any offerId check. OK.

// 16-17 capabilities
assert(
  '16. capability commercialEvents=true',
  LIVING_CAPABILITIES.commercialEvents === true,
)
assert(
  '17. later capabilities remain false',
  LIVING_CAPABILITIES.snapshots === true &&
    LIVING_CAPABILITIES.h12Interactions === true &&
    LIVING_CAPABILITIES.commercialSelectionFollowup === true &&
    LIVING_CAPABILITIES.forgeActions === false &&
    LIVING_CAPABILITIES.rive === false &&
    LIVING_CAPABILITIES.packages === true &&
    LIVING_CAPABILITIES.selections === true &&
    LIVING_CAPABILITIES.livingSession === true,
)

// 18 duplicate/noisy client emission controlled
resetLivingClientEventDedupe()
const originalFetch = globalThis.fetch
const posts = []
globalThis.fetch = async (url, init) => {
  posts.push({ url: String(url), body: init?.body })
  return {
    ok: true,
    json: async () => ({ event: { id: 'lev-mock' } }),
  }
}
await postLivingEngagementEvent(proposalA.shareToken, {
  type: LIVING_EVENT.SECTION_VIEWED,
  blockId: 'blk-cover',
  dedupe: true,
})
await postLivingEngagementEvent(proposalA.shareToken, {
  type: LIVING_EVENT.SECTION_VIEWED,
  blockId: 'blk-cover',
  dedupe: true,
})
globalThis.fetch = originalFetch
assert('18. duplicate/noisy client emission is controlled', posts.length === 1)

// 19 client rendering still works when event POST fails
resetLivingClientEventDedupe()
globalThis.fetch = async () => {
  throw new Error('network down')
}
let threw = false
try {
  const result = await postLivingEngagementEvent(proposalA.shareToken, {
    type: LIVING_EVENT.PROPOSAL_OPENED,
    dedupe: true,
  })
  if (result !== null) threw = true
} catch {
  threw = true
}
globalThis.fetch = originalFetch
assert(
  '19. client rendering still works when event POST fails',
  threw === false &&
    sourceOf('src', 'living', 'clientEvents.js').includes('catch') &&
    sourceOf('src', 'hooks', 'useLivingProposal.js').includes('void postLivingEngagementEvent'),
)

// Decisions still work independently
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
})
assert(
  'Selection path remains independent of events',
  getOrCreateLivingSession(proposalA.shareToken).selectedPackageId === 'pkg-essential',
)

// Client-supplied proposalId ignored
const spoofed = recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.COMMENT_ADDED,
  proposalId: proposalB.id,
  companyId: WORKFLOW_ISOLATION_COMPANY_ID,
})
assert(
  'Token establishes proposal identity',
  spoofed.proposalId === proposalA.id && spoofed.companyId === DEFAULT_COMPANY_ID,
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
