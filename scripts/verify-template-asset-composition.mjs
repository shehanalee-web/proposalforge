import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import {
  buildServiceEditorPayload,
  makeService,
} from '../src/models/service.js'
import { NotFoundError, ValidationError } from '../src/services/errors.js'
import {
  fetchAssetById,
  listAssets,
  putAsset,
  resetAssets,
} from '../src/services/assetService.js'
import {
  createService,
  resetServices,
  updateService,
} from '../src/services/serviceService.js'
import {
  createTemplate,
  fetchTemplateById,
  resetTemplates,
} from '../src/services/templateService.js'
import {
  applyServiceAssetsToTemplate,
  composeTemplateAssets,
  hasCanonicalBlocks,
} from '../src/utils/templateBlocks.js'

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
  if (href.includes('/api/assets')) {
    return {
      ok: true,
      json: async () => [],
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

const defaultService = makeService({
  id: 'svc-h17-6-default',
  name: 'Default service',
})

assert(
  'A. makeService() defaults assetIds to []',
  Array.isArray(defaultService.assetIds) && defaultService.assetIds.length === 0,
)

const normalized = makeService({
  assetIds: ['  asset-b  ', 'asset-a', 'asset-b', '', '  '],
})

assert(
  'B. assetIds normalize trim/dedupe/order',
  normalized.assetIds.join() === 'asset-b,asset-a',
)

const assetA = putAsset({
  id: 'asset-h17-6-a',
  name: 'Hero render',
  url: '/uploads/asset-h17-6-a/hero.jpg',
  caption: 'Hero caption',
  alt: 'Hero alt',
})
const assetB = putAsset({
  id: 'asset-h17-6-b',
  name: 'Plan drawing',
  url: '/uploads/asset-h17-6-b/plan.jpg',
  caption: 'Plan caption',
})
const assetC = putAsset({
  id: 'asset-h17-6-c',
  name: 'Detail photo',
  url: '/uploads/asset-h17-6-c/detail.jpg',
  caption: 'Detail caption',
})
const assetsBefore = JSON.stringify(await listAssets())

const detailsPayload = buildServiceEditorPayload({
  name: 'Identity system',
  description: 'Brand offering',
  defaultDescription: 'We will design the identity.',
  pricingModel: defaultService.pricingModel,
  typicalDuration: 'Six weeks',
  templateId: 'tpl-h17-6-legacy',
  deliverables: 'Workshop\nGuidelines',
  contentBlockIds: ['block-exec-summary'],
  assetIds: ['  asset-h17-6-a  ', 'asset-h17-6-a', '', 'asset-h17-6-b'],
})

const serviceModelSource = sourceOf('src', 'models', 'service.js')
const idsSource = sourceOf('src', 'models', 'ids.js')

assert(
  'C. Details payload round-trips assetIds and performs no asset fetch',
  detailsPayload.assetIds.join() === 'asset-h17-6-a,asset-h17-6-b' &&
    detailsPayload.contentBlockIds.join() === 'block-exec-summary' &&
    detailsPayload.templateId === 'tpl-h17-6-legacy' &&
    !Object.hasOwn(detailsPayload, 'blocks') &&
    !serviceModelSource.includes('fetchAssetById') &&
    !serviceModelSource.includes('applyServiceAssetsToTemplate') &&
    idsSource.includes('export function normalizeIdList') &&
    serviceModelSource.includes('normalizeIdList(input.assetIds)') &&
    serviceModelSource.includes('normalizeIdList(values.assetIds)') &&
    serviceModelSource.includes('normalizeContentBlockIds(input.contentBlockIds)') &&
    JSON.stringify(await listAssets()) === assetsBefore,
)

const authoredKeep = makeBlock({
  id: 'blk-keep-h17-6',
  type: BLOCK_TYPE.COVER,
  data: { heading: 'Keep this authored cover' },
})
const linkedTemplate = await createTemplate({
  id: 'tpl-h17-6-linked',
  title: 'H17.6 linked template',
  notes: 'Unrelated notes must survive Apply.',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  contentBlockIds: ['block-keep-h17-6'],
  blocks: [authoredKeep],
})
const templateSnapshot = JSON.stringify(await fetchTemplateById(linkedTemplate.id))

const service = await createService({
  id: 'svc-h17-6-linked',
  name: 'H17.6 service',
  templateId: linkedTemplate.id,
  contentBlockIds: ['block-exec-summary'],
  assetIds: [assetA.id, assetB.id],
})

const detailsSaved = await updateService(
  service.id,
  buildServiceEditorPayload({
    ...service,
    deliverables: (service.deliverables ?? []).join('\n'),
    assetIds: ['  asset-h17-6-a  ', 'asset-h17-6-b'],
  }),
)
const templateAfterDetails = await fetchTemplateById(linkedTemplate.id)

assert(
  'C2. Service Details save persists assetIds without fetching assets or mutating the template',
  detailsSaved.assetIds.join() === `${assetA.id},${assetB.id}` &&
    JSON.stringify(templateAfterDetails) === templateSnapshot &&
    JSON.stringify(await listAssets()) === assetsBefore &&
    !sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
      .split('async function handleSubmit')[1]
      .split('async function handleApplyToTemplate')[0]
      .includes('fetchAssetById') &&
    !sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx').includes('listAssets') &&
    !sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx').includes('useAsyncData') &&
    !sourceOf('src', 'pages', 'Services', 'ServiceForm.jsx').includes('fetchAssetById') &&
    !sourceOf('src', 'pages', 'Services', 'ServiceForm.jsx').includes('listAssets'),
)

const assemblyBeforeCompose = JSON.parse(JSON.stringify(linkedTemplate.blocks))
const composed = await composeTemplateAssets(linkedTemplate, [assetA.id])
const createdItem = galleryItems(composed.blocks).find(
  (item) => item.assetId === assetA.id,
)
const createdGallery = galleryBlocks(composed.blocks)[0]

assert(
  'D. canonical template + missing asset IDs creates GalleryItems with assetId, url, caption, img-* ID',
  composed.added.length === 1 &&
    createdItem?.assetId === assetA.id &&
    createdItem.url === assetA.url &&
    createdItem.caption === assetA.caption &&
    typeof createdItem.id === 'string' &&
    createdItem.id.startsWith('img-') &&
    createdGallery?.type === BLOCK_TYPE.GALLERY &&
    createdGallery.enabled === true &&
    JSON.stringify(linkedTemplate.blocks) === JSON.stringify(assemblyBeforeCompose),
)

assert(
  'E. existing non-gallery blocks remain unchanged',
  composed.blocks[0].id === 'blk-keep-h17-6' &&
    composed.blocks[0].type === BLOCK_TYPE.COVER &&
    composed.blocks[0].data.heading === 'Keep this authored cover' &&
    composed.blocks.filter((block) => block.type !== BLOCK_TYPE.GALLERY).length === 1,
)

const noGalleryTemplate = await createTemplate({
  id: 'tpl-h17-6-no-gallery',
  title: 'H17.6 no gallery',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  contentBlockIds: ['block-keep-h17-6'],
  blocks: [authoredKeep],
})
const noGalleryService = await createService({
  id: 'svc-h17-6-no-gallery',
  name: 'H17.6 no gallery service',
  templateId: noGalleryTemplate.id,
  assetIds: [assetA.id],
})
const appliedGallery = await applyServiceAssetsToTemplate(
  [noGalleryTemplate],
  noGalleryService,
)
const storedGallery = await fetchTemplateById(noGalleryTemplate.id)
const galleries = galleryBlocks(storedGallery.blocks)

assert(
  'F. no Gallery block → one enabled Gallery block on canonical template',
  appliedGallery.updated === true &&
    galleries.length === 1 &&
    galleries[0].enabled === true &&
    galleries[0].data.items.length === 1 &&
    galleries[0].data.items[0].assetId === assetA.id &&
    storedGallery.blocks[0].id === 'blk-keep-h17-6' &&
    storedGallery.contentBlockIds.join() === 'block-keep-h17-6' &&
    !Object.hasOwn(storedGallery, 'assetIds'),
)

const galleryOne = makeBlock({
  id: 'blk-gallery-one-h17-6',
  type: BLOCK_TYPE.GALLERY,
  enabled: true,
  data: {
    items: [
      {
        id: 'img-existing-a',
        assetId: assetA.id,
        url: assetA.url,
        caption: assetA.caption,
      },
    ],
  },
})
const galleryTwo = makeBlock({
  id: 'blk-gallery-two-h17-6',
  type: BLOCK_TYPE.GALLERY,
  enabled: true,
  data: {
    items: [
      {
        id: 'img-existing-b',
        assetId: assetB.id,
        url: assetB.url,
        caption: assetB.caption,
      },
    ],
  },
})
const spreadTemplate = await createTemplate({
  id: 'tpl-h17-6-spread',
  title: 'H17.6 spread galleries',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  contentBlockIds: ['block-keep-h17-6'],
  blocks: [authoredKeep, galleryOne, galleryTwo],
})
const spreadService = await createService({
  id: 'svc-h17-6-spread',
  name: 'H17.6 spread service',
  templateId: spreadTemplate.id,
  assetIds: [assetA.id, assetB.id, assetC.id],
})
const firstSpread = await applyServiceAssetsToTemplate(
  [spreadTemplate],
  spreadService,
)
const afterFirstSpread = await fetchTemplateById(spreadTemplate.id)
const firstSpreadUpdatedAt = afterFirstSpread.updatedAt
const firstSpreadIds = afterFirstSpread.blocks.map((block) => block.id)

resetAssets()
putAsset(assetB)
putAsset(assetC)

const secondSpread = await applyServiceAssetsToTemplate(
  [spreadTemplate],
  spreadService,
)
const afterSecondSpread = await fetchTemplateById(spreadTemplate.id)
const spreadItems = galleryItems(afterSecondSpread.blocks)
const firstGalleryItems = galleryBlocks(afterSecondSpread.blocks)[0]?.data.items ?? []

putAsset(assetA)

assert(
  'G. repeat Apply does not duplicate assetId, including assets spread across multiple Gallery blocks',
  firstSpread.updated === true &&
    secondSpread.updated === false &&
    afterSecondSpread.updatedAt === firstSpreadUpdatedAt &&
    afterSecondSpread.blocks.map((block) => block.id).join() === firstSpreadIds.join() &&
    spreadItems.filter((item) => item.assetId === assetA.id).length === 1 &&
    spreadItems.filter((item) => item.assetId === assetB.id).length === 1 &&
    spreadItems.filter((item) => item.assetId === assetC.id).length === 1 &&
    firstGalleryItems.some((item) => item.assetId === assetC.id) &&
    firstGalleryItems.some((item) => item.id === 'img-existing-a') &&
    afterSecondSpread.blocks[2].data.items[0].id === 'img-existing-b' &&
    afterSecondSpread.blocks[1].data.items.find((item) => item.assetId === assetA.id)
      ?.id === 'img-existing-a' &&
    afterSecondSpread.contentBlockIds.join() === 'block-keep-h17-6',
)

const emptyBefore = await fetchTemplateById(noGalleryTemplate.id)
const emptyApply = await applyServiceAssetsToTemplate([emptyBefore], {
  id: noGalleryService.id,
  templateId: noGalleryTemplate.id,
  assetIds: [],
})
const emptyAfter = await fetchTemplateById(noGalleryTemplate.id)
const composeAssetsSrc = sliceExport(
  sourceOf('src', 'utils', 'templateBlocks.js'),
  'composeTemplateAssets',
)

assert(
  'H. empty assetIds → no fetch and no template persistence',
  emptyApply.updated === false &&
    emptyAfter.updatedAt === emptyBefore.updatedAt &&
    JSON.stringify(emptyAfter) === JSON.stringify(emptyBefore) &&
    composeAssetsSrc.indexOf('requested.length === 0') <
      composeAssetsSrc.indexOf('fetchAssetById') &&
    composeAssetsSrc.includes('return { blocks: currentBlocks, added: [] }') &&
    sliceExport(
      sourceOf('src', 'utils', 'templateBlocks.js'),
      'applyServiceAssetsToTemplate',
    ).indexOf('composed.added.length === 0') <
      sliceExport(
        sourceOf('src', 'utils', 'templateBlocks.js'),
        'applyServiceAssetsToTemplate',
      ).indexOf('updateTemplate'),
)

const unknownBefore = await fetchTemplateById(linkedTemplate.id)
let unknownError = null
try {
  await applyServiceAssetsToTemplate([unknownBefore], {
    id: service.id,
    templateId: linkedTemplate.id,
    assetIds: [assetA.id, 'asset-missing-h17-6'],
  })
} catch (error) {
  unknownError = error
}
const unknownAfter = await fetchTemplateById(linkedTemplate.id)

assert(
  'I. unknown asset ID → existing ValidationError contract and template unchanged',
  unknownError instanceof ValidationError &&
    unknownError.message.includes('asset-missing-h17-6') &&
    JSON.stringify(unknownAfter) === JSON.stringify(unknownBefore) &&
    hasCanonicalBlocks(unknownAfter.blocks),
)

const legacyTemplate = await createTemplate({
  id: 'tpl-h17-6-legacy',
  title: 'H17.6 legacy template',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  sections: [{ heading: 'Scope', body: 'Keep legacy sections.' }],
  items: [{ description: 'Legacy line', amount: 1000 }],
})
const legacyService = await createService({
  id: 'svc-h17-6-legacy',
  name: 'Legacy-linked service',
  templateId: legacyTemplate.id,
  assetIds: [assetA.id],
})
const legacyBefore = await fetchTemplateById(legacyTemplate.id)
let legacyError = null
try {
  await applyServiceAssetsToTemplate([legacyTemplate], legacyService)
} catch (error) {
  legacyError = error
}
const legacyAfter = await fetchTemplateById(legacyTemplate.id)

assert(
  'J. legacy blocks: [] → no silent canonicalization and no persistence',
  legacyError instanceof NotFoundError &&
    legacyError.message.includes('Block Engine') &&
    !hasCanonicalBlocks(legacyAfter.blocks) &&
    legacyAfter.blocks.length === 0 &&
    legacyAfter.sections[0].heading === 'Scope' &&
    JSON.stringify(legacyAfter.blocks) === JSON.stringify(legacyBefore.blocks) &&
    JSON.stringify(legacyAfter.sections) === JSON.stringify(legacyBefore.sections),
)

const storedExtra = makeBlock({
  id: 'blk-store-extra-h17-6',
  type: BLOCK_TYPE.TERMS,
  data: { body: 'Present in store, missing from stale UI snapshot.' },
})
const existingGallery = makeBlock({
  id: 'blk-gallery-stale-h17-6',
  type: BLOCK_TYPE.GALLERY,
  enabled: true,
  data: {
    items: [
      {
        id: 'img-stale-existing-a',
        assetId: assetA.id,
        url: assetA.url,
        caption: assetA.caption,
      },
    ],
  },
})
const freshStoreTemplate = await createTemplate({
  id: 'tpl-h17-6-fresh-store',
  title: 'Fresh store template',
  notes: 'Unrelated notes must survive Apply.',
  defaultLayoutId: LAYOUT_ID.LANDSCAPE,
  sections: [{ heading: 'Scope', body: 'Unrelated section.' }],
  contentBlockIds: ['block-keep-h17-6'],
  blocks: [authoredKeep, storedExtra, existingGallery],
})
const freshStoreService = await createService({
  id: 'svc-h17-6-fresh-store',
  name: 'Fresh store service',
  templateId: freshStoreTemplate.id,
  assetIds: [assetA.id, assetB.id],
})
const staleSnapshot = {
  ...freshStoreTemplate,
  blocks: [authoredKeep],
}
const staleApply = await applyServiceAssetsToTemplate(
  [staleSnapshot],
  freshStoreService,
)
const staleStored = await fetchTemplateById(freshStoreTemplate.id)
const staleItemIds = galleryItems(staleStored.blocks).map((item) => item.id)
const staleUpdatedAt = staleStored.updatedAt

assert(
  'T. stale template snapshot cannot overwrite newer stored blocks',
  staleApply.updated === true &&
    staleStored.blocks.some((block) => block.id === 'blk-keep-h17-6') &&
    staleStored.blocks.some((block) => block.id === 'blk-store-extra-h17-6') &&
    staleStored.blocks.some((block) => block.id === 'blk-gallery-stale-h17-6') &&
    staleStored.blocks.find((block) => block.id === 'blk-store-extra-h17-6')?.data
      .body === 'Present in store, missing from stale UI snapshot.' &&
    galleryItems(staleStored.blocks).some((item) => item.id === 'img-stale-existing-a') &&
    galleryItems(staleStored.blocks).filter((item) => item.assetId === assetA.id)
      .length === 1 &&
    galleryItems(staleStored.blocks).some((item) => item.assetId === assetB.id) &&
    staleStored.notes === 'Unrelated notes must survive Apply.' &&
    staleStored.defaultLayoutId === LAYOUT_ID.LANDSCAPE &&
    staleStored.sections[0].heading === 'Scope' &&
    staleStored.contentBlockIds.join() === 'block-keep-h17-6',
)

const repeatStale = await applyServiceAssetsToTemplate(
  [staleSnapshot],
  freshStoreService,
)
const repeatStored = await fetchTemplateById(freshStoreTemplate.id)

assert(
  'U. repeated Apply is a true persist no-op',
  repeatStale.updated === false &&
    repeatStored.updatedAt === staleUpdatedAt &&
    JSON.stringify(repeatStored.blocks) === JSON.stringify(staleStored.blocks) &&
    galleryItems(repeatStored.blocks).map((item) => item.id).join() ===
      staleItemIds.join() &&
    galleryItems(repeatStored.blocks).filter((item) => item.assetId === assetA.id)
      .length === 1 &&
    galleryItems(repeatStored.blocks).filter((item) => item.assetId === assetB.id)
      .length === 1,
)

const emptyStale = await applyServiceAssetsToTemplate([staleSnapshot], {
  id: freshStoreService.id,
  templateId: freshStoreTemplate.id,
  assetIds: [],
})
const emptyStaleStored = await fetchTemplateById(freshStoreTemplate.id)

assert(
  'V. empty assetIds Apply is a true persist no-op',
  emptyStale.updated === false &&
    emptyStaleStored.updatedAt === staleUpdatedAt &&
    JSON.stringify(emptyStaleStored) === JSON.stringify(repeatStored),
)

assert(
  'K. asset records remain unchanged',
  (await fetchAssetById(assetA.id)).url === assetA.url &&
    (await fetchAssetById(assetA.id)).caption === assetA.caption &&
    (await fetchAssetById(assetB.id)).url === assetB.url &&
    (await fetchAssetById(assetC.id)).caption === assetC.caption &&
    !sourceOf('src', 'utils', 'templateBlocks.js').includes('uploadAsset') &&
    (await listAssets()).some((asset) => asset.id === assetA.id),
)

const helperSource = sourceOf('src', 'utils', 'templateBlocks.js')
const contentApplySrc = sliceExport(helperSource, 'applyServiceComponentsToTemplate')
const contentComposeSrc = sliceExport(helperSource, 'composeTemplateContentBlocks')
const contentFromServiceSrc = sliceExport(helperSource, 'composeTemplateFromService')
const createComposeSrc = sliceExport(helperSource, 'composeServiceComponentsForCreate')
const proposalApplySrc = sliceExport(helperSource, 'applyServiceComponentsToProposal')
const assetApplySrc = sliceExport(helperSource, 'applyServiceAssetsToTemplate')
const formSource = sourceOf('src', 'pages', 'Services', 'ServiceForm.jsx')
const editorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')

assert(
  'L. existing Content Library Apply helper contains no fetchAssetById()',
  !contentApplySrc.includes('fetchAssetById') &&
    !contentComposeSrc.includes('fetchAssetById') &&
    !contentFromServiceSrc.includes('fetchAssetById') &&
    !contentApplySrc.includes('composeTemplateAssets') &&
    !contentApplySrc.includes('applyServiceAssetsToTemplate') &&
    formSource.includes('Apply Default Components to Template') &&
    formSource.includes('Apply Assets to Template') &&
    editorSource.includes('applyServiceComponentsToTemplate') &&
    editorSource.includes('applyServiceAssetsToTemplate') &&
    !editorSource.includes('listAssets') &&
    assetApplySrc.includes('fetchTemplateById(resolved.id)') &&
    assetApplySrc.includes('composeTemplateAssets(stored, service?.assetIds)') &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes('fetchAssetById'),
)

assert(
  'M. create-time Content Library composition remains asset-fetch-free',
  !createComposeSrc.includes('fetchAssetById') &&
    !createComposeSrc.includes('composeTemplateAssets') &&
    !proposalApplySrc.includes('fetchAssetById') &&
    !sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx').includes(
      'applyServiceAssetsToTemplate',
    ) &&
    !sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'applyServiceAssetsToTemplate',
    ) &&
    assetApplySrc.includes('updateTemplate(stored.id, {') &&
    /updateTemplate\(stored\.id,\s*\{\s*blocks: composed\.blocks,\s*\}\)/.test(
      assetApplySrc,
    ) &&
    !assetApplySrc.includes('contentBlockIds'),
)

runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'N. H17.5.2 verifier remains green',
)
runVerifier(
  'verify-proposal-service-composition.mjs',
  'O. H17.5.1 verifier remains green',
)
runVerifier(
  'verify-template-service-composition.mjs',
  'P. H17.4 verifier remains green',
)
runVerifier('verify-template-composition.mjs', 'Q. H17.3 verifier remains green')
runVerifier(
  'verify-template-block-authoring.mjs',
  'R. H17.2 verifier remains green',
)
runVerifier(
  'verify-template-block-assembly.mjs',
  'S. H17.1 verifier remains green',
)

resetAssets()
await resetServices()
resetTemplates()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
