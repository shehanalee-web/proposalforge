/**
 * H14 close-binding hardening verification.
 *
 * Covers revision identity, living.republished, and acceptance decision snapshots.
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
import { ValidationError } from '../src/services/errors.js'
import {
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  applyLivingDecisions,
  captureLivingAcceptanceDecision,
  configureLivingResolvers,
  getOrCreateLivingSession,
  listLivingEngagementEventsForProposal,
  makeLivingSession,
  presentLivingSession,
  publishLivingProposal,
  getLivingPublicationState,
  recordLivingEngagementEvent,
  resetLivingEventStore,
  resetLivingPublicationStore,
  resetLivingStore,
  allLivingEngagementEvents,
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

const studio = DEFAULT_COMPANY_ID
const now = Date.parse('2026-09-07T00:00:00.000Z')

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
  id: 'prop-close-a',
  title: 'Close binding proposal',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-close-a',
  currency: 'USD',
  amount: 24000,
  currentVersion: 3,
  blocks: [
    makeBlock({
      id: 'blk-cover',
      type: BLOCK_TYPE.COVER,
      data: { heading: 'Close binding proposal' },
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

resetLivingStore([])
resetLivingEventStore([])
resetLivingPublicationStore([])

const proposalsBefore = proposalsSnapshot()
const proposalBlocksBefore = JSON.stringify(proposal.blocks)

assert(
  '0. decisionSnapshots capability is honest',
  LIVING_CAPABILITIES.decisionSnapshots === true &&
    LIVING_CAPABILITIES.snapshots === true &&
    LIVING_CAPABILITIES.rive === false,
)

// A — older sessions without revision fields still load
const legacy = makeLivingSession({
  id: 'lsess-legacy',
  proposalId: proposal.id,
  shareToken: 'share-legacy',
  companyId: studio,
  selectedPackageId: null,
})
assert(
  'A1. older sessions without revision fields still load',
  legacy.publicationId === null &&
    legacy.proposalVersion === null &&
    presentLivingSession(legacy).publicationId === null &&
    presentLivingSession(legacy).decision === null,
)

// Publish then create session — revision identity stamped
const published = publishLivingProposal({
  proposalId: proposal.id,
  companyId: studio,
  publishedBy: 'user-studio-sarah',
})
const session = getOrCreateLivingSession(proposal.shareToken)
assert(
  'A2. new session contains publication revision identity',
  session.publicationId === published.publication.id &&
    session.snapshotNumber === published.publication.snapshotNumber &&
    session.proposalVersion === published.publication.sourceRevision,
)

const decided = applyLivingDecisions({
  shareToken: proposal.shareToken,
  selectedPackageId: 'pkg-premium',
  selectedAddonIds: ['oadd-walk'],
})
assert(
  'A3. selection retains revision identity',
  decided.session.publicationId === published.publication.id &&
    decided.session.snapshotNumber === 1 &&
    decided.session.selectedPackageId === 'pkg-premium' &&
    decided.commercialState.selectedTotal === 33500,
)

// B — republish event
const eventsAfterPublish = listLivingEngagementEventsForProposal(proposal.id, studio)
const republished = eventsAfterPublish.filter((event) => event.type === LIVING_EVENT.REPUBLISHED)
assert(
  'B1. publish emits exactly one living.republished event',
  republished.length === 1 &&
    republished[0].metadata.publicationId === published.publication.id &&
    republished[0].metadata.snapshotNumber === 1,
)

const beforeRead = allLivingEngagementEvents().length
getLivingPublicationState({ proposalId: proposal.id, companyId: studio })
assert(
  'B2. reading publication does not emit another event',
  allLivingEngagementEvents().length === beforeRead,
)

const second = publishLivingProposal({
  proposalId: proposal.id,
  companyId: studio,
  publishedBy: 'user-studio-sarah',
})
const republishedAll = listLivingEngagementEventsForProposal(proposal.id, studio).filter(
  (event) => event.type === LIVING_EVENT.REPUBLISHED,
)
assert(
  'B3. second publish adds a new immutable publication + event',
  second.publication.snapshotNumber === 2 &&
    second.publication.id !== published.publication.id &&
    republishedAll.length === 2 &&
    republishedAll[0].metadata.publicationId === second.publication.id,
)

let clientRepublishRejected = false
try {
  recordLivingEngagementEvent({
    shareToken: proposal.shareToken,
    type: LIVING_EVENT.REPUBLISHED,
  })
} catch (error) {
  clientRepublishRejected = error instanceof ValidationError
}
assert('B4. client cannot POST republished', clientRepublishRejected)

// Refresh session revision to latest publication after second publish
const refreshed = getOrCreateLivingSession(proposal.shareToken)
assert(
  'B5. unlocked session tracks latest publication after republish',
  refreshed.publicationId === second.publication.id &&
    refreshed.snapshotNumber === 2 &&
    refreshed.selectedPackageId === 'pkg-premium',
)

// C — acceptance decision snapshot
const acceptedAt = new Date(now).toISOString()
const captured = captureLivingAcceptanceDecision({
  shareToken: proposal.shareToken,
  acceptedAt,
})
assert(
  'C1. accept captures published revision identity',
  captured.decisionSnapshot.publicationId === second.publication.id &&
    captured.decisionSnapshot.snapshotNumber === 2 &&
    captured.decisionSnapshot.proposalVersion === second.publication.sourceRevision,
)
assert(
  'C2. accept captures current commercial selection',
  captured.decisionSnapshot.selectedPackageId === 'pkg-premium' &&
    captured.decisionSnapshot.selectedAddonIds.includes('oadd-walk'),
)
assert(
  'C3. accept captures derived commercial totals',
  captured.decisionSnapshot.selectedTotal === 33500 &&
    captured.decisionSnapshot.currency === 'USD' &&
    captured.decisionSnapshot.acceptedAt === acceptedAt,
)
assert(
  'C4. snapshot is locked / immutable on session',
  captured.session.decisionLocked === true &&
    captured.session.decision?.selectedTotal === 33500 &&
    Object.isFrozen(captured.decisionSnapshot),
)

const again = captureLivingAcceptanceDecision({
  shareToken: proposal.shareToken,
  acceptedAt: new Date(now + 60_000).toISOString(),
})
assert(
  'C5. re-accept returns existing freeze',
  again.alreadyLocked === true &&
    again.decisionSnapshot.acceptedAt === acceptedAt &&
    again.decisionSnapshot.publicationId === second.publication.id,
)

let lockedRejected = false
try {
  applyLivingDecisions({
    shareToken: proposal.shareToken,
    selectedPackageId: null,
  })
} catch (error) {
  lockedRejected = error instanceof ValidationError
}
assert('C6. locked session rejects selection changes', lockedRejected)

assert(
  'C7. accepting does not mutate authored proposal blocks',
  JSON.stringify(proposal.blocks) === proposalBlocksBefore,
)

assert(
  'C8. accepted living event recorded',
  allLivingEngagementEvents().some(
    (event) =>
      event.type === LIVING_EVENT.ACCEPTED &&
      event.metadata.publicationId === second.publication.id,
  ),
)

assert(
  'C9. client presentation has no follow-up leak',
  !('followups' in (captured.session || {})) &&
    !('companyId' in (captured.session || {})) &&
    captured.session.decision &&
    !('sourceVersionId' in captured.session.decision),
)

assert('D0. proposals.json untouched so far', proposalsSnapshot() === proposalsBefore)

console.log('')
console.log('— Regression suites —')
const suites = [
  'verify-living.mjs',
  'verify-living-session.mjs',
  'verify-living-events.mjs',
  'verify-living-publication.mjs',
  'verify-living-interactions.mjs',
  'verify-living-commercial-selection.mjs',
  'verify-forge-actions.mjs',
  'verify-forge-rive.mjs',
  'verify-followup.mjs',
  'verify-interactions.mjs',
  'verify-portal.mjs',
  'verify-workflow.mjs',
  'verify-offer-authoring.mjs',
]

for (const file of suites) {
  const result = runSuite(file)
  assert(`${file} still passes`, result.ok, result.ok ? '' : result.output.slice(-900))
}

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)
assert(
  'final. living sessions persisted in-memory only for this suite',
  allLivingSessions().some((item) => item.decisionLocked),
)

console.log('')
console.log(`verify-living-close-binding: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
