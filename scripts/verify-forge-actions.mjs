/**
 * H14 Phase 14.7 — Studio Forge actions verification.
 *
 * Never writes data/proposals.json. Follow-ups stay in H13 store.
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
import { OFFER_KIND, addOffer, makeOfferGroups } from '../src/models/offer.js'
import { makeProposal, PROPOSAL_STATUS } from '../src/models/proposal.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { ForbiddenError } from '../src/services/errors.js'
import { getWorkflowActor } from '../src/workflow/actors.js'
import { resetWorkflowStore } from '../src/workflow/index.js'
import { resetPortalStore } from '../src/portal/index.js'
import {
  INTERACTION_STATUS,
  INTERACTION_TYPE,
  makeInteractionRecord,
  resetInteractionStore,
} from '../src/interactions/index.js'
import {
  FOLLOWUP_ISOLATION_COMPANY_ID,
  FOLLOWUP_STATUS,
  allFollowupRecords,
  configureFollowupResolvers,
  listStudioFollowups,
  resetFollowupResolvers,
  resetFollowupStore,
} from '../src/followup/index.js'
import {
  LIVING_CAPABILITIES,
  applyLivingDecisions,
  configureLivingResolvers,
  getOrCreateLivingSession,
  recordLivingEngagementEvent,
  resetLivingEventStore,
  resetLivingStore,
  allLivingSessions,
  LIVING_EVENT,
} from '../src/living/index.js'
import { GENERATOR_CAPABILITIES } from '../src/generate/types.js'
import { KNOWLEDGE_CAPABILITIES } from '../src/knowledge/types.js'
import {
  FORGE_ACTION,
  FORGE_CAPABILITIES,
  clientForgeApiDenied,
  getForgeProposalView,
  runForgeAction,
} from '../src/forge/index.js'

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
  }
}

const studio = DEFAULT_COMPANY_ID
const other = FOLLOWUP_ISOLATION_COMPANY_ID
const sarah = getWorkflowActor('user-studio-sarah')
const lee = getWorkflowActor('user-harborline-lee')
const now = Date.parse('2026-09-06T18:00:00.000Z')

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

function proposalWithOffers(offers, extras = {}) {
  const proposal = makeProposal({
    id: extras.id ?? 'prop-forge-a',
    title: extras.title ?? 'Harborline website',
    clientName: 'Jordan Lee',
    company: extras.company ?? 'Harborline',
    status: PROPOSAL_STATUS.SENT,
    shareToken: extras.shareToken ?? 'share-forge-a',
    currency: 'USD',
    amount: 24000,
    lastViewedAt: new Date(now - 60_000).toISOString(),
    lastEmail: { sentAt: new Date(now - 120_000).toISOString() },
    blocks: [
      makeBlock({
        id: 'blk-cover',
        type: BLOCK_TYPE.COVER,
        data: { heading: extras.title ?? 'Harborline website' },
      }),
      makeBlock({
        id: 'blk-pricing',
        type: BLOCK_TYPE.PRICING,
        data: { modules, notes: '', offers: makeOfferGroups(offers) },
      }),
    ],
  })
  proposal.companyId = extras.companyId ?? studio
  return proposal
}

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

const proposalA = proposalWithOffers(offers)
const proposalB = proposalWithOffers(offers, {
  id: 'prop-forge-b',
  shareToken: 'share-forge-b',
  companyId: other,
  company: 'Northwind',
  title: 'Northwind rebuild',
})

const catalog = new Map([
  [proposalA.shareToken, proposalA],
  [proposalB.shareToken, proposalB],
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
resetInteractionStore([])

const proposalsBefore = proposalsSnapshot()
const proposalBlocksBefore = JSON.stringify(proposalA.blocks)

// 1 capability honest
assert(
  '1. Forge capability is enabled honestly',
  LIVING_CAPABILITIES.forgeActions === true &&
    FORGE_CAPABILITIES.studioActions === true &&
    FORGE_CAPABILITIES.livingSummary === true &&
    FORGE_CAPABILITIES.followupActions === true &&
    FORGE_CAPABILITIES.riveContract === true &&
    FORGE_CAPABILITIES.clientForge === false &&
    FORGE_CAPABILITIES.rive === false &&
    FORGE_CAPABILITIES.llm === false &&
    FORGE_CAPABILITIES.proposalDrafts === false &&
    KNOWLEDGE_CAPABILITIES.forge === false &&
    GENERATOR_CAPABILITIES.forge === false &&
    LIVING_CAPABILITIES.rive === false,
)

getOrCreateLivingSession(proposalA.shareToken)
recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.PROPOSAL_OPENED,
})
recordLivingEngagementEvent({
  shareToken: proposalA.shareToken,
  type: LIVING_EVENT.PRICING_VIEWED,
  blockId: 'blk-pricing',
})
applyLivingDecisions({
  shareToken: proposalA.shareToken,
  selectedPackageId: 'pkg-premium',
})

resetInteractionStore([
  makeInteractionRecord({
    companyId: studio,
    portalId: 'portal-forge-1',
    proposalId: proposalA.id,
    type: INTERACTION_TYPE.QUESTION,
    status: INTERACTION_STATUS.OPEN,
    message: 'Can we start in October?',
    createdAt: new Date(now - 3_600_000).toISOString(),
  }),
])

// Clear follow-ups created by living decision reconcile so CREATE is measurable.
resetFollowupStore()

// 8 create follow-up (sync materializes H13 signals on first explicit CREATE)
const created = runForgeAction({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  action: FORGE_ACTION.CREATE_FOLLOWUP,
  now,
})
assert(
  '8. Explicit create-followup action creates H13 follow-up',
  created.created === true &&
    created.followup.companyId === studio &&
    created.followup.proposalId === proposalA.id &&
    allFollowupRecords().some((item) => item.id === created.followup.id),
)

// 2–6 summary uses real data (after follow-up exists)
const view = getForgeProposalView({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  now,
})

assert('2. Studio Forge can read living state', view.summary?.available === true)
assert(
  '3. Summary uses real living data',
  view.summary.engagement.opens >= 1 &&
    view.summary.engagement.pricingViewed >= 1 &&
    /viewed|opened|Premium|question|accepted/i.test(view.summary.narrative),
)
assert(
  '4. Commercial selection appears in the summary',
  view.summary.selection.hasSelection === true &&
    view.summary.selection.packageTitle === 'Premium' &&
    /Premium/i.test(view.summary.selection.description),
)
assert(
  '5. H12 interactions appear in the summary',
  view.summary.interactions.openCount >= 1 &&
    view.summary.interactions.questionCount >= 1 &&
    view.summary.interactions.latest?.message.includes('October'),
)
assert(
  '6. Existing H13 follow-up appears in the summary',
  created.followup?.id &&
    view.summary.followups.openCount >= 1 &&
    view.summary.followups.open.some((item) => item.id === created.followup.id),
)

// 7 deterministic suggestion
const again = getForgeProposalView({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  now,
})
assert(
  '7. Suggested next action is deterministic',
  JSON.stringify(view.suggestion) === JSON.stringify(again.suggestion) &&
    again.suggestion.code === 'work_existing_followup' &&
    again.suggestion.updateFollowupId === created.followup.id,
)

// 9 no duplicate
const openBeforeDup = listStudioFollowups({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  now,
  sync: false,
}).filter(
  (item) => item.status === FOLLOWUP_STATUS.OPEN || item.status === FOLLOWUP_STATUS.IN_PROGRESS,
).length
const dup = runForgeAction({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  action: FORGE_ACTION.CREATE_FOLLOWUP,
  now,
})
const openAfterDup = listStudioFollowups({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  now,
  sync: false,
}).filter(
  (item) => item.status === FOLLOWUP_STATUS.OPEN || item.status === FOLLOWUP_STATUS.IN_PROGRESS,
).length
assert(
  '9. Existing duplicate open follow-up is not duplicated',
  dup.deduped === true &&
    dup.created === false &&
    openAfterDup === openBeforeDup &&
    openAfterDup >= 1,
)

// 10 update follow-up
const updated = runForgeAction({
  companyId: studio,
  proposalId: proposalA.id,
  actor: sarah,
  action: FORGE_ACTION.UPDATE_FOLLOWUP,
  followupId: created.followup.id,
  now,
})
assert(
  '10. Explicit update-followup uses existing H13 persistence',
  updated.followup.id === created.followup.id &&
    updated.followup.status === FOLLOWUP_STATUS.IN_PROGRESS &&
    allFollowupRecords().find((item) => item.id === created.followup.id)?.status ===
      FOLLOWUP_STATUS.IN_PROGRESS,
)

// 11–12 company isolation
getOrCreateLivingSession(proposalB.shareToken)
applyLivingDecisions({
  shareToken: proposalB.shareToken,
  selectedPackageId: 'pkg-premium',
})
const crossRead = (() => {
  try {
    getForgeProposalView({
      companyId: other,
      proposalId: proposalB.id,
      actor: sarah,
      now,
    })
    return false
  } catch (error) {
    return error instanceof ForbiddenError
  }
})()
const crossWrite = (() => {
  try {
    runForgeAction({
      companyId: other,
      proposalId: proposalB.id,
      actor: sarah,
      action: FORGE_ACTION.CREATE_FOLLOWUP,
      now,
    })
    return false
  } catch (error) {
    return error instanceof ForbiddenError
  }
})()
const otherOk = getForgeProposalView({
  companyId: other,
  proposalId: proposalB.id,
  actor: lee,
  now,
})
assert('11. Company isolation is enforced', crossRead && crossWrite)
assert(
  '12. Cross-company read is rejected',
  crossRead && otherOk.summary.companyId === other && otherOk.summary.proposalId === proposalB.id,
)

// 13–14 no public Forge
const portalApp = sourceOf('src', 'portal', 'PortalApp.jsx')
const forgePlugin = sourceOf('server', 'forgePlugin.js')
assert(
  '13. Client/public living route exposes no Forge data',
  !portalApp.includes('Forge') &&
    !portalApp.includes('/api/forge') &&
    !sourceOf('src', 'living', 'projection.js').includes('forge') &&
    !sourceOf('src', 'living', 'LivingSessionProvider.jsx').includes('forge'),
)
assert(
  '14. No Forge public API is available',
  throws(() => clientForgeApiDenied(), ForbiddenError) &&
    forgePlugin.includes("url.startsWith('/api/forge/public')") &&
    forgePlugin.includes('clientForgeApiDenied'),
)

// 15–16 no auto mutation
assert(
  '15. Forge does not mutate proposals automatically',
  JSON.stringify(proposalA.blocks) === proposalBlocksBefore &&
    !sourceOf('src', 'forge', 'repository.js').includes('writeFileSync') &&
    !sourceOf('src', 'forge', 'repository.js').includes('proposals.json') &&
    FORGE_CAPABILITIES.proposalDrafts === false,
)
assert(
  '16. Forge does not mutate publication snapshots',
  !sourceOf('src', 'forge', 'repository.js').includes('publishLivingProposal') &&
    !sourceOf('src', 'forge', 'repository.js').includes('insertLivingPublication') &&
    forgePlugin.includes('Never writes `data/proposals.json`'),
)

// 17 no duplicate persistence
assert(
  '17. No duplicate persistence files are created',
  !forgePlugin.includes('forgeFollowups.json') &&
    !forgePlugin.includes('forge-events.json') &&
    forgePlugin.includes("join(dataDir, 'followups.json')") &&
    proposalsSnapshot() === proposalsBefore,
)

console.log('')
console.log('— Regression suites —')

const suites = [
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
]

for (const file of suites) {
  const result = runSuite(file)
  assert(`${file} still passes`, result.ok, result.ok ? '' : result.output.slice(-900))
}

assert('final. proposals.json untouched', proposalsSnapshot() === proposalsBefore)

resetFollowupResolvers()

console.log('')
console.log(`verify-forge-actions: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
