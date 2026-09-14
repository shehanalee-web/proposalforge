import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { ACTIVITY_EVENT_TYPE } from '../src/models/activityEvent.js'
import { ValidationError } from '../src/services/errors.js'
import {
  fetchAssetById,
  listAssets,
  putAsset,
  resetAssets,
} from '../src/services/assetService.js'
import { listProposalActivity } from '../src/services/activityService.js'
import {
  createProposal,
  loadStoredProposalById,
  resetProposals,
  updateProposal,
} from '../src/services/proposalService.js'
import {
  createService,
  resetServices,
} from '../src/services/serviceService.js'
import { resetTemplates } from '../src/services/templateService.js'
import { applyServiceAssetsToProposal } from '../src/utils/templateBlocks.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function sliceExport(src, name) {
  const match = src.match(new RegExp(`export (async )?function ${name}\\(`))
  if (!match) return ''

  const start = match.index
  const from = start + match[0].length
  const next = src.slice(from).search(/\nexport (async )?function /)
  return next < 0 ? src.slice(start) : src.slice(start, from + next)
}

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

function runVerifier(file, label) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', file)], {
    encoding: 'utf8',
    cwd: root,
  })
  assert(
    label,
    result.status === 0,
    result.stderr || result.stdout?.trim().split('\n').slice(-8).join('\n'),
  )
}

function galleryBlocks(blocks) {
  return (blocks ?? []).filter((block) => block.type === BLOCK_TYPE.GALLERY)
}

function galleryItems(blocks) {
  return galleryBlocks(blocks).flatMap((block) => block.data?.items ?? [])
}

const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const href = String(url)
  if (href.includes('/api/assets') || href.includes('/api/proposals')) {
    return {
      ok: true,
      json: async () => (href.includes('/api/proposals') ? { records: [] } : []),
    }
  }
  if (typeof originalFetch === 'function') {
    return originalFetch(url, init)
  }
  throw new TypeError(`Unexpected fetch: ${href}`)
}

resetAssets()
await resetServices()
resetTemplates()
await resetProposals()

const helperSource = sourceOf('src', 'utils', 'templateBlocks.js')
const assetApplySrc = sliceExport(helperSource, 'applyServiceAssetsToProposal')
const composeAssetsSrc = sliceExport(helperSource, 'composeTemplateAssets')
const contentApplySrc = sliceExport(helperSource, 'applyServiceComponentsToProposal')
const createComposeSrc = sliceExport(helperSource, 'composeServiceComponentsForCreate')
const templateAssetApplySrc = sliceExport(helperSource, 'applyServiceAssetsToTemplate')
const editorSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const formSource = sourceOf('src', 'pages', 'NewProposal', 'ProposalForm.jsx')

assert(
  'A. applyServiceAssetsToProposal reuses composeTemplateAssets()',
  assetApplySrc.includes('composeTemplateAssets(stored, service?.assetIds)') &&
    assetApplySrc.includes('composed.added.length === 0') &&
    !assetApplySrc.includes('blockIds(') &&
    !assetApplySrc.includes('makeGalleryItem') &&
    composeAssetsSrc.includes('export async function composeTemplateAssets'),
)

const assetA = putAsset({
  id: 'asset-h17-7-a',
  name: 'Hero render',
  url: '/uploads/asset-h17-7-a/hero.jpg',
  caption: 'Hero caption',
})
const assetB = putAsset({
  id: 'asset-h17-7-b',
  name: 'Plan drawing',
  url: '/uploads/asset-h17-7-b/plan.jpg',
  caption: 'Plan caption',
})
const assetC = putAsset({
  id: 'asset-h17-7-c',
  name: 'Detail photo',
  url: '/uploads/asset-h17-7-c/detail.jpg',
  caption: 'Detail caption',
})
const assetsBefore = JSON.stringify(await listAssets())

const authoredKeep = makeBlock({
  id: 'blk-keep-h17-7',
  type: BLOCK_TYPE.COVER,
  data: { heading: 'Keep this authored cover' },
})
const storedExtra = makeBlock({
  id: 'blk-store-extra-h17-7',
  type: BLOCK_TYPE.TERMS,
  data: { body: 'Present in store, missing from a stale editor snapshot.' },
})
const disabledGallery = makeBlock({
  id: 'blk-gallery-disabled-h17-7',
  type: BLOCK_TYPE.GALLERY,
  enabled: false,
  data: { items: [] },
})

const service = await createService({
  id: 'svc-h17-7-linked',
  name: 'H17.7 service',
  assetIds: [assetA.id, assetB.id],
})

const created = await createProposal({
  id: 'prop-h17-7-apply',
  title: 'H17.7 proposal',
  clientName: 'Northwind',
  company: 'Northwind Ltd',
  notes: 'Unrelated notes must survive Apply.',
  layoutId: LAYOUT_ID.LANDSCAPE,
  serviceIds: [service.id],
  projectType: service.name,
  blocks: [authoredKeep, storedExtra, disabledGallery],
})

const activityBeforeApply = await listProposalActivity(created.id)
const viewedBefore = activityBeforeApply.filter(
  (event) => event.event_type === ACTIVITY_EVENT_TYPE.VIEWED,
).length

const firstApply = await applyServiceAssetsToProposal(created.id, service)
const firstStored = await loadStoredProposalById(created.id)
const firstItems = galleryItems(firstStored.blocks)
const createdA = firstItems.find((item) => item.assetId === assetA.id)
const createdB = firstItems.find((item) => item.assetId === assetB.id)
const firstGallery = galleryBlocks(firstStored.blocks)[0]
const firstItemIds = firstItems.map((item) => item.id)
const firstUpdatedAt = firstStored.updatedAt
const firstVersion = firstStored.currentVersion
const firstVersionCount = (firstStored.versions ?? []).length

assert(
  'B. Happy path adds missing assetIds as Gallery items',
  firstApply.updated === true &&
    firstItems.length === 2 &&
    Boolean(createdA) &&
    Boolean(createdB),
)

assert(
  'C. Gallery items retain assetId provenance',
  createdA.assetId === assetA.id &&
    createdB.assetId === assetB.id &&
    typeof createdA.id === 'string' &&
    createdA.id.startsWith('img-') &&
    createdB.id.startsWith('img-'),
)

assert(
  'D. url and caption are copied through existing composer behavior',
  createdA.url === assetA.url &&
    createdA.caption === assetA.caption &&
    createdB.url === assetB.url &&
    createdB.caption === assetB.caption,
)

assert(
  'E. Persist occurs only when composed.added.length > 0',
  assetApplySrc.includes('if (composed.added.length === 0)') &&
    assetApplySrc.includes('return { proposal: stored, updated: false }') &&
    /updateProposal\(stored\.id,\s*\{\s*blocks: composed\.blocks,\s*\}\)/.test(
      assetApplySrc,
    ) &&
    firstApply.updated === true,
)

assert(
  'F. Persistence patches only blocks',
  /updateProposal\(stored\.id,\s*\{\s*blocks: composed\.blocks,\s*\}\)/.test(
    assetApplySrc,
  ) && !assetApplySrc.includes('contentBlockIds'),
)

assert(
  'G. Unrelated proposal fields survive',
  firstStored.title === 'H17.7 proposal' &&
    firstStored.clientName === 'Northwind' &&
    firstStored.company === 'Northwind Ltd' &&
    firstStored.notes === 'Unrelated notes must survive Apply.' &&
    firstStored.layoutId === LAYOUT_ID.LANDSCAPE &&
    firstStored.serviceIds.join() === service.id &&
    firstStored.projectType === service.name &&
    !Object.hasOwn(firstStored, 'assetIds'),
)

assert(
  'H. Stored proposal is used rather than stale editor blocks',
  firstStored.blocks.some((block) => block.id === 'blk-store-extra-h17-7') &&
    firstStored.blocks.find((block) => block.id === 'blk-store-extra-h17-7')?.data
      .body === 'Present in store, missing from a stale editor snapshot.' &&
    !editorSource.includes('applyServiceAssetsToProposal(id, service, documentBlocks)') &&
    assetApplySrc.includes('loadStoredProposalById(proposalId)') &&
    !assetApplySrc.includes('fetchProposalById'),
)

assert(
  'I. Existing stored blocks survive composition',
  firstStored.blocks.some((block) => block.id === 'blk-keep-h17-7') &&
    firstStored.blocks.find((block) => block.id === 'blk-keep-h17-7')?.data
      .heading === 'Keep this authored cover' &&
    firstStored.blocks.some((block) => block.id === 'blk-gallery-disabled-h17-7'),
)

assert(
  'N. Disabled Gallery is enabled when assets are added',
  firstGallery?.id === 'blk-gallery-disabled-h17-7' &&
    firstGallery.enabled === true &&
    galleryBlocks(firstStored.blocks).length === 1,
)

const secondApply = await applyServiceAssetsToProposal(created.id, service)
const secondStored = await loadStoredProposalById(created.id)

assert(
  'J. Repeat Apply is a true no-op',
  secondApply.updated === false &&
    secondStored.updatedAt === firstUpdatedAt &&
    secondStored.currentVersion === firstVersion &&
    (secondStored.versions ?? []).length === firstVersionCount &&
    galleryItems(secondStored.blocks).map((item) => item.id).join() ===
      firstItemIds.join() &&
    galleryItems(secondStored.blocks).filter((item) => item.assetId === assetA.id)
      .length === 1,
)

const emptyApply = await applyServiceAssetsToProposal(created.id, { assetIds: [] })
const emptyStored = await loadStoredProposalById(created.id)

assert(
  'K. Empty assetIds performs no asset fetch and no persistence',
  emptyApply.updated === false &&
    emptyStored.updatedAt === firstUpdatedAt &&
    JSON.stringify(emptyStored.blocks) === JSON.stringify(secondStored.blocks) &&
    composeAssetsSrc.indexOf('requested.length === 0') <
      composeAssetsSrc.indexOf('fetchAssetById'),
)

const beforeUnknown = await loadStoredProposalById(created.id)
let unknownError = null
try {
  await applyServiceAssetsToProposal(created.id, {
    assetIds: [assetA.id, 'asset-missing-h17-7'],
  })
} catch (error) {
  unknownError = error
}
const afterUnknown = await loadStoredProposalById(created.id)

assert(
  'L. Unknown asset produces ValidationError and no persistence',
  unknownError instanceof ValidationError &&
    unknownError.message.includes('asset-missing-h17-7') &&
    afterUnknown.updatedAt === beforeUnknown.updatedAt &&
    JSON.stringify(afterUnknown.blocks) === JSON.stringify(beforeUnknown.blocks),
)

const galleryOne = makeBlock({
  id: 'blk-gallery-one-h17-7',
  type: BLOCK_TYPE.GALLERY,
  enabled: true,
  data: {
    items: [
      {
        id: 'img-existing-a-h17-7',
        assetId: assetA.id,
        url: assetA.url,
        caption: assetA.caption,
      },
    ],
  },
})
const galleryTwo = makeBlock({
  id: 'blk-gallery-two-h17-7',
  type: BLOCK_TYPE.GALLERY,
  enabled: true,
  data: {
    items: [
      {
        id: 'img-existing-b-h17-7',
        assetId: assetB.id,
        url: assetB.url,
        caption: assetB.caption,
      },
    ],
  },
})
const spread = await createProposal({
  id: 'prop-h17-7-spread',
  title: 'H17.7 spread proposal',
  clientName: 'Northwind',
  blocks: [authoredKeep, galleryOne, galleryTwo],
})
const spreadService = await createService({
  id: 'svc-h17-7-spread',
  name: 'H17.7 spread service',
  assetIds: [assetA.id, assetB.id, assetC.id],
})
const spreadApply = await applyServiceAssetsToProposal(spread.id, spreadService)
const spreadStored = await loadStoredProposalById(spread.id)
const spreadItems = galleryItems(spreadStored.blocks)

assert(
  'M. Existing assetId in any Gallery is not duplicated',
  spreadApply.updated === true &&
    spreadItems.filter((item) => item.assetId === assetA.id).length === 1 &&
    spreadItems.filter((item) => item.assetId === assetB.id).length === 1 &&
    spreadItems.filter((item) => item.assetId === assetC.id).length === 1 &&
    spreadStored.blocks[1].data.items.some((item) => item.id === 'img-existing-a-h17-7') &&
    spreadStored.blocks[2].data.items[0].id === 'img-existing-b-h17-7',
)

const noGallery = await createProposal({
  id: 'prop-h17-7-no-gallery',
  title: 'H17.7 no gallery',
  clientName: 'Northwind',
  blocks: [authoredKeep],
})
const noGalleryService = await createService({
  id: 'svc-h17-7-no-gallery',
  name: 'H17.7 no gallery service',
  assetIds: [assetA.id],
})
const noGalleryApply = await applyServiceAssetsToProposal(
  noGallery.id,
  noGalleryService,
)
const noGalleryStored = await loadStoredProposalById(noGallery.id)
const noGalleryGalleries = galleryBlocks(noGalleryStored.blocks)

assert(
  'O. Missing Gallery creates one enabled Gallery',
  noGalleryApply.updated === true &&
    noGalleryGalleries.length === 1 &&
    noGalleryGalleries[0].enabled === true &&
    noGalleryGalleries[0].data.items[0].assetId === assetA.id &&
    noGalleryStored.blocks[0].id === 'blk-keep-h17-7',
)

assert(
  'P. Asset records are never mutated',
  JSON.stringify(await listAssets()) === assetsBefore &&
    (await fetchAssetById(assetA.id)).url === assetA.url &&
    (await fetchAssetById(assetA.id)).caption === assetA.caption,
)

assert(
  'Q. No uploadAsset path is introduced',
  !assetApplySrc.includes('uploadAsset') &&
    !editorSource.includes('uploadAsset') &&
    !formSource.includes('uploadAsset') &&
    !formSource.includes('listAssets') &&
    !editorSource.includes('listAssets'),
)

assert(
  'R. Apply Assets to Proposal and Apply Default Components remain separate',
  formSource.includes('Apply Default Components to Proposal') &&
    formSource.includes('Apply Assets to Proposal') &&
    editorSource.includes('applyServiceComponentsToProposal') &&
    editorSource.includes('applyServiceAssetsToProposal') &&
    editorSource.includes('handleApplyAssetsToProposal') &&
    editorSource.includes('toEditableChanges(values, documentBlocks)') &&
    !editorSource.includes('composeTemplateAssets') &&
    contentApplySrc.includes('composeTemplateFromService') &&
    !contentApplySrc.includes('composeTemplateAssets') &&
    !contentApplySrc.includes('fetchAssetById'),
)

const activityAfterApply = await listProposalActivity(created.id)
const viewedAfter = activityAfterApply.filter(
  (event) => event.event_type === ACTIVITY_EVENT_TYPE.VIEWED,
).length

assert(
  'S. Apply Assets uses loadStoredProposalById, not fetchProposalById',
  viewedAfter === viewedBefore &&
    assetApplySrc.includes('loadStoredProposalById(proposalId)') &&
    !assetApplySrc.includes('fetchProposalById') &&
    !helperSource.includes('fetchProposalById'),
)

assert(
  'T. Create-time composition remains asset-fetch-free',
  !createComposeSrc.includes('fetchAssetById') &&
    !createComposeSrc.includes('composeTemplateAssets') &&
    !sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx').includes(
      'applyServiceAssetsToProposal',
    ) &&
    !sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx').includes(
      'composeTemplateAssets',
    ) &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes('fetchAssetById') &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes(
      'composeTemplateAssets',
    ),
)

assert(
  'U. Content Library Apply remains asset-fetch-free',
  !contentApplySrc.includes('fetchAssetById') &&
    !contentApplySrc.includes('composeTemplateAssets') &&
    templateAssetApplySrc.includes('fetchTemplateById(resolved.id)') &&
    !templateAssetApplySrc.includes('applyServiceAssetsToProposal') &&
    editorSource.includes('applyServiceComponentsToProposal(id, {'),
)

const ordinarySave = await updateProposal(created.id, {
  notes: 'Ordinary save must not compose assets.',
})
assert(
  'G2. Ordinary proposal save does not compose assets',
  ordinarySave.notes === 'Ordinary save must not compose assets.' &&
    galleryItems(ordinarySave.blocks).map((item) => item.id).join() ===
      firstItemIds.join() &&
    !editorSource.includes('composeTemplateAssets'),
)

runVerifier(
  'verify-template-asset-composition.mjs',
  'V. H17.6 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'V2. H17.5.2 verifier remains green',
)
runVerifier(
  'verify-proposal-service-composition.mjs',
  'V3. H17.5.1 verifier remains green',
)
runVerifier(
  'verify-template-service-composition.mjs',
  'V4. H17.4 verifier remains green',
)
runVerifier('verify-template-composition.mjs', 'V5. H17.3 verifier remains green')
runVerifier(
  'verify-template-block-authoring.mjs',
  'V6. H17.2 verifier remains green',
)
runVerifier(
  'verify-template-block-assembly.mjs',
  'V7. H17.1 verifier remains green',
)

resetAssets()
await resetServices()
resetTemplates()
await resetProposals()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
