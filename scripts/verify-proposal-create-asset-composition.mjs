import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_BLOCK_SEQUENCE } from '../src/blocks/hydrate.js'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { findTemplateForService } from '../src/models/service.js'
import { NotFoundError, ValidationError } from '../src/services/errors.js'
import {
  fetchAssetById,
  listAssets,
  putAsset,
  resetAssets,
} from '../src/services/assetService.js'
import { fetchLibraryBlockById, resetLibraryBlocks } from '../src/services/libraryBlockService.js'
import {
  createProposal,
  loadStoredProposalById,
  resetProposals,
} from '../src/services/proposalService.js'
import { createService, resetServices } from '../src/services/serviceService.js'
import {
  createTemplate,
  fetchTemplateById,
  resetTemplates,
} from '../src/services/templateService.js'
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import {
  composeServiceAssetsForCreate,
  composeServiceComponentsForCreate,
} from '../src/utils/templateBlocks.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const DEFAULT_CLIENT_NAME = 'New client'

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

function createPayload(service, extras = {}) {
  return {
    ...extras,
    title: extras.title || `${service.name} proposal`,
    clientName: extras.clientName?.trim() || DEFAULT_CLIENT_NAME,
    projectType: service.name,
    serviceIds: [service.id],
    summary:
      extras.summary ||
      service.defaultDescription ||
      service.description,
  }
}

async function createFromService(service, templates) {
  const template = findTemplateForService(templates, service)
  const extras = template ? proposalFromTemplate(template, service) : {}
  const payload = createPayload(service, extras)
  const composed = await composeServiceAssetsForCreate(
    await composeServiceComponentsForCreate(payload, service),
    service,
  )
  return createProposal(composed)
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
await resetLibraryBlocks()
await resetServices()
resetTemplates()
await resetProposals()

const helperSource = sourceOf('src', 'utils', 'templateBlocks.js')
const createAssetSrc = sliceExport(helperSource, 'composeServiceAssetsForCreate')
const createComposeSrc = sliceExport(helperSource, 'composeServiceComponentsForCreate')
const composeAssetsSrc = sliceExport(helperSource, 'composeTemplateAssets')
const proposalAssetApplySrc = sliceExport(helperSource, 'applyServiceAssetsToProposal')
const templateAssetApplySrc = sliceExport(helperSource, 'applyServiceAssetsToTemplate')
const createPageSource = sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx')
const editorSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const formSource = sourceOf('src', 'pages', 'NewProposal', 'ProposalForm.jsx')
const serviceEditorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
const fromTemplateSource = sourceOf('src', 'utils', 'proposalFromTemplate.js')

assert(
  'A. composeServiceAssetsForCreate exists and reuses composeTemplateAssets',
  createAssetSrc.includes('export async function composeServiceAssetsForCreate') &&
    createAssetSrc.includes('composeTemplateAssets(') &&
    createAssetSrc.includes('{ ...payload, blocks: initialBlocks }') &&
    createAssetSrc.includes('service?.assetIds') &&
    createAssetSrc.includes('ensureProposalBlocks(payload)') &&
    !createAssetSrc.includes('createProposal') &&
    !createAssetSrc.includes('updateProposal') &&
    !createAssetSrc.includes('loadStoredProposalById') &&
    !createAssetSrc.includes('fetchProposalById') &&
    !createAssetSrc.includes('applyServiceAssetsToProposal') &&
    !createAssetSrc.includes('applyServiceAssetsToTemplate') &&
    !createAssetSrc.includes('makeGalleryItem') &&
    composeAssetsSrc.includes('export async function composeTemplateAssets'),
)

const assetA = putAsset({
  id: 'asset-h17-8-a',
  name: 'Hero render',
  url: '/uploads/asset-h17-8-a/hero.jpg',
  caption: 'Hero caption',
})
const assetB = putAsset({
  id: 'asset-h17-8-b',
  name: 'Plan drawing',
  url: '/uploads/asset-h17-8-b/plan.jpg',
  caption: 'Plan caption',
})
const assetsBefore = JSON.stringify(await listAssets())

const authoredKeep = makeBlock({
  id: 'blk-keep-h17-8',
  type: BLOCK_TYPE.COVER,
  data: { heading: 'Keep this authored cover' },
})
const disabledGallery = makeBlock({
  id: 'blk-gallery-disabled-h17-8',
  type: BLOCK_TYPE.GALLERY,
  enabled: false,
  data: { items: [] },
})

const linkedTemplate = await createTemplate({
  id: 'tpl-h17-8-linked',
  title: 'H17.8 linked template',
  notes: 'Template notes must survive create-time asset composition.',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep, disabledGallery],
})
const templateSnapshot = JSON.stringify(await fetchTemplateById(linkedTemplate.id))

const service = await createService({
  id: 'svc-h17-8-linked',
  name: 'H17.8 service',
  templateId: linkedTemplate.id,
  assetIds: [assetA.id, assetB.id],
})

const created = await createFromService(service, [linkedTemplate])
const stored = await loadStoredProposalById(created.id)
const createdItems = galleryItems(stored.blocks)
const createdA = createdItems.find((item) => item.assetId === assetA.id)
const createdB = createdItems.find((item) => item.assetId === assetB.id)
const copiedCover = stored.blocks.find(
  (block) => block.type === BLOCK_TYPE.COVER && block.data.heading === 'Keep this authored cover',
)
const createdGalleries = galleryBlocks(stored.blocks)

assert(
  'B. Happy path: service.assetIds become Gallery items',
  stored.serviceIds.join() === service.id &&
    stored.projectType === service.name &&
    stored.clientName === DEFAULT_CLIENT_NAME &&
    createdItems.length === 2 &&
    Boolean(createdA) &&
    Boolean(createdB) &&
    createdGalleries.length === 1 &&
    createdGalleries[0].enabled === true,
)

assert(
  'C. Gallery items preserve assetId, url, caption, and img-* ids',
  createdA.assetId === assetA.id &&
    createdA.url === assetA.url &&
    createdA.caption === assetA.caption &&
    createdB.assetId === assetB.id &&
    createdB.url === assetB.url &&
    createdB.caption === assetB.caption &&
    typeof createdA.id === 'string' &&
    createdA.id.startsWith('img-') &&
    createdB.id.startsWith('img-') &&
    createdA.id !== createdB.id,
)

const emptyService = await createService({
  id: 'svc-h17-8-empty',
  name: 'H17.8 empty ids',
  templateId: linkedTemplate.id,
  assetIds: [],
})
const emptyExtras = proposalFromTemplate(linkedTemplate, emptyService)
const emptyPayload = createPayload(emptyService, emptyExtras)
const emptyComposed = await composeServiceAssetsForCreate(
  await composeServiceComponentsForCreate(emptyPayload, emptyService),
  emptyService,
)
const absentService = await createService({
  id: 'svc-h17-8-absent',
  name: 'H17.8 absent ids',
  templateId: linkedTemplate.id,
})
const absentPayload = {
  title: `${absentService.name} proposal`,
  clientName: DEFAULT_CLIENT_NAME,
  projectType: absentService.name,
  serviceIds: [absentService.id],
}
const absentComposed = await composeServiceAssetsForCreate(
  await composeServiceComponentsForCreate(absentPayload, absentService),
  absentService,
)
const emptyCreated = await createProposal(emptyComposed)
const emptyStored = await loadStoredProposalById(emptyCreated.id)

assert(
  'D. Empty/absent assetIds return the original payload unchanged',
  emptyComposed === emptyPayload &&
    absentComposed === absentPayload &&
    !Object.hasOwn(absentComposed, 'blocks') &&
    galleryItems(emptyStored.blocks).length === 0 &&
    createAssetSrc.indexOf('requested.length === 0') <
      createAssetSrc.indexOf('ensureProposalBlocks') &&
    createAssetSrc.indexOf('requested.length === 0') <
      createAssetSrc.indexOf('composeTemplateAssets') &&
    !createAssetSrc.includes('fetchAssetById'),
)

const unknownId = 'prop-h17-8-unknown'
const unknownService = await createService({
  id: 'svc-h17-8-unknown',
  name: 'H17.8 unknown asset',
  templateId: linkedTemplate.id,
  assetIds: [assetA.id, 'asset-missing-h17-8'],
})
let unknownError = null
let unknownCreateReached = false
try {
  const extras = proposalFromTemplate(linkedTemplate, unknownService)
  const payload = { ...createPayload(unknownService, extras), id: unknownId }
  const composed = await composeServiceAssetsForCreate(
    await composeServiceComponentsForCreate(payload, unknownService),
    unknownService,
  )
  unknownCreateReached = true
  await createProposal(composed)
} catch (error) {
  unknownError = error
}
let unknownStored = false
try {
  await loadStoredProposalById(unknownId)
  unknownStored = true
} catch (error) {
  unknownStored = !(error instanceof NotFoundError)
}

assert(
  'E. Unknown assetId throws ValidationError and creates no proposal row',
  unknownError instanceof ValidationError &&
    unknownError.message.includes('asset-missing-h17-8') &&
    unknownCreateReached === false &&
    unknownStored === false,
)

const alreadyGallery = makeBlock({
  id: 'blk-gallery-already-h17-8',
  type: BLOCK_TYPE.GALLERY,
  enabled: true,
  data: {
    items: [
      {
        id: 'img-existing-a-h17-8',
        assetId: assetA.id,
        url: assetA.url,
        caption: assetA.caption,
      },
    ],
  },
})
const alreadyTemplate = await createTemplate({
  id: 'tpl-h17-8-already',
  title: 'H17.8 already composed template',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep, alreadyGallery],
})
const alreadyService = await createService({
  id: 'svc-h17-8-already',
  name: 'H17.8 already composed',
  templateId: alreadyTemplate.id,
  assetIds: [assetA.id, assetB.id],
})
const alreadyCreated = await createFromService(alreadyService, [alreadyTemplate])
const alreadyStored = await loadStoredProposalById(alreadyCreated.id)
const alreadyItems = galleryItems(alreadyStored.blocks)

assert(
  'F. Existing assetId in any copied Gallery is not duplicated',
  alreadyItems.filter((item) => item.assetId === assetA.id).length === 1 &&
    alreadyItems.filter((item) => item.assetId === assetB.id).length === 1 &&
    alreadyItems.length === 2 &&
    alreadyStored.blocks.some(
      (block) =>
        block.type === BLOCK_TYPE.COVER &&
        block.data.heading === 'Keep this authored cover',
    ),
)

const noGalleryTemplate = await createTemplate({
  id: 'tpl-h17-8-noglry',
  title: 'H17.8 no gallery template',
  notes: 'Cover-only template notes.',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep],
})
const noGalleryService = await createService({
  id: 'svc-h17-8-noglry',
  name: 'H17.8 no gallery',
  templateId: noGalleryTemplate.id,
  assetIds: [assetA.id],
})
const noGalleryCreated = await createFromService(noGalleryService, [noGalleryTemplate])
const noGalleryStored = await loadStoredProposalById(noGalleryCreated.id)
const noGalleryGalleries = galleryBlocks(noGalleryStored.blocks)

assert(
  'G. Template with no Gallery gets one enabled Gallery',
  noGalleryGalleries.length === 1 &&
    noGalleryGalleries[0].enabled === true &&
    galleryItems(noGalleryStored.blocks).length === 1 &&
    galleryItems(noGalleryStored.blocks)[0].assetId === assetA.id &&
    noGalleryStored.blocks.some(
      (block) =>
        block.type === BLOCK_TYPE.COVER &&
        block.data.heading === 'Keep this authored cover',
    ),
)

const noTemplateService = await createService({
  id: 'svc-h17-8-none',
  name: 'H17.8 no template',
  assetIds: [assetA.id],
})
const noTemplateCreated = await createFromService(noTemplateService, [])
const noTemplateStored = await loadStoredProposalById(noTemplateCreated.id)
const noTemplateGalleries = galleryBlocks(noTemplateStored.blocks)
const defaultGalleryIndex = DEFAULT_BLOCK_SEQUENCE.findIndex(
  (step) => step.type === BLOCK_TYPE.GALLERY,
)

assert(
  'H. No-template create hydrates DEFAULT_BLOCK_SEQUENCE and enables the default Gallery',
  noTemplateStored.blocks.length === DEFAULT_BLOCK_SEQUENCE.length &&
    DEFAULT_BLOCK_SEQUENCE.every((step, index) => {
      const block = noTemplateStored.blocks[index]
      if (step.type === BLOCK_TYPE.GALLERY) {
        return block?.type === BLOCK_TYPE.GALLERY && block.enabled === true
      }
      return block?.type === step.type && block.enabled === step.enabled
    }) &&
    noTemplateGalleries.length === 1 &&
    noTemplateGalleries[0] === noTemplateStored.blocks[defaultGalleryIndex] &&
    galleryItems(noTemplateStored.blocks)[0]?.assetId === assetA.id,
)

assert(
  'I. Disabled Gallery becomes enabled when assets are added',
  createdGalleries[0].enabled === true &&
    createdGalleries[0].type === BLOCK_TYPE.GALLERY &&
    JSON.parse(templateSnapshot).blocks.find((block) => block.type === BLOCK_TYPE.GALLERY)
      ?.enabled === false,
)

assert(
  'J. Non-gallery blocks and unrelated fields survive',
  copiedCover &&
    copiedCover.id !== 'blk-keep-h17-8' &&
    stored.notes === linkedTemplate.notes &&
    stored.layoutId === LAYOUT_ID.PORTRAIT &&
    stored.title === linkedTemplate.title &&
    createdGalleries[0].id !== disabledGallery.id,
)

const libraryId = 'block-about-us'
const libraryBefore = await fetchLibraryBlockById(libraryId)
const librarySnapshot = JSON.stringify(libraryBefore)
const bothTemplate = await createTemplate({
  id: 'tpl-h17-8-both',
  title: 'H17.8 content and assets',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep],
})
const bothService = await createService({
  id: 'svc-h17-8-both',
  name: 'H17.8 both',
  templateId: bothTemplate.id,
  contentBlockIds: [libraryId],
  assetIds: [assetA.id],
})
const bothCreated = await createFromService(bothService, [bothTemplate])
const bothStored = await loadStoredProposalById(bothCreated.id)
const bothLibrary = bothStored.blocks.find((block) => block.libraryId === libraryId)
const bothCoverIndex = bothStored.blocks.findIndex(
  (block) => block.type === BLOCK_TYPE.COVER && block.data.heading === 'Keep this authored cover',
)
const bothLibraryIndex = bothStored.blocks.findIndex((block) => block.libraryId === libraryId)
const bothGalleryIndex = bothStored.blocks.findIndex((block) => block.type === BLOCK_TYPE.GALLERY)

assert(
  'K. Content composition happens first, then asset composition',
  bothCoverIndex === 0 &&
    bothLibraryIndex === 1 &&
    bothGalleryIndex === 2 &&
    bothLibrary?.libraryId === libraryId &&
    bothLibrary.data.body === libraryBefore.data.body &&
    galleryItems(bothStored.blocks)[0]?.assetId === assetA.id &&
    createPageSource.includes('composeServiceComponentsForCreate(payload, service)') &&
    createPageSource.includes('composeServiceAssetsForCreate(') &&
    createPageSource.includes(
      'await composeServiceComponentsForCreate(payload, service)',
    ) &&
    createPageSource.indexOf('composeServiceComponentsForCreate') <
      createPageSource.indexOf('composeServiceAssetsForCreate'),
)

const createCallCount = createPageSource.split('create(composed)').length - 1

assert(
  'L. Persistence is a single create(composed) with no helper persist',
  createCallCount === 1 &&
    createPageSource.includes('create(composed)') &&
    !createPageSource.includes('updateProposal') &&
    !createPageSource.includes('createProposal(') &&
    !createAssetSrc.includes('createProposal') &&
    !createAssetSrc.includes('updateProposal') &&
    !helperSource.includes('createProposal('),
)

assert(
  'M. proposalFromTemplate remains synchronous and asset-fetch-free',
  !fromTemplateSource.includes('fetchAssetById') &&
    !fromTemplateSource.includes('composeTemplateAssets') &&
    !fromTemplateSource.includes('composeServiceAssetsForCreate') &&
    !fromTemplateSource.includes('async ') &&
    createPageSource.includes('proposalFromTemplate(template, service)'),
)

const assetAfter = await fetchAssetById(assetA.id)
const templateAfter = await fetchTemplateById(linkedTemplate.id)

assert(
  'N. Created proposal has no assetIds; assets/templates unchanged; no uploadAsset',
  !Object.hasOwn(stored, 'assetIds') &&
    JSON.stringify(await listAssets()) === assetsBefore &&
    assetAfter.url === assetA.url &&
    assetAfter.caption === assetA.caption &&
    JSON.stringify(templateAfter) === templateSnapshot &&
    JSON.stringify(await fetchLibraryBlockById(libraryId)) === librarySnapshot &&
    !createAssetSrc.includes('uploadAsset') &&
    !createPageSource.includes('uploadAsset') &&
    !createPageSource.includes('listAssets'),
)

assert(
  'O. CreateProposal does not call Apply helpers or composeTemplateAssets directly',
  !createPageSource.includes('applyServiceAssetsToProposal') &&
    !createPageSource.includes('applyServiceAssetsToTemplate') &&
    !createPageSource.includes('composeTemplateAssets') &&
    createPageSource.includes('composeServiceAssetsForCreate('),
)

assert(
  'P. Duplicate dialog / duplicateDraft remain unwired',
  !sourceOf('src', 'components', 'CreateProposal', 'CreateProposalDialog.jsx').includes(
    'composeServiceAssetsForCreate',
  ) &&
    !sourceOf('src', 'utils', 'duplicateDraft.js').includes('composeServiceAssetsForCreate') &&
    !sourceOf('src', 'utils', 'duplicateDraft.js').includes('composeTemplateAssets') &&
    !createPageSource.includes('applyServiceComponentsToProposal'),
)

assert(
  'Q. composeServiceComponentsForCreate remains asset-fetch-free',
  !createComposeSrc.includes('fetchAssetById') &&
    !createComposeSrc.includes('composeTemplateAssets') &&
    !createComposeSrc.includes('composeServiceAssetsForCreate') &&
    createComposeSrc.includes('composeTemplateFromService'),
)

assert(
  'R. Ordinary Save, H17.7 Apply, and H17.6 Apply remain separate',
  editorSource.includes('toEditableChanges(values, documentBlocks)') &&
    editorSource.includes('applyServiceAssetsToProposal') &&
    formSource.includes('Apply Assets to Proposal') &&
    serviceEditorSource.includes('applyServiceAssetsToTemplate') &&
    !editorSource.includes('composeServiceAssetsForCreate') &&
    !editorSource.includes('composeTemplateAssets') &&
    proposalAssetApplySrc.includes('loadStoredProposalById(proposalId)') &&
    templateAssetApplySrc.includes('fetchTemplateById(resolved.id)') &&
    !createPageSource.includes('toEditableChanges'),
)

runVerifier(
  'verify-proposal-asset-composition.mjs',
  'S. H17.7 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'T. H17.5.2 verifier remains green',
)

resetAssets()
await resetLibraryBlocks()
await resetServices()
resetTemplates()
await resetProposals()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
