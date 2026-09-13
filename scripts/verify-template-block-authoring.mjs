import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock, updateBlockData, insertLibraryBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { DEFAULT_BLOCK_SEQUENCE } from '../src/blocks/hydrate.js'
import { isBlockEditorKnowledgeEnabled } from '../src/blocks/editor/knowledgeGate.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { makeProposal } from '../src/models/proposal.js'
import { makeTemplate } from '../src/models/template.js'
import { DEFAULT_COMPANY_ID } from '../src/knowledge/types.js'
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import {
  buildTemplateEditorPayload,
  convertLegacyTemplateToBlocks,
  hasCanonicalBlocks,
  loadTemplateBlocks,
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
    data: { body: 'Net 30. Work starts after approval.' },
  }),
]

const legacyTemplate = makeTemplate({
  id: 'tpl-legacy-authoring',
  title: 'Legacy sections template',
  description: 'No Block Engine assembly',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  sections: [
    { heading: 'Scope of work', body: 'Discovery, directions, guidelines.' },
    { heading: 'Timeline', body: 'Six weeks.' },
  ],
  items: [{ description: 'Identity package', amount: 12000 }],
  terms: 'Valid for 30 days.',
  notes: 'Internal only',
})

const canonicalTemplate = makeTemplate({
  id: 'tpl-canonical-authoring',
  title: 'Canonical assembly template',
  description: 'Owns Block Engine blocks',
  defaultLayoutId: LAYOUT_ID.LANDSCAPE,
  sections: [{ heading: 'Legacy scope', body: 'Should not rebuild the default sequence.' }],
  items: [{ description: 'Legacy line', amount: 1 }],
  terms: 'Legacy terms',
  blocks: authoredBlocks,
})

const legacyValues = {
  title: legacyTemplate.title,
  description: legacyTemplate.description,
  sections: legacyTemplate.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
    body: section.body,
  })),
  items: legacyTemplate.items.map((item) => ({
    id: item.id,
    description: item.description,
    amount: String(item.amount),
  })),
  terms: legacyTemplate.terms,
  notes: legacyTemplate.notes,
  defaultLayoutId: legacyTemplate.defaultLayoutId,
  questionnaire: legacyTemplate.questionnaire,
  blocks: [],
}

const legacySave = buildTemplateEditorPayload(legacyValues)
const savedLegacy = makeTemplate({
  ...legacyTemplate,
  ...legacySave,
  id: legacyTemplate.id,
  createdAt: legacyTemplate.createdAt,
})
const legacyProposalPayload = proposalFromTemplate(savedLegacy)
const legacyProposal = makeProposal(legacyProposalPayload)

assert(
  'A. Legacy template remains block-less after normal details save',
  !Object.hasOwn(legacySave, 'blocks') &&
    savedLegacy.blocks.length === 0 &&
    !hasCanonicalBlocks(savedLegacy.blocks),
)

assert(
  'B. Legacy template still creates a proposal through sections/items hydration',
  !Object.hasOwn(legacyProposalPayload, 'blocks') &&
    legacyProposalPayload.sections[0].heading === 'Scope of work' &&
    legacyProposalPayload.items[0].description === 'Identity package' &&
    legacyProposal.blocks.some(
      (block) =>
        block.type === BLOCK_TYPE.RICH_TEXT && block.data.heading === 'Scope of work',
    ) &&
    legacyProposal.blocks.length !== 3,
)

const loaded = loadTemplateBlocks(canonicalTemplate.blocks)
assert(
  'C. Existing template with blocks loads those blocks instead of DEFAULT_BLOCK_SEQUENCE',
  loaded.length === 3 &&
    loaded[0].id === 'blk-tpl-cover' &&
    loaded[1].id === 'blk-tpl-pricing' &&
    loaded[2].id === 'blk-tpl-terms' &&
    loaded.length !== DEFAULT_BLOCK_SEQUENCE.length &&
    loaded.map((block) => block.type).join() !==
      DEFAULT_BLOCK_SEQUENCE.map((step) => step.type).join(),
)

const canonicalValues = {
  title: canonicalTemplate.title,
  description: canonicalTemplate.description,
  sections: canonicalTemplate.sections,
  items: canonicalTemplate.items.map((item) => ({
    ...item,
    amount: String(item.amount),
  })),
  terms: canonicalTemplate.terms,
  notes: canonicalTemplate.notes,
  defaultLayoutId: canonicalTemplate.defaultLayoutId,
  questionnaire: canonicalTemplate.questionnaire,
  blocks: loaded,
}

const canonicalSave = buildTemplateEditorPayload(canonicalValues)
const savedCanonical = makeTemplate({
  ...canonicalTemplate,
  ...canonicalSave,
  id: canonicalTemplate.id,
  createdAt: canonicalTemplate.createdAt,
})

assert(
  'D. Saving a block-enabled template preserves its block IDs',
  Array.isArray(canonicalSave.blocks) &&
    canonicalSave.blocks.map((block) => block.id).join() ===
      'blk-tpl-cover,blk-tpl-pricing,blk-tpl-terms' &&
    savedCanonical.blocks.map((block) => block.id).join() ===
      'blk-tpl-cover,blk-tpl-pricing,blk-tpl-terms',
)

assert(
  'E. Block data/type/enabled/libraryId/settings/order survive save',
  savedCanonical.blocks[0].type === BLOCK_TYPE.COVER &&
    savedCanonical.blocks[0].enabled === true &&
    savedCanonical.blocks[0].libraryId === 'lib-cover-hero' &&
    savedCanonical.blocks[0].data.heading === 'Northwind brand system' &&
    typeof savedCanonical.blocks[0].settings === 'object' &&
    savedCanonical.blocks[1].type === BLOCK_TYPE.PRICING &&
    savedCanonical.blocks[1].data.notes === 'Fixed engagement' &&
    savedCanonical.blocks[2].type === BLOCK_TYPE.TERMS &&
    savedCanonical.blocks[2].data.body === 'Net 30. Work starts after approval.',
)

assert(
  'F. Canonical blocks synchronize the legacy sections/items compatibility fields',
  savedCanonical.terms === 'Net 30. Work starts after approval.' &&
    savedCanonical.items.some((item) => item.description === 'Brand system') &&
    savedCanonical.items.some((item) => Number(item.amount) === 18000) &&
    savedCanonical.sections.every((section) => section.heading !== 'Legacy scope'),
)

const snapshotBeforeConvert = JSON.stringify(legacyTemplate)
const convertedBlocks = convertLegacyTemplateToBlocks(legacyTemplate)
const snapshotAfterConvert = JSON.stringify(legacyTemplate)

assert(
  'G. Explicit legacy conversion creates real Block Engine instances',
  Array.isArray(convertedBlocks) &&
    convertedBlocks.length > 0 &&
    convertedBlocks.every(
      (block) =>
        typeof block.id === 'string' &&
        block.id.startsWith('blk-') &&
        typeof block.type === 'string' &&
        typeof block.enabled === 'boolean' &&
        typeof block.data === 'object' &&
        Object.hasOwn(block, 'libraryId') &&
        typeof block.settings === 'object',
    ) &&
    convertedBlocks.some(
      (block) =>
        block.type === BLOCK_TYPE.RICH_TEXT && block.data.heading === 'Scope of work',
    ) &&
    convertedBlocks.some(
      (block) =>
        block.type === BLOCK_TYPE.PRICING &&
        (block.data.items ?? []).some((item) => item.description === 'Identity package'),
    ) &&
    convertedBlocks.some(
      (block) => block.type === BLOCK_TYPE.TERMS && block.data.body.includes('Valid for 30 days.'),
    ),
)

assert(
  'H. Conversion does not mutate the original legacy template',
  snapshotBeforeConvert === snapshotAfterConvert &&
    legacyTemplate.blocks.length === 0 &&
    legacyTemplate.sections[0].heading === 'Scope of work',
)

const convertedTemplate = makeTemplate({
  ...legacyTemplate,
  ...buildTemplateEditorPayload({
    ...legacyValues,
    blocks: convertedBlocks,
  }),
  id: 'tpl-converted-authoring',
})
const convertedProposalPayload = proposalFromTemplate(convertedTemplate)
const convertedProposal = makeProposal(convertedProposalPayload)

assert(
  'I. After conversion, proposalFromTemplate uses the canonical blocks',
  hasCanonicalBlocks(convertedTemplate.blocks) &&
    Array.isArray(convertedProposalPayload.blocks) &&
    convertedProposalPayload.blocks.length === convertedTemplate.blocks.length &&
    convertedProposal.blocks.length === convertedTemplate.blocks.length &&
    convertedProposal.blocks.map((block) => block.type).join() ===
      convertedTemplate.blocks.map((block) => block.type).join() &&
    convertedProposal.blocks.length !== DEFAULT_BLOCK_SEQUENCE.length,
)

assert(
  'J. Proposal block IDs are newly generated and differ from template block IDs',
  convertedProposal.blocks.every((block, index) => block.id !== convertedTemplate.blocks[index].id) &&
    new Set(convertedProposal.blocks.map((block) => block.id)).size ===
      convertedProposal.blocks.length,
)

const editedLegacy = buildTemplateEditorPayload({
  ...legacyValues,
  title: 'Renamed legacy template',
  sections: [
    ...legacyValues.sections,
    { id: 'sec-extra', heading: 'Approach', body: 'Still legacy.' },
  ],
})
assert(
  'K. Normal legacy template editing does not silently create blocks',
  !Object.hasOwn(editedLegacy, 'blocks') &&
    editedLegacy.title === 'Renamed legacy template' &&
    editedLegacy.sections.some((section) => section.heading === 'Approach'),
)

const authored = updateBlockData(loaded, 'blk-tpl-cover', { heading: 'Harborline identity' })
const authoredPayload = buildTemplateEditorPayload({
  ...canonicalValues,
  blocks: authored,
})
assert(
  'L. BlockEditor authoring changes are persisted into the template assembly',
  authoredPayload.blocks[0].id === 'blk-tpl-cover' &&
    authoredPayload.blocks[0].data.heading === 'Harborline identity' &&
    authoredPayload.blocks[1].id === 'blk-tpl-pricing' &&
    authoredPayload.blocks[1].libraryId === null,
)

const libraryInsert = insertLibraryBlock(
  authoredPayload.blocks,
  {
    id: 'lib-terms-studio',
    type: BLOCK_TYPE.TERMS,
    data: { body: 'Library terms copied into the template.' },
    settings: {},
  },
)
const libraryPayload = buildTemplateEditorPayload({
  ...canonicalValues,
  blocks: libraryInsert.blocks,
})

assert(
  'Library insertion still copies into template.blocks',
  libraryInsert.created.libraryId === 'lib-terms-studio' &&
    libraryPayload.blocks.some((block) => block.libraryId === 'lib-terms-studio') &&
    libraryPayload.blocks[0].id === 'blk-tpl-cover',
)

assert(
  'Template Studio disables Knowledge persist via existing knowledgeCompanyId prop',
  isBlockEditorKnowledgeEnabled(null) === false &&
    isBlockEditorKnowledgeEnabled('') === false &&
    isBlockEditorKnowledgeEnabled(DEFAULT_COMPANY_ID) === true &&
    sourceOf('src', 'pages', 'Templates', 'TemplateForm.jsx').includes(
      'knowledgeCompanyId={null}',
    ) &&
    sourceOf('src', 'blocks', 'editor', 'BlockEditor.jsx').includes(
      'isBlockEditorKnowledgeEnabled(knowledgeCompanyId)',
    ) &&
    sourceOf('src', 'blocks', 'editor', 'BlockEditor.jsx').includes(
      'if (knowledgeEnabled) touchLibraryBlock(libraryBlock.id)',
    ) &&
    sourceOf('src', 'blocks', 'editor', 'BlockEditor.jsx').includes(
      '{knowledgeEnabled ? (',
    ) &&
    !sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'knowledgeCompanyId={null}',
    ) &&
    sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes('<BlockEditor') &&
    !sourceOf('src', 'utils', 'templateBlocks.js').includes('knowledge') &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes('knowledgeCompanyId'),
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
