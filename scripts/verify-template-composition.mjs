import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { insertLibraryBlock, makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { DEFAULT_BLOCK_SEQUENCE } from '../src/blocks/hydrate.js'
import { isBlockEditorKnowledgeEnabled } from '../src/blocks/editor/knowledgeGate.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { makeProposal } from '../src/models/proposal.js'
import { makeTemplate } from '../src/models/template.js'
import { NotFoundError } from '../src/services/errors.js'
import {
  deleteLibraryBlock,
  fetchLibraryBlockById,
  resetLibraryBlocks,
  updateLibraryBlock,
} from '../src/services/libraryBlockService.js'
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import { toDuplicateTemplate } from '../src/utils/duplicateTemplate.js'
import {
  buildTemplateEditorPayload,
  composeTemplateContentBlocks,
  contentBlockIdsFromBlocks,
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

await resetLibraryBlocks()

const defaultTemplate = makeTemplate({
  id: 'tpl-composition-default',
  title: 'Default template',
})

assert(
  'A. makeTemplate() defaults contentBlockIds to []',
  Array.isArray(defaultTemplate.contentBlockIds) &&
    defaultTemplate.contentBlockIds.length === 0 &&
    defaultTemplate.blocks.length === 0,
)

const authoredBlocks = [
  makeBlock({
    id: 'blk-tpl-cover',
    type: BLOCK_TYPE.COVER,
    enabled: true,
    libraryId: 'lib-cover-hero',
    data: { heading: 'Northwind brand system' },
  }),
  makeBlock({
    id: 'blk-tpl-pricing',
    type: BLOCK_TYPE.PRICING,
    enabled: true,
    data: {
      notes: 'Fixed engagement',
      items: [{ id: 'item-brand', description: 'Brand system', amount: 18000 }],
    },
  }),
  makeBlock({
    id: 'blk-tpl-terms',
    type: BLOCK_TYPE.TERMS,
    enabled: true,
    libraryId: 'lib-cover-hero',
    data: { body: 'Net 30. Work starts after approval.' },
  }),
]

const canonicalSave = buildTemplateEditorPayload({
  title: 'Canonical assembly template',
  description: 'Owns Block Engine blocks',
  sections: [{ heading: 'Legacy scope', body: 'Should not rebuild the default sequence.' }],
  items: [{ id: 'item-legacy', description: 'Legacy line', amount: '1' }],
  terms: 'Legacy terms',
  notes: '',
  defaultLayoutId: LAYOUT_ID.LANDSCAPE,
  questionnaire: defaultTemplate.questionnaire,
  blocks: authoredBlocks,
  contentBlockIds: ['should-be-replaced', ''],
})

assert(
  'B. Existing canonical template save derives contentBlockIds from block.libraryId',
  Array.isArray(canonicalSave.blocks) &&
    canonicalSave.blocks.map((block) => block.id).join() ===
      'blk-tpl-cover,blk-tpl-pricing,blk-tpl-terms' &&
    canonicalSave.contentBlockIds.join() === 'lib-cover-hero' &&
    canonicalSave.contentBlockIds.length === 1 &&
    !canonicalSave.contentBlockIds.includes('should-be-replaced'),
)

const libraryId = 'block-exec-summary'
const sourceBefore = await fetchLibraryBlockById(libraryId)
const sourceSnapshot = JSON.stringify(sourceBefore)
const sourceUseCount = sourceBefore.useCount

const composed = await composeTemplateContentBlocks([], [libraryId])
const created = composed.blocks[0]

assert(
  'C. Explicit composition materializes a real library record into template.blocks',
  composed.blocks.length === 1 &&
    created.type === sourceBefore.type &&
    created.data.body === sourceBefore.data.body &&
    composed.contentBlockIds.join() === libraryId,
)

assert(
  'D. Materialized block gets a NEW block instance ID',
  typeof created.id === 'string' &&
    created.id.startsWith('blk-') &&
    created.id !== libraryId &&
    created.id !== sourceBefore.id,
)

assert(
  'E. Materialized block retains libraryId',
  created.libraryId === libraryId && created.libraryId === sourceBefore.id,
)

const sourceAfterCompose = await fetchLibraryBlockById(libraryId)
assert(
  'F. Source Content Library record is not mutated',
  JSON.stringify(sourceAfterCompose) === sourceSnapshot &&
    sourceAfterCompose.useCount === sourceUseCount &&
    sourceAfterCompose.data.body === sourceBefore.data.body,
)

const composedAgain = await composeTemplateContentBlocks(composed.blocks, [libraryId, libraryId])
assert(
  'G. Repeating composition does not duplicate an already represented libraryId',
  composedAgain.blocks.length === 1 &&
    composedAgain.blocks[0].id === created.id &&
    composedAgain.contentBlockIds.join() === libraryId,
)

let unknownError = null
try {
  await composeTemplateContentBlocks(composed.blocks, ['block-missing-h17-3'])
} catch (error) {
  unknownError = error
}

assert(
  'H. Unknown library ID fails with the existing NotFoundError behavior',
  unknownError instanceof NotFoundError &&
    unknownError.message.includes('block-missing-h17-3'),
)

const composedTemplate = makeTemplate({
  id: 'tpl-composed-h17-3',
  title: 'Composed library template',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: composed.blocks,
  contentBlockIds: composed.contentBlockIds,
})

await updateLibraryBlock(libraryId, {
  data: { body: 'MUTATED LIBRARY BODY' },
})
await deleteLibraryBlock(libraryId)

const templateSnapshot = JSON.stringify(composedTemplate)
const proposalPayload = proposalFromTemplate(composedTemplate)
const proposal = makeProposal(proposalPayload)

assert(
  'I. proposalFromTemplate() does NOT fetch the library and copies only template.blocks',
  Array.isArray(proposalPayload.blocks) &&
    proposalPayload.blocks.length === composedTemplate.blocks.length &&
    proposalPayload.blocks[0].data.body === sourceBefore.data.body &&
    proposalPayload.blocks[0].data.body !== 'MUTATED LIBRARY BODY' &&
    proposalPayload.blocks[0].libraryId === libraryId &&
    JSON.stringify(composedTemplate) === templateSnapshot,
)

assert(
  'J. Proposal-created block IDs differ from template block IDs',
  proposal.blocks.length === composedTemplate.blocks.length &&
    proposal.blocks.every((block, index) => block.id !== composedTemplate.blocks[index].id) &&
    new Set(proposal.blocks.map((block) => block.id)).size === proposal.blocks.length &&
    proposal.blocks[0].libraryId === libraryId,
)

const duplicatePayload = toDuplicateTemplate(composedTemplate)
const duplicated = makeTemplate(duplicatePayload)

assert(
  'K. Duplicate template preserves contentBlockIds while generating new block instance IDs',
  duplicatePayload.contentBlockIds.join() === libraryId &&
    duplicated.contentBlockIds.join() === libraryId &&
    duplicated.blocks.length === composedTemplate.blocks.length &&
    duplicated.blocks[0].id !== composedTemplate.blocks[0].id &&
    duplicated.blocks[0].libraryId === libraryId &&
    duplicated.blocks[0].data.body === sourceBefore.data.body &&
    composedTemplate.blocks[0].id === created.id,
)

const legacyValues = {
  title: 'Legacy sections template',
  description: 'No Block Engine assembly',
  sections: [{ id: 'sec-1', heading: 'Scope of work', body: 'Discovery, directions, guidelines.' }],
  items: [{ id: 'item-1', description: 'Identity package', amount: '12000' }],
  terms: 'Valid for 30 days.',
  notes: 'Internal only',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  questionnaire: defaultTemplate.questionnaire,
  blocks: [],
  contentBlockIds: ['block-exec-summary'],
}

const legacySave = buildTemplateEditorPayload(legacyValues)
const savedLegacy = makeTemplate({
  id: 'tpl-legacy-composition',
  ...legacySave,
})

assert(
  'L. Legacy blocks: [] template does not silently gain DEFAULT_BLOCK_SEQUENCE',
  !Object.hasOwn(legacySave, 'blocks') &&
    !Object.hasOwn(legacySave, 'contentBlockIds') &&
    savedLegacy.blocks.length === 0 &&
    savedLegacy.contentBlockIds.length === 0 &&
    !hasCanonicalBlocks(savedLegacy.blocks) &&
    savedLegacy.blocks.length !== DEFAULT_BLOCK_SEQUENCE.length,
)

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

runVerifier('verify-template-block-authoring.mjs', 'M. H17.2 template authoring verifier remains green')
runVerifier('verify-template-block-assembly.mjs', 'N. H17.1 template block assembly verifier remains green')

assert(
  'O. Template Studio still disables Knowledge via knowledgeCompanyId={null}',
  isBlockEditorKnowledgeEnabled(null) === false &&
    sourceOf('src', 'pages', 'Templates', 'TemplateForm.jsx').includes(
      'knowledgeCompanyId={null}',
    ) &&
    sourceOf('src', 'pages', 'Templates', 'TemplateForm.jsx').includes('handleBlocksChange'),
)

await resetLibraryBlocks()
const studioLibrary = await fetchLibraryBlockById('block-about-us')
const studioUseCount = studioLibrary.useCount
const knowledgeEnabled = isBlockEditorKnowledgeEnabled(null)
const studioInsert = insertLibraryBlock([], studioLibrary)
const studioIds = contentBlockIdsFromBlocks(studioInsert.blocks)
const libraryAfterStudio = await fetchLibraryBlockById('block-about-us')

assert(
  'P. touchLibraryBlock is not invoked by Template Studio composition',
  knowledgeEnabled === false &&
    studioInsert.created.libraryId === 'block-about-us' &&
    studioIds.join() === 'block-about-us' &&
    libraryAfterStudio.useCount === studioUseCount &&
    !sourceOf('src', 'utils', 'templateBlocks.js').includes('touchLibraryBlock') &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes('fetchLibraryBlockById') &&
    !sourceOf('src', 'utils', 'duplicateTemplate.js').includes('fetchLibraryBlockById'),
)

await resetLibraryBlocks()

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
