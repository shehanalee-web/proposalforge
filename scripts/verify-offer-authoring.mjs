import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { makePricingData } from '../src/blocks/schemas.js'
import {
  COMMERCIAL_MODULE,
  makeAddonLine,
  makeCommercialLine,
  makeCommercialModule,
} from '../src/models/commercial.js'
import {
  OFFER_KIND,
  addOffer,
  makeOfferAddon,
  makeOfferAlternative,
  makeOfferGroups,
  makeOfferPackage,
  removeOffer,
  reorderOffers,
  setOfferEnabled,
  updateOffer,
} from '../src/models/offer.js'
import { makeProposal, PROPOSAL_STATUS } from '../src/models/proposal.js'
import { computeCommercials } from '../src/utils/commercialTotals.js'
import {
  emitLivingEvent,
  LIVING_CAPABILITIES,
  LIVING_EVENT,
  onLivingEvent,
  presentLivingProposal,
  resetLivingEventListeners,
} from '../src/living/index.js'
import { FOLLOWUP_REASON, FOLLOWUP_REASONS } from '../src/followup/types.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { WORKFLOW_ISOLATION_COMPANY_ID } from '../src/workflow/types.js'

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
    id: extras.id ?? 'prop-offer-a',
    title: extras.title ?? 'Harborline website',
    clientName: 'Jordan Lee',
    company: extras.company ?? 'Harborline',
    status: PROPOSAL_STATUS.SENT,
    shareToken: extras.shareToken ?? 'share-offer-a',
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
          offers,
        },
      }),
    ],
  })
}

let groups = makeOfferGroups()

groups = addOffer(groups, OFFER_KIND.PACKAGE, {
  id: 'pkg-essential',
  title: 'Essential',
  label: 'A',
  description: 'Core delivery',
  itemIds: ['line-web'],
  amount: 24000,
})
assert(
  'Create named package',
  groups.packages.length === 1 &&
    groups.packages[0].id === 'pkg-essential' &&
    groups.packages[0].title === 'Essential' &&
    groups.packages[0].label === 'A' &&
    groups.packages[0].enabled === true &&
    groups.packages[0].order === 0,
)

groups = updateOffer(groups, OFFER_KIND.PACKAGE, 'pkg-essential', {
  title: 'Essential Plus',
  description: 'Core plus support',
})
assert(
  'Edit package',
  groups.packages[0].title === 'Essential Plus' &&
    groups.packages[0].description === 'Core plus support' &&
    groups.packages[0].id === 'pkg-essential',
)

groups = addOffer(groups, OFFER_KIND.PACKAGE, {
  id: 'pkg-complete',
  title: 'Complete',
  label: 'B',
  amount: 32000,
})
groups = reorderOffers(groups, OFFER_KIND.PACKAGE, 'pkg-complete', 'pkg-essential')
assert(
  'Reorder packages',
  groups.packages.map((item) => item.id).join(',') === 'pkg-complete,pkg-essential' &&
    groups.packages[0].order === 0 &&
    groups.packages[1].order === 1,
)

groups = setOfferEnabled(groups, OFFER_KIND.PACKAGE, 'pkg-complete', false)
assert(
  'Enable/disable package',
  groups.packages[0].enabled === false && groups.packages[1].enabled === true,
)

const beforeDelete = groups.packages.length
groups = removeOffer(groups, OFFER_KIND.PACKAGE, 'pkg-complete')
assert(
  'Delete package where valid',
  groups.packages.length === beforeDelete - 1 &&
    groups.packages[0].id === 'pkg-essential' &&
    groups.packages[0].order === 0,
)

groups = addOffer(groups, OFFER_KIND.ADDON, {
  id: 'add-host',
  title: 'Managed hosting',
  description: 'Annual hosting',
  itemId: 'line-host',
  amount: 1200,
})
assert(
  'Create add-on',
  groups.addons.length === 1 &&
    groups.addons[0].id === 'add-host' &&
    groups.addons[0].itemId === 'line-host' &&
    groups.addons[0].title === 'Managed hosting',
)

groups = updateOffer(groups, OFFER_KIND.ADDON, 'add-host', {
  title: 'Managed hosting + CDN',
  amount: 1500,
})
assert(
  'Edit add-on',
  groups.addons[0].title === 'Managed hosting + CDN' &&
    groups.addons[0].amount === 1500,
)

groups = addOffer(groups, OFFER_KIND.ADDON, {
  id: 'add-training',
  title: 'Training',
  amount: 800,
})
groups = reorderOffers(groups, OFFER_KIND.ADDON, 'add-training', 'add-host')
assert(
  'Reorder add-ons',
  groups.addons.map((item) => item.id).join(',') === 'add-training,add-host',
)

groups = setOfferEnabled(groups, OFFER_KIND.ADDON, 'add-training', false)
assert(
  'Enable/disable add-on',
  groups.addons[0].enabled === false && groups.addons[1].enabled === true,
)

groups = addOffer(groups, OFFER_KIND.ALTERNATIVE, {
  id: 'alt-retainer',
  title: 'Monthly retainer',
  label: 'Alt',
  description: 'Spread the work',
  amount: 4000,
})
assert(
  'Create alternative',
  groups.alternatives.length === 1 &&
    groups.alternatives[0].id === 'alt-retainer' &&
    groups.alternatives[0].title === 'Monthly retainer',
)

groups = updateOffer(groups, OFFER_KIND.ALTERNATIVE, 'alt-retainer', {
  title: 'Quarterly retainer',
})
assert(
  'Edit alternative',
  groups.alternatives[0].title === 'Quarterly retainer',
)

groups = addOffer(groups, OFFER_KIND.ALTERNATIVE, {
  id: 'alt-fixed',
  title: 'Fixed scope',
  amount: 24000,
})
groups = reorderOffers(groups, OFFER_KIND.ALTERNATIVE, 'alt-fixed', 'alt-retainer')
assert(
  'Reorder alternatives',
  groups.alternatives.map((item) => item.id).join(',') === 'alt-fixed,alt-retainer',
)

groups = setOfferEnabled(groups, OFFER_KIND.ALTERNATIVE, 'alt-fixed', false)
assert(
  'Enable/disable alternative',
  groups.alternatives[0].enabled === false && groups.alternatives[1].enabled === true,
)

const baseline = computeCommercials(modules)
const withOffers = proposalWithOffers(groups)
const afterOffers = computeCommercials(
  withOffers.blocks.find((block) => block.type === BLOCK_TYPE.PRICING).data.modules,
)
const emptyProposal = makeProposal({
  id: 'prop-empty-offers',
  title: 'No offer data',
  shareToken: 'share-empty',
  items: [{ description: 'Website', amount: 24000 }],
})
const emptyLiving = presentLivingProposal(emptyProposal)
const emptyTotals = computeCommercials(
  emptyProposal.blocks.find((block) => block.type === BLOCK_TYPE.PRICING).data.modules,
)
assert(
  'Proposal with no offer data remains backward compatible',
  emptyLiving.authoredOffers.packages.length === 0 &&
    emptyLiving.authoredOffers.addons.length === 0 &&
    emptyLiving.authoredOffers.alternatives.length === 0 &&
    emptyProposal.blocks.find((block) => block.type === BLOCK_TYPE.PRICING).data.offers
      .packages.length === 0 &&
    emptyTotals.grandTotal === 24000 &&
    afterOffers.grandTotal === baseline.grandTotal,
)

const living = presentLivingProposal(withOffers)
assert(
  'Authored offer data appears in Living Proposal projection',
  living.authoredOffers.packages.length === 1 &&
    living.authoredOffers.packages[0].title === 'Essential Plus' &&
    living.authoredOffers.addons.length === 1 &&
    living.authoredOffers.addons[0].title === 'Managed hosting + CDN' &&
    living.authoredOffers.alternatives.length === 1 &&
    living.authoredOffers.alternatives[0].title === 'Quarterly retainer' &&
    living.authoredOffers.packages.every((item) => item.enabled) &&
    !living.authoredOffers.packages.some((item) => item.id === 'pkg-complete'),
)

const sourceTitle =
  withOffers.blocks.find((block) => block.type === BLOCK_TYPE.PRICING).data.offers
    .packages[0].title
living.authoredOffers.packages[0].title = 'HACKED'
living.authoredOffers.packages.push({ id: 'injected', title: 'Injected' })
const afterMutate = withOffers.blocks.find((block) => block.type === BLOCK_TYPE.PRICING)
  .data.offers.packages
assert(
  'Client cannot mutate authored offer data',
  sourceTitle === 'Essential Plus' &&
    afterMutate[0].title === 'Essential Plus' &&
    afterMutate.length === 1 &&
    !('selected' in living.authoredOffers.packages[0]) &&
    living.commercialState === null &&
    sourceOf('src', 'components', 'CommercialBuilder', 'OfferDocument.jsx').includes(
      'data-offer-selectable="false"',
    ) &&
    sourceOf('src', 'portal', 'PortalApp.jsx').includes('data-readonly="true"') &&
    !sourceOf('src', 'components', 'CommercialBuilder', 'OfferDocument.jsx').includes(
      'onSelect',
    ) &&
    !sourceOf('src', 'living', 'offers.js').includes('selected:'),
)

assert(
  'No selection state is persisted',
  !JSON.stringify(afterMutate[0]).includes('"selected"') &&
    !JSON.stringify(living.authoredOffers).includes('"selected"') &&
    living.capabilities.selections === false &&
    living.capabilities.livingSession === false &&
    !sourceOf('src', 'living', 'projection.js').includes('localStorage') &&
    !sourceOf('src', 'models', 'offer.js').includes('selected'),
)

resetLivingEventListeners()
const events = []
const stop = onLivingEvent((event) => events.push(event))
presentLivingProposal(withOffers)
stop()
const selected = emitLivingEvent(LIVING_EVENT.PACKAGE_SELECTED, {
  proposalId: withOffers.id,
})
assert(
  'No commercial engagement events are emitted by offer presentation',
  events.length === 0 &&
    selected?.type === 'package_selected' &&
    sourceOf('src', 'living', 'offers.js').includes('presentAuthoredOffers') &&
    !sourceOf('src', 'living', 'offers.js').includes('emitLivingEvent') &&
    !sourceOf('src', 'components', 'CommercialBuilder', 'OfferDocument.jsx').includes(
      'emitLivingEvent',
    ) &&
    !sourceOf('src', 'components', 'CommercialBuilder', 'OfferDocument.jsx').includes(
      'PACKAGE_SELECTED',
    ),
)

assert(
  'No H13 follow-up is created',
  !FOLLOWUP_REASONS.includes('commercial_selection') &&
    !('COMMERCIAL_SELECTION' in FOLLOWUP_REASON) &&
    !sourceOf('src', 'followup', 'types.js').includes('commercial_selection') &&
    !sourceOf('src', 'living', 'offers.js').includes('followup') &&
    !sourceOf('src', 'models', 'offer.js').includes('followup') &&
    !sourceOf('src', 'components', 'CommercialBuilder', 'OfferAuthoring.jsx').includes(
      'followup',
    ),
)

assert(
  'Capability flags remain correct',
  LIVING_CAPABILITIES.packages === true &&
    LIVING_CAPABILITIES.addons === true &&
    LIVING_CAPABILITIES.alternatives === true &&
    LIVING_CAPABILITIES.selections === false &&
    LIVING_CAPABILITIES.commercialEvents === false &&
    LIVING_CAPABILITIES.livingSession === false &&
    LIVING_CAPABILITIES.snapshots === false &&
    LIVING_CAPABILITIES.forgeActions === false &&
    LIVING_CAPABILITIES.rive === false &&
    living.capabilities === LIVING_CAPABILITIES &&
    living.publication.snapshot === false &&
    living.publication.revision === null &&
    living.publication.source === 'authored',
)

const other = proposalWithOffers(
  addOffer(makeOfferGroups(), OFFER_KIND.PACKAGE, {
    id: 'pkg-other',
    title: 'Other company package',
    amount: 99,
  }),
  {
    id: 'prop-offer-b',
    shareToken: 'share-offer-b',
    company: 'Northwind',
    title: 'Northwind rebuild',
  },
)
const livingA = presentLivingProposal(withOffers)
const livingB = presentLivingProposal(other)
assert(
  'Company/workspace isolation where applicable',
  DEFAULT_COMPANY_ID === 'company-studio' &&
    WORKFLOW_ISOLATION_COMPANY_ID !== DEFAULT_COMPANY_ID &&
    livingA.proposal.shareToken !== livingB.proposal.shareToken &&
    livingA.authoredOffers.packages[0].title === 'Essential Plus' &&
    livingB.authoredOffers.packages[0].title === 'Other company package' &&
    !livingA.authoredOffers.packages.some((item) => item.title === 'Other company package') &&
    !livingB.authoredOffers.packages.some((item) => item.title === 'Essential Plus'),
)

const malformed = makeOfferGroups({
  packages: [
    { title: 12, amount: -40, enabled: 'yes', itemIds: 'line-web', extra: true },
    null,
    'nope',
  ],
  addons: { title: 'not-an-array' },
  alternatives: undefined,
  industryPackages: [{ name: 'Architecture SKU' }],
})
const ignoredKind = addOffer(groups, 'architecture-package', { title: 'Nope' })
const missingUpdate = updateOffer(groups, OFFER_KIND.PACKAGE, '', { title: 'X' })
const missingRemove = removeOffer(groups, OFFER_KIND.PACKAGE, 'missing-id')
assert(
  'Malformed input handling',
  malformed.packages.length === 1 &&
    malformed.packages[0].title === '12' &&
    malformed.packages[0].amount === 0 &&
    malformed.packages[0].enabled === true &&
    malformed.packages[0].itemIds.length === 0 &&
    !('extra' in malformed.packages[0]) &&
    !('industryPackages' in malformed) &&
    malformed.addons.length === 0 &&
    malformed.alternatives.length === 0 &&
    makeOfferGroups(null).packages.length === 0 &&
    makeOfferGroups('nope').packages.length === 0 &&
    ignoredKind.packages.length === groups.packages.length &&
    missingUpdate.packages[0].title === groups.packages[0].title &&
    missingRemove.packages.length === groups.packages.length &&
    makeOfferPackage('bad').kind === OFFER_KIND.PACKAGE &&
    makeOfferAddon(undefined).kind === OFFER_KIND.ADDON &&
    makeOfferAlternative(null).kind === OFFER_KIND.ALTERNATIVE,
)

const persisted = makeProposal(JSON.parse(JSON.stringify(withOffers)))
const loadedOffers = persisted.blocks.find((block) => block.type === BLOCK_TYPE.PRICING)
  .data.offers
const fromSchema = makePricingData({
  modules,
  offers: groups,
})
assert(
  'Persistence/load behavior according to existing project patterns',
  loadedOffers.packages[0].id === 'pkg-essential' &&
    loadedOffers.packages[0].title === 'Essential Plus' &&
    loadedOffers.addons.some((item) => item.id === 'add-host') &&
    loadedOffers.alternatives.some((item) => item.id === 'alt-retainer') &&
    fromSchema.offers.packages[0].id === 'pkg-essential' &&
    fromSchema.items.some((item) => item.description === 'Website') &&
    sourceOf('src', 'blocks', 'schemas.js').includes('makeOfferGroups') &&
    sourceOf('src', 'components', 'CommercialBuilder', 'CommercialBuilder.jsx').includes(
      'OfferAuthoring',
    ) &&
    sourceOf('src', 'blocks', 'screen.jsx').includes('offers={instance.data.offers}') &&
    !sourceOf('src', 'App.jsx').includes('path="/living') &&
    !sourceOf('src', 'App.jsx').includes('client-offer'),
)

const disabledStillAuthored =
  withOffers.blocks.find((block) => block.type === BLOCK_TYPE.PRICING).data.offers
    .addons[0]
assert(
  'Disabled offers stay authored but are omitted from the living projection',
  disabledStillAuthored.id === 'add-training' &&
    disabledStillAuthored.enabled === false &&
    !living.authoredOffers.addons.some((item) => item.id === 'add-training') &&
    !living.authoredOffers.alternatives.some((item) => item.id === 'alt-fixed'),
)

assert(
  'Existing commercial totals are not rewritten by offer authoring',
  afterOffers.grandTotal === baseline.grandTotal &&
    afterOffers.optionalAddons === baseline.optionalAddons &&
    withOffers.items.some((item) => item.description === 'Website' && item.amount === 24000),
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
