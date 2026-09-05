import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { makeProposal, PROPOSAL_STATUS } from '../src/models/proposal.js'
import { presentProposalForClient } from '../src/collaboration/present.js'
import {
  emitLivingEvent,
  getLivingPublication,
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  LIVING_EVENTS,
  LIVING_PUBLICATION_SOURCE,
  listLivingSections,
  onLivingEvent,
  presentLivingProposal,
  resetLivingEventListeners,
} from '../src/living/index.js'
import { getClientPortalPath } from '../src/utils/clientProposal.js'
import {
  clientProposalPath,
  clientProposalShareAliasPath,
  portalPath,
} from '../src/workspace/paths.js'

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

const authoredItems = [
  { id: 'i1', description: 'Website', amount: 24000, quantity: 1, unit: 'project' },
]
const authoredBlocks = [
  makeBlock({
    id: 'blk-cover',
    type: BLOCK_TYPE.COVER,
    data: { heading: 'Harborline website' },
  }),
  makeBlock({
    id: 'blk-pricing',
    type: BLOCK_TYPE.PRICING,
    data: { items: [{ description: 'Website', amount: 24000 }] },
  }),
  makeBlock({
    id: 'blk-terms',
    type: BLOCK_TYPE.TERMS,
    data: { heading: 'Terms', body: 'Net 30. Work starts after approval.' },
  }),
]

const proposal = makeProposal({
  id: 'prop-living-1',
  title: 'Harborline website',
  clientName: 'Jordan Lee',
  company: 'Harborline',
  status: PROPOSAL_STATUS.SENT,
  shareToken: 'share-living-1',
  amount: 24000,
  notes: 'INTERNAL ONLY',
  items: authoredItems,
  blocks: authoredBlocks,
  versions: [{ id: 'ver-1', label: 'studio only' }],
  followups: [{ id: 'fu-1', reason: 'viewed_no_reply' }],
  workflow: { status: 'sent' },
})

const living = presentLivingProposal(proposal)
const presented = presentProposalForClient(proposal)

assert(
  'Test 1 — Canonical client path is /p/:token',
  clientProposalPath('share-1001') === '/p/share-1001' &&
    getClientPortalPath('share-1001') === '/p/share-1001' &&
    !getClientPortalPath('share-1001').includes('/p/share/'),
)

assert(
  'Test 2 — Legacy share path remains an alias helper',
  clientProposalShareAliasPath('share-1001') === '/p/share/share-1001',
)

const appSource = sourceOf('src', 'App.jsx')
const redirectSource = sourceOf('src', 'portal', 'ClientShareRedirect.jsx')
assert(
  'Test 3 — /p/:token renders ClientPortal; /p/share/:token redirects to canonical',
  appSource.includes('path="/p/share/:token" element={<ClientShareRedirect />}') &&
    appSource.includes('path="/p/:token" element={<ClientPortal />}') &&
    !appSource.includes('path="/p/:token" element={<ClientShareRedirect />}') &&
    redirectSource.includes('clientProposalPath(token)'),
)

assert(
  'Test 4 — No third client application or living route',
  !appSource.includes('LivingApp') &&
    !appSource.includes('path="/living') &&
    appSource.includes('path="/portal/:portalId" element={<ProposalPortal />}') &&
    portalPath('portal-1') === '/portal/portal-1',
)

assert(
  'Test 5 — Living view reuses the proposal; does not clone authored items/blocks',
  living.proposal.items === presented.items &&
    living.proposal.blocks === presented.blocks &&
    living.proposal.items === proposal.items &&
    living.proposal.blocks === proposal.blocks,
)

assert(
  'Test 6 — Client presentation still strips studio notes/versions',
  living.proposal.notes === '' &&
    living.proposal.versions === undefined &&
    living.proposal.currentVersion === undefined,
)

assert(
  'Test 7 — Follow-up and workflow state do not leak into the living view',
  !('followups' in living.proposal) &&
    !('followup' in living.proposal) &&
    !('workflow' in living.proposal) &&
    living.interactionState === null &&
    living.commercialState === null,
)

const pricing = living.sections.find((section) => section.id === 'blk-pricing')
const terms = living.sections.find((section) => section.id === 'blk-terms')
assert(
  'Test 8 — Sections expose blockId for later H12 attachment',
  living.sections.length === 3 &&
    living.sections.every((section) => section.blockId === section.id) &&
    pricing?.kind === 'commercial' &&
    terms?.kind === 'close' &&
    living.sections.every((section) => section.interactive === false),
)

assert(
  'Test 9 — listLivingSections wraps the existing viewer spine',
  JSON.stringify(listLivingSections(proposal).map((section) => section.blockId)) ===
    JSON.stringify(['blk-cover', 'blk-pricing', 'blk-terms']),
)

const publication = getLivingPublication(proposal)
assert(
  'Test 10 — Publication is authored, not a fake snapshot',
  publication.source === LIVING_PUBLICATION_SOURCE.AUTHORED &&
    publication.snapshot === false &&
    publication.revision === null &&
    living.publication.snapshot === false,
)

assert(
  'Test 11 — Later H14 capabilities stay off',
  LIVING_CAPABILITIES.packages === false &&
    LIVING_CAPABILITIES.addons === false &&
    LIVING_CAPABILITIES.selections === false &&
    LIVING_CAPABILITIES.commercialEvents === false &&
    LIVING_CAPABILITIES.livingSession === false &&
    LIVING_CAPABILITIES.snapshots === false &&
    LIVING_CAPABILITIES.forgeActions === false &&
    LIVING_CAPABILITIES.rive === false &&
    living.capabilities === LIVING_CAPABILITIES,
)

resetLivingEventListeners()
const received = []
const stop = onLivingEvent((event) => received.push(event))
const opened = emitLivingEvent(LIVING_EVENT.PROPOSAL_OPENED, {
  proposalId: proposal.id,
  shareToken: proposal.shareToken,
})
const ignored = emitLivingEvent('not_a_living_event', { proposalId: proposal.id })
stop()
emitLivingEvent(LIVING_EVENT.SECTION_VIEWED, { blockId: 'blk-cover' })
assert(
  'Test 12 — Event extension point notifies listeners and ignores unknown types',
  opened?.type === 'proposal_opened' &&
    ignored === null &&
    received.length === 1 &&
    received[0].proposalId === 'prop-living-1' &&
    LIVING_EVENTS.includes('package_selected') &&
    LIVING_EVENTS.includes('accepted'),
)

const productionApi = sourceOf('server', 'productionApi.js')
const livingIndex = sourceOf('src', 'living', 'index.js')
assert(
  'Test 13 — Phase 1 adds no living API plugin or persistence',
  !productionApi.includes('livingPlugin') &&
    !livingIndex.includes('fetch(') &&
    !sourceOf('src', 'living', 'events.js').includes('localStorage') &&
    !sourceOf('src', 'living', 'projection.js').includes('followupPlugin'),
)

const portalApp = sourceOf('src', 'portal', 'PortalApp.jsx')
const viewerSection = sourceOf('src', 'viewer', 'ViewerSection.jsx')
assert(
  'Test 14 — PortalApp is the living renderer; sections keep blockId hooks',
  portalApp.includes('useLivingProposal') &&
    portalApp.includes('data-experience="living-proposal"') &&
    portalApp.includes('sections={living.sections}') &&
    viewerSection.includes('data-block-id={id}') &&
    portalApp.includes('<PortalComments'),
)

const commentsSource = sourceOf('src', 'portal', 'PortalComments.jsx')
assert(
  'Test 15 — Old share-portal comments are not expanded in Phase 1',
  !commentsSource.includes('blockId') &&
    !portalApp.includes('createPublicInteraction'),
)

const shellCss = sourceOf('src', 'portal', 'PortalShell.module.css')
const pageCss = sourceOf('src', 'pages', 'ClientPortal', 'ClientPortal.module.css')
const tocCss = sourceOf('src', 'viewer', 'ViewerToc.module.css')
assert(
  'Test 16 — Mobile overflow guards and living section chips',
  shellCss.includes('overflow-x: hidden') &&
    shellCss.includes('100vw') &&
    shellCss.includes('390px') &&
    pageCss.includes('overflow-x: hidden') &&
    pageCss.includes('390px') &&
    tocCss.includes('overflow-x: auto') &&
    tocCss.includes('.chips') &&
    sourceOf('src', 'viewer', 'ViewerToc.jsx').includes('living'),
)

assert(
  'Test 17 — Authored line items are not rewritten by the living projection',
  proposal.items[0].amount === 24000 &&
    living.proposal.items[0].amount === 24000 &&
    living.proposal.items[0].description === 'Website',
)

assert(
  'Test 18 — Follow-up domain is not imported by living renderer files',
  !sourceOf('src', 'living', 'projection.js').includes("from '../followup") &&
    !sourceOf('src', 'portal', 'PortalApp.jsx').includes('followup'),
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
