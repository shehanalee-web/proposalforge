import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { isBlockEditorKnowledgeEnabled } from '../src/blocks/editor/knowledgeGate.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { makeProposal } from '../src/models/proposal.js'
import {
  buildServiceEditorPayload,
  findTemplateForService,
  makeService,
} from '../src/models/service.js'
import { NotFoundError } from '../src/services/errors.js'
import {
  deleteLibraryBlock,
  fetchLibraryBlockById,
  resetLibraryBlocks,
  updateLibraryBlock,
} from '../src/services/libraryBlockService.js'
import {
  createService,
  resetServices,
  updateService,
} from '../src/services/serviceService.js'
import {
  createTemplate,
  fetchTemplateById,
  resetTemplates,
  updateTemplate,
} from '../src/services/templateService.js'
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import {
  applyServiceComponentsToTemplate,
  composeTemplateFromService,
  hasCanonicalBlocks,
} from '../src/utils/templateBlocks.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function sourceOf(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
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

await resetLibraryBlocks()
await resetServices()
resetTemplates()

const defaultService = makeService({
  id: 'svc-h17-4-default',
  name: 'Default service',
})

assert(
  'A. makeService() defaults contentBlockIds to []',
  Array.isArray(defaultService.contentBlockIds) &&
    defaultService.contentBlockIds.length === 0,
)

const detailsPayload = buildServiceEditorPayload({
  name: 'Identity system',
  description: 'Brand offering',
  defaultDescription: 'We will design the identity.',
  pricingModel: defaultService.pricingModel,
  typicalDuration: 'Six weeks',
  templateId: 'tpl-h17-4-legacy',
  deliverables: 'Workshop\nGuidelines',
  contentBlockIds: ['  block-exec-summary  ', 'block-exec-summary', ''],
})

assert(
  'B. Service Details save round-trips normalized contentBlockIds without fetching the library',
  detailsPayload.contentBlockIds.join() === 'block-exec-summary' &&
    detailsPayload.templateId === 'tpl-h17-4-legacy' &&
    !Object.hasOwn(detailsPayload, 'blocks') &&
    !sourceOf('src', 'models', 'service.js').includes('fetchLibraryBlockById') &&
    !sourceOf('src', 'models', 'service.js').includes('composeTemplateFromService'),
)

const libraryId = 'block-exec-summary'
const sourceBefore = await fetchLibraryBlockById(libraryId)
const sourceSnapshot = JSON.stringify(sourceBefore)
const sourceUseCount = sourceBefore.useCount

const authoredKeep = makeBlock({
  id: 'blk-keep-h17-4',
  type: BLOCK_TYPE.COVER,
  data: { heading: 'Keep this authored cover' },
})

const linkedTemplate = await createTemplate({
  id: 'tpl-h17-4-linked',
  title: 'H17.4 linked template',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep],
})

const service = await createService({
  id: 'svc-h17-4-linked',
  name: 'H17.4 service',
  templateId: linkedTemplate.id,
  contentBlockIds: [libraryId],
})
const serviceSnapshot = JSON.stringify(service)

const composed = await composeTemplateFromService(linkedTemplate, service)
const created = composed.blocks.find((block) => block.libraryId === libraryId)

assert(
  'C. composeTemplateFromService materializes through existing insertLibraryBlock()',
  composed.blocks.length === 2 &&
    created?.type === sourceBefore.type &&
    created.data.body === sourceBefore.data.body &&
    composed.contentBlockIds.includes(libraryId),
)

assert(
  'D. New instances receive new blk- IDs and preserve libraryId',
  typeof created.id === 'string' &&
    created.id.startsWith('blk-') &&
    created.id !== libraryId &&
    created.id !== sourceBefore.id &&
    created.libraryId === libraryId,
)

const sourceAfterCompose = await fetchLibraryBlockById(libraryId)
assert(
  'E. Source library records remain unchanged',
  JSON.stringify(sourceAfterCompose) === sourceSnapshot &&
    sourceAfterCompose.useCount === sourceUseCount,
)

assert(
  'F. Service record remains unchanged by composition',
  JSON.stringify(service) === serviceSnapshot &&
    service.contentBlockIds.join() === libraryId &&
    service.templateId === linkedTemplate.id,
)

const composedAgain = await composeTemplateFromService(
  { blocks: composed.blocks },
  { contentBlockIds: [libraryId, libraryId] },
)
assert(
  'G. Repeated Apply does not duplicate an existing libraryId',
  composedAgain.blocks.length === composed.blocks.length &&
    composedAgain.blocks.filter((block) => block.libraryId === libraryId).length === 1 &&
    composedAgain.blocks[0].id === 'blk-keep-h17-4',
)

let unknownError = null
try {
  await composeTemplateFromService(composed, { contentBlockIds: ['block-missing-h17-4'] })
} catch (error) {
  unknownError = error
}

assert(
  'H. Unknown library ID produces existing NotFoundError and no fake block',
  unknownError instanceof NotFoundError &&
    unknownError.message.includes('block-missing-h17-4'),
)

const persisted = await updateTemplate(linkedTemplate.id, {
  blocks: composed.blocks,
  contentBlockIds: composed.contentBlockIds,
})
const templateBeforeMutation = JSON.parse(JSON.stringify(persisted))

await updateLibraryBlock(libraryId, {
  data: { body: 'MUTATED LIBRARY BODY' },
})
await deleteLibraryBlock(libraryId)

const proposalPayload = proposalFromTemplate(persisted, service)
const proposal = makeProposal(proposalPayload)

assert(
  'I. proposalFromTemplate does not fetch the library and copies template.blocks only',
  Array.isArray(proposalPayload.blocks) &&
    proposalPayload.blocks.length === persisted.blocks.length &&
    proposalPayload.blocks.some((block) => block.data.body === sourceBefore.data.body) &&
    proposalPayload.blocks.every((block) => block.data.body !== 'MUTATED LIBRARY BODY') &&
    JSON.stringify(persisted.blocks) === JSON.stringify(templateBeforeMutation.blocks),
)

assert(
  'J. Proposal block IDs differ from template block IDs',
  proposal.blocks.length === persisted.blocks.length &&
    proposal.blocks.every((block, index) => block.id !== persisted.blocks[index].id) &&
    proposal.blocks.some((block) => block.libraryId === libraryId),
)

const storedAfterMutation = await fetchTemplateById(persisted.id)
assert(
  'K. Mutating the library after Apply does not mutate the stored template or already-created proposal',
  storedAfterMutation.blocks.find((block) => block.libraryId === libraryId)?.data.body ===
    sourceBefore.data.body &&
    proposal.blocks.find((block) => block.libraryId === libraryId)?.data.body ===
      sourceBefore.data.body &&
    storedAfterMutation.blocks[0].id === 'blk-keep-h17-4',
)

const emptyCompose = await composeTemplateFromService(persisted, {
  contentBlockIds: [],
})
assert(
  'L. Service with contentBlockIds=[] is a no-op',
  emptyCompose.blocks.map((block) => block.id).join() ===
    persisted.blocks.map((block) => block.id).join() &&
    emptyCompose.blocks.length === persisted.blocks.length,
)

const legacyTemplate = await createTemplate({
  id: 'tpl-h17-4-legacy',
  title: 'H17.4 legacy template',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  sections: [{ heading: 'Scope', body: 'Keep legacy sections.' }],
  items: [{ description: 'Legacy line', amount: 1000 }],
})
const legacyService = await createService({
  id: 'svc-h17-4-legacy',
  name: 'Legacy-linked service',
  templateId: legacyTemplate.id,
  contentBlockIds: ['block-about-us'],
})
const detailsSave = buildServiceEditorPayload({
  ...legacyService,
  deliverables: (legacyService.deliverables ?? []).join('\n'),
})
await updateService(legacyService.id, detailsSave)
const legacyAfterSave = await fetchTemplateById(legacyTemplate.id)

assert(
  'M. Ordinary Service Details save does not convert a legacy blocks:[] template',
  !hasCanonicalBlocks(legacyAfterSave.blocks) &&
    legacyAfterSave.blocks.length === 0 &&
    legacyAfterSave.sections[0].heading === 'Scope' &&
    findTemplateForService([legacyAfterSave], legacyService)?.id === legacyTemplate.id,
)

await resetLibraryBlocks()
const applyTarget = findTemplateForService([legacyAfterSave], legacyService)
const appliedLegacy = await composeTemplateFromService(applyTarget, legacyService)
const savedLegacyCanonical = await updateTemplate(legacyTemplate.id, {
  blocks: appliedLegacy.blocks,
  contentBlockIds: appliedLegacy.contentBlockIds,
})

assert(
  'N. Explicit Apply can intentionally materialize into a legacy template',
  hasCanonicalBlocks(savedLegacyCanonical.blocks) &&
    savedLegacyCanonical.blocks.some((block) => block.libraryId === 'block-about-us') &&
    savedLegacyCanonical.contentBlockIds.includes('block-about-us'),
)

assert(
  'O. Apply does not destroy pre-existing manually authored template blocks',
  persisted.blocks[0].id === 'blk-keep-h17-4' &&
    persisted.blocks[0].data.heading === 'Keep this authored cover' &&
    persisted.blocks.some((block) => block.libraryId === libraryId),
)

const storedExtra = makeBlock({
  id: 'blk-store-extra-h17-4',
  type: BLOCK_TYPE.TERMS,
  data: { body: 'Present in store, missing from stale UI snapshot.' },
})
const freshStoreTemplate = await createTemplate({
  id: 'tpl-h17-4-fresh-store',
  title: 'Fresh store template',
  notes: 'Unrelated notes must survive Apply.',
  defaultLayoutId: LAYOUT_ID.LANDSCAPE,
  sections: [{ heading: 'Scope', body: 'Unrelated section.' }],
  blocks: [authoredKeep, storedExtra],
})
const freshStoreService = await createService({
  id: 'svc-h17-4-fresh-store',
  name: 'Fresh store service',
  templateId: freshStoreTemplate.id,
  contentBlockIds: ['block-about-us'],
})
const staleSnapshot = {
  ...freshStoreTemplate,
  blocks: [authoredKeep],
}
const firstApply = await applyServiceComponentsToTemplate(
  [staleSnapshot],
  freshStoreService,
)
const firstStored = await fetchTemplateById(freshStoreTemplate.id)
const firstIds = firstStored.blocks.map((block) => block.id)
const firstUpdatedAt = firstStored.updatedAt

assert(
  'U. Apply uses the stored template, not a stale UI snapshot',
  firstApply.updated === true &&
    firstIds.includes('blk-keep-h17-4') &&
    firstIds.includes('blk-store-extra-h17-4') &&
    firstStored.blocks.some((block) => block.libraryId === 'block-about-us') &&
    firstStored.notes === 'Unrelated notes must survive Apply.' &&
    firstStored.defaultLayoutId === LAYOUT_ID.LANDSCAPE &&
    firstStored.sections[0].heading === 'Scope' &&
    firstStored.title === 'Fresh store template',
)

const secondApply = await applyServiceComponentsToTemplate(
  [staleSnapshot],
  freshStoreService,
)
const secondStored = await fetchTemplateById(freshStoreTemplate.id)

assert(
  'V. Repeated Apply against stored template keeps instance IDs and does not duplicate',
  secondApply.updated === false &&
    secondStored.updatedAt === firstUpdatedAt &&
    secondStored.blocks.map((block) => block.id).join() === firstIds.join() &&
    secondStored.blocks.filter((block) => block.libraryId === 'block-about-us').length === 1,
)

const emptyApply = await applyServiceComponentsToTemplate([firstStored], {
  id: freshStoreService.id,
  templateId: freshStoreTemplate.id,
  contentBlockIds: [],
})
const emptyStored = await fetchTemplateById(freshStoreTemplate.id)

assert(
  'W. Empty contentBlockIds Apply is a true no-op',
  emptyApply.updated === false &&
    emptyStored.updatedAt === firstUpdatedAt &&
    emptyStored.blocks.map((block) => block.id).join() === firstIds.join() &&
    emptyStored.notes === 'Unrelated notes must survive Apply.',
)

assert(
  'X. Service Editor Apply path fetches the stored template before compose',
  sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx').includes(
    'applyServiceComponentsToTemplate',
  ) &&
    sourceOf('src', 'utils', 'templateBlocks.js').includes('fetchTemplateById') &&
    sourceOf('src', 'utils', 'templateBlocks.js').includes(
      'applyServiceComponentsToTemplate',
    ),
)

runVerifier('verify-template-composition.mjs', 'P. H17.3 verifier remains green')
runVerifier('verify-template-block-authoring.mjs', 'Q. H17.2 verifier remains green')
runVerifier('verify-template-block-assembly.mjs', 'R. H17.1 verifier remains green')

assert(
  'S. Template Studio still uses knowledgeCompanyId={null}',
  isBlockEditorKnowledgeEnabled(null) === false &&
    sourceOf('src', 'pages', 'Templates', 'TemplateForm.jsx').includes(
      'knowledgeCompanyId={null}',
    ) &&
    sourceOf('src', 'pages', 'Services', 'ServiceForm.jsx').includes(
      'Apply Default Components to Template',
    ),
)

assert(
  'T. Composition does not call touchLibraryBlock()',
  !sourceOf('src', 'utils', 'templateBlocks.js').includes('touchLibraryBlock') &&
    !sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx').includes('touchLibraryBlock') &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes('fetchLibraryBlockById'),
)

await resetLibraryBlocks()
await resetServices()
resetTemplates()

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
