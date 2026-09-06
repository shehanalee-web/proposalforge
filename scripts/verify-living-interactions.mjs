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
import { FOLLOWUP_REASON, FOLLOWUP_REASONS } from '../src/followup/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../src/services/errors.js'
import {
  configurePortalStore,
  resetPortalStore,
  allPortalRecords,
} from '../src/portal/index.js'
import {
  assertClientSafeInteraction,
  configureInteractionResolvers,
  configureInteractionStore,
  createLivingClientInteraction,
  INTERACTION_CAPABILITIES,
  INTERACTION_TYPE,
  INTERNAL_INTERACTION_KEYS,
  listLivingClientInteractions,
  listStudioInteractions,
  presentClientInteraction,
  resetInteractionResolvers,
  resetInteractionStore,
  allInteractionRecords,
} from '../src/interactions/index.js'
import {
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  applyLivingDecisions,
  configureLivingEventStore,
  configureLivingPublicationStore,
  configureLivingResolvers,
  configureLivingStore,
  getLivingClientView,
  getOrCreateLivingSession,
  listStudioLivingEngagementEvents,
  publishLivingProposal,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
  allLivingEngagementEvents,
  allLivingPublications,
} from '../src/living/index.js'
import { getWorkflowActor } from '../src/workflow/actors.js'

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

function caught(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function proposalsSnapshot() {
  return readFileSync(join(root, 'data', 'proposals.json'), 'utf8')
}

const studio = DEFAULT_COMPANY_ID
const other = WORKFLOW_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor('user-studio-sarah')

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
  id: 'prop-ixn-a',
  title: 'Interactions A',
  clientName: 'Jordan',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-ixn-a',
  amount: 24000,
  currency: 'USD',
  notes: 'INTERNAL — never show',
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { title: 'Cover', kicker: 'Proposal' },
    }),
    makeBlock({
      id: 'blk-pricing',
      type: BLOCK_TYPE.PRICING,
      data: {
        heading: 'Investment',
        modules,
        offers,
      },
    }),
  ],
})
proposalA.companyId = studio

const proposalB = makeProposal({
  id: 'prop-ixn-b',
  title: 'Interactions B',
  clientName: 'Sam',
  company: 'Other Co',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-ixn-b',
  amount: 9000,
  currency: 'USD',
  blocks: [
    makeBlock({
      id: 'blk-b-cover',
      type: BLOCK_TYPE.COVER,
      data: { title: 'B Cover' },
    }),
  ],
})
proposalB.companyId = other

const catalog = new Map([
  [proposalA.shareToken, proposalA],
  [proposalB.shareToken, proposalB],
])

const byId = new Map([
  [proposalA.id, proposalA],
  [proposalB.id, proposalB],
])

configureInteractionResolvers({
  getProposal(proposalId, companyId) {
    const found = byId.get(proposalId)
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (ownedBy !== companyId) return null
    return found
  },
  getProposalByShareToken(shareToken) {
    return catalog.get(String(shareToken ?? '').trim()) ?? null
  },
})

configureLivingResolvers({
  getProposalByShareToken(shareToken) {
    return catalog.get(String(shareToken ?? '').trim()) ?? null
  },
  getProposalById(proposalId, companyId) {
    const found = byId.get(proposalId)
    if (!found) return null
    const ownedBy = String(found.companyId ?? studio).trim() || studio
    if (companyId && ownedBy !== companyId) return null
    return found
  },
})

resetPortalStore([])
configurePortalStore({ persist: () => {} })
resetInteractionStore([])
configureInteractionStore({ persist: () => {} })
resetLivingStore([])
configureLivingStore({ persist: () => {} })
resetLivingEventStore([])
configureLivingEventStore({ persist: () => {} })
resetLivingPublicationStore([])
configureLivingPublicationStore({ persist: () => {} })

const proposalsBefore = proposalsSnapshot()

// 1 token resolves to correct proposal
const listed = listLivingClientInteractions({ shareToken: proposalA.shareToken })
assert(
  '1. token resolves to correct proposal',
  listed.living.proposalId === proposalA.id &&
    listed.living.shareToken === proposalA.shareToken &&
    listed.portal.proposalId === proposalA.id,
)

// 2 token cannot access another proposal's interactions
createLivingClientInteraction({
  shareToken: proposalB.shareToken,
  type: INTERACTION_TYPE.COMMENT,
  message: 'Secret from B',
})
const listedA = listLivingClientInteractions({ shareToken: proposalA.shareToken })
assert(
  '2. token cannot access another proposal interactions',
  listedA.interactions.every((item) => item.proposalId === proposalA.id) &&
    !listedA.interactions.some((item) => item.message === 'Secret from B'),
)

// 3 proposalId supplied by client cannot override token identity
const overrideErr = caught(() =>
  createLivingClientInteraction({
    shareToken: proposalA.shareToken,
    type: INTERACTION_TYPE.COMMENT,
    message: 'Hijack',
    proposalId: proposalB.id,
  }),
)
assert(
  '3. client proposalId cannot override token identity',
  overrideErr instanceof ValidationError,
)

// 4 valid comment
const comment = createLivingClientInteraction({
  shareToken: proposalA.shareToken,
  type: INTERACTION_TYPE.COMMENT,
  message: 'Looks good overall.',
  blockId: 'blk-cover',
})
assert(
  '4. valid client comment succeeds',
  comment.type === INTERACTION_TYPE.COMMENT &&
    comment.message === 'Looks good overall.' &&
    comment.blockId === 'blk-cover' &&
    assertClientSafeInteraction(comment),
)

// 5 question
const question = createLivingClientInteraction({
  shareToken: proposalA.shareToken,
  type: INTERACTION_TYPE.QUESTION,
  message: 'What is the timeline?',
  blockId: 'blk-pricing',
})
assert(
  '5. valid question succeeds',
  question.type === INTERACTION_TYPE.QUESTION && question.blockId === 'blk-pricing',
)

// 6 change request
const change = createLivingClientInteraction({
  shareToken: proposalA.shareToken,
  type: INTERACTION_TYPE.CHANGE_REQUEST,
  message: 'Please revise the cover.',
  blockId: 'blk-cover',
})
assert(
  '6. valid change request succeeds',
  change.type === INTERACTION_TYPE.CHANGE_REQUEST,
)

// 7 approval
const approval = createLivingClientInteraction({
  shareToken: proposalA.shareToken,
  type: INTERACTION_TYPE.APPROVAL,
  message: 'Approved.',
})
assert(
  '7. approval succeeds',
  approval.type === INTERACTION_TYPE.APPROVAL,
)

// 8 blockId preserved
assert(
  '8. blockId / section targeting is preserved',
  comment.blockId === 'blk-cover' &&
    comment.blockLabel &&
    question.blockId === 'blk-pricing',
)

// 9 persists in interaction store (stand-in for interactions.json)
assert(
  '9. interaction persists in interactions store',
  allInteractionRecords().some((item) => item.id === comment.id) &&
    allInteractionRecords().every((item) => item.proposalId !== '') &&
    allPortalRecords().some((item) => item.proposalId === proposalA.id),
)

// 10 proposals.json untouched
assert(
  '10. proposals.json is not modified',
  proposalsSnapshot() === proposalsBefore,
)

// 11 legacy comments path not used for living submissions
assert(
  '11. living UI does not submit via legacy proposal.comments',
  sourceOf('src', 'portal', 'PortalApp.jsx').includes('PortalLivingInteractions') &&
    !sourceOf('src', 'portal', 'PortalApp.jsx').includes('PortalComments') &&
    sourceOf('src', 'portal', 'PortalRequestChanges.jsx').includes(
      'INTERACTION_TYPE.CHANGE_REQUEST',
    ) &&
    !sourceOf('src', 'portal', 'PortalRequestChanges.jsx').includes('requestPortalChanges') &&
    !sourceOf('src', 'portal', 'PortalLivingInteractions.jsx').includes('addPortalComment') &&
    sourceOf('server', 'interactionsPlugin.js').includes('/api/interactions/living/:token'),
)

// 12 studio retrieval sees living interaction
const studioList = listStudioInteractions({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
})
assert(
  '12. existing H12 studio retrieval sees living interaction',
  studioList.some((item) => item.id === comment.id) &&
    studioList.some((item) => item.type === INTERACTION_TYPE.QUESTION),
)

// 13 client cannot see studio-only fields
const clientView = presentClientInteraction(allInteractionRecords().find((r) => r.id === comment.id))
assert(
  '13. client cannot see studio-only interaction information',
  assertClientSafeInteraction(clientView) &&
    INTERNAL_INTERACTION_KEYS.every((key) => !(key in clientView)) &&
    !('activity' in clientView) &&
    !('acknowledgedBy' in clientView),
)

// 14 no follow-up
assert(
  '14. no followup is created',
  !FOLLOWUP_REASONS.includes('commercial_selection') &&
    !('COMMERCIAL_SELECTION' in FOLLOWUP_REASON) &&
    !sourceOf('src', 'interactions', 'livingAccess.js').includes('followups.json') &&
    !sourceOf('src', 'interactions', 'livingAccess.js').includes('createFollowup'),
)

// 15 no commercial_selection
assert(
  '15. no commercial_selection is created',
  !FOLLOWUP_REASONS.includes('commercial_selection'),
)

// 16 no publication snapshot from interaction
const pubsBefore = allLivingPublications().length
createLivingClientInteraction({
  shareToken: proposalA.shareToken,
  type: INTERACTION_TYPE.COMMENT,
  message: 'Another note',
})
assert(
  '16. no publication snapshot is created by interaction',
  allLivingPublications().length === pubsBefore &&
    !sourceOf('src', 'interactions', 'livingAccess.js').includes('publishLivingProposal'),
)

// 17 living sessions still work
getOrCreateLivingSession(proposalA.shareToken)
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-essential',
})
const sessionView = getLivingClientView({ shareToken: proposalA.shareToken })
assert(
  '17. existing living sessions still work',
  sessionView.session?.selectedPackageId === 'pkg-essential' &&
    sessionView.commercialState?.selectedTotal === 18000,
)

// 18 living events still work (comment/question/change emit)
const events = listStudioLivingEngagementEvents({
  proposalId: proposalA.id,
  companyId: studio,
})
assert(
  '18. existing living events still work',
  allLivingEngagementEvents().some((e) => e.type === LIVING_EVENT.COMMENT_ADDED) &&
    allLivingEngagementEvents().some((e) => e.type === LIVING_EVENT.QUESTION_ANSWERED) &&
    allLivingEngagementEvents().some((e) => e.type === LIVING_EVENT.CHANGE_REQUESTED) &&
    events.summary.totalEvents >= 3,
)

// 19 publication behavior still works
const published = publishLivingProposal({
  proposalId: proposalA.id,
  companyId: studio,
  publishedBy: 'studio',
})
assert(
  '19. existing publication behavior still works',
  published.publication?.snapshotNumber === 1 &&
    getLivingClientView({ shareToken: proposalA.shareToken }).publication?.source ===
      'published',
)

// 20 company isolation
const crossCompany = caught(() =>
  createLivingClientInteraction({
    shareToken: proposalA.shareToken,
    type: INTERACTION_TYPE.COMMENT,
    message: 'Wrong company',
    companyId: other,
  }),
)
assert(
  '20. company isolation holds',
  crossCompany instanceof ForbiddenError || crossCompany instanceof NotFoundError,
)

// 21 malformed requests
assert(
  '21. malformed requests are rejected safely',
  throws(
    () =>
      createLivingClientInteraction({
        shareToken: proposalA.shareToken,
        type: INTERACTION_TYPE.COMMENT,
        message: '',
      }),
    ValidationError,
  ) &&
    throws(
      () => listLivingClientInteractions({ shareToken: 'share-missing' }),
      NotFoundError,
    ),
)

// 22 unsupported types
assert(
  '22. unsupported interaction types are rejected',
  throws(
    () =>
      createLivingClientInteraction({
        shareToken: proposalA.shareToken,
        type: 'chat_message',
        message: 'Nope',
      }),
    ValidationError,
  ),
)

// 23 mobile / living UI contracts
assert(
  '23. 390px / living interaction UI contracts remain valid',
  sourceOf('src', 'portal', 'PortalLivingInteractions.jsx').includes(
    'data-living-interactions="true"',
  ) &&
    sourceOf('src', 'portal', 'PortalApp.jsx').includes('data-living-h12') &&
    sourceOf('src', 'portal', 'PortalComments.module.css').includes('min(34rem, 96vw)') &&
    LIVING_CAPABILITIES.h12Interactions === true &&
    INTERACTION_CAPABILITIES.autoProposalEdit === false &&
    INTERACTION_CAPABILITIES.realtimeChat === false &&
    LIVING_CAPABILITIES.forgeActions === false &&
    LIVING_CAPABILITIES.rive === false,
)

// Token B isolation after A writes
const listedB = listLivingClientInteractions({ shareToken: proposalB.shareToken })
assert(
  'bonus. token B only sees B interactions',
  listedB.interactions.every((item) => item.proposalId === proposalB.id) &&
    listedB.interactions.some((item) => item.message === 'Secret from B'),
)

assert(
  'bonus. proposals.json still untouched at end',
  proposalsSnapshot() === proposalsBefore,
)

resetInteractionResolvers()

console.log('')
console.log(`verify-living-interactions: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
