import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { DEFAULT_BLOCK_SEQUENCE } from '../src/blocks/hydrate.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { makeProposal } from '../src/models/proposal.js'
import { makeTemplate, validateTemplate } from '../src/models/template.js'
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import { exportTemplate } from '../src/utils/exportTemplate.js'

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
    data: { kicker: 'Identity', heading: 'Northwind brand system', subheading: 'Discovery through guidelines' },
  }),
  makeBlock({
    id: 'blk-tpl-pricing',
    type: BLOCK_TYPE.PRICING,
    enabled: false,
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

const templateWithBlocks = makeTemplate({
  id: 'tpl-assembly-1',
  title: 'Brand system template',
  description: 'Canonical Block Engine assembly',
  defaultLayoutId: LAYOUT_ID.LANDSCAPE,
  sections: [{ heading: 'Legacy scope', body: 'Should not rebuild the default sequence.' }],
  items: [{ description: 'Legacy line', amount: 1 }],
  terms: 'Legacy terms',
  blocks: authoredBlocks,
})

const templateWithoutBlocks = makeTemplate({
  id: 'tpl-legacy-1',
  title: 'Legacy sections template',
  description: 'No Block Engine assembly',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  sections: [
    { heading: 'Scope of work', body: 'Discovery, directions, guidelines.' },
    { heading: 'Timeline', body: 'Six weeks.' },
  ],
  items: [{ description: 'Identity package', amount: 12000 }],
  terms: 'Valid for 30 days.',
})

const snapshotBefore = JSON.stringify(templateWithBlocks)
const sourceIds = templateWithBlocks.blocks.map((block) => block.id)
const payload = proposalFromTemplate(templateWithBlocks)
const snapshotAfter = JSON.stringify(templateWithBlocks)
const proposal = makeProposal(payload)
const copied = payload.blocks ?? []
const defaultTypes = DEFAULT_BLOCK_SEQUENCE.map((step) => step.type)
const copiedTypes = copied.map((block) => block.type)
const proposalTypes = proposal.blocks.map((block) => block.type)

assert(
  'A. Template accepts a valid blocks array',
  Array.isArray(templateWithBlocks.blocks) &&
    templateWithBlocks.blocks.length === 3 &&
    templateWithBlocks.blocks.every((block) => typeof block.id === 'string' && typeof block.type === 'string') &&
    validateTemplate(templateWithBlocks).length === 0,
)

assert(
  'B. Template without blocks remains valid',
  Array.isArray(templateWithoutBlocks.blocks) &&
    templateWithoutBlocks.blocks.length === 0 &&
    validateTemplate(templateWithoutBlocks).length === 0 &&
    templateWithoutBlocks.sections.length === 2 &&
    templateWithoutBlocks.items.length === 1,
)

assert(
  'C. Template block instances preserve type/enabled/data/libraryId',
  templateWithBlocks.blocks[0].id === 'blk-tpl-cover' &&
    templateWithBlocks.blocks[0].type === BLOCK_TYPE.COVER &&
    templateWithBlocks.blocks[0].enabled === true &&
    templateWithBlocks.blocks[0].libraryId === 'lib-cover-hero' &&
    templateWithBlocks.blocks[0].data.heading === 'Northwind brand system' &&
    templateWithBlocks.blocks[1].id === 'blk-tpl-pricing' &&
    templateWithBlocks.blocks[1].type === BLOCK_TYPE.PRICING &&
    templateWithBlocks.blocks[1].enabled === false &&
    templateWithBlocks.blocks[1].libraryId === null &&
    templateWithBlocks.blocks[1].data.notes === 'Fixed engagement' &&
    templateWithBlocks.blocks[2].type === BLOCK_TYPE.TERMS &&
    templateWithBlocks.blocks[2].data.body === 'Net 30. Work starts after approval.',
)

assert(
  'D. proposalFromTemplate() copies template blocks',
  Array.isArray(payload.blocks) &&
    payload.blocks.length === templateWithBlocks.blocks.length &&
    copiedTypes.join() === templateWithBlocks.blocks.map((block) => block.type).join() &&
    copied[0].data.heading === templateWithBlocks.blocks[0].data.heading &&
    copied[1].enabled === false &&
    copied[2].data.body === templateWithBlocks.blocks[2].data.body,
)

assert(
  'E. Copied blocks receive NEW ids',
  copied.length === 3 &&
    copied.every((block) => typeof block.id === 'string' && block.id.startsWith('blk-')) &&
    copied.every((block, index) => block.id !== sourceIds[index]) &&
    new Set(copied.map((block) => block.id)).size === copied.length,
)

assert(
  'F. Source template block ids remain unchanged',
  templateWithBlocks.blocks[0].id === 'blk-tpl-cover' &&
    templateWithBlocks.blocks[1].id === 'blk-tpl-pricing' &&
    templateWithBlocks.blocks[2].id === 'blk-tpl-terms' &&
    sourceIds.join() === 'blk-tpl-cover,blk-tpl-pricing,blk-tpl-terms',
)

assert(
  'G. Source template blocks are not mutated',
  snapshotBefore === snapshotAfter &&
    templateWithBlocks.blocks[0].data.heading === 'Northwind brand system' &&
    templateWithBlocks.blocks[1].enabled === false,
)

assert(
  'H. Block ordering is preserved',
  copiedTypes.join() === `${BLOCK_TYPE.COVER},${BLOCK_TYPE.PRICING},${BLOCK_TYPE.TERMS}` &&
    proposalTypes.join() === copiedTypes.join(),
)

copied[0].data.heading = 'MUTATED COVER'
copied[1].data.notes = 'MUTATED NOTES'
assert(
  'I. Block data is deep-copied rather than shared by reference',
  copied[0].data !== templateWithBlocks.blocks[0].data &&
    copied[1].data !== templateWithBlocks.blocks[1].data &&
    templateWithBlocks.blocks[0].data.heading === 'Northwind brand system' &&
    templateWithBlocks.blocks[1].data.notes === 'Fixed engagement',
)

assert(
  'J. libraryId provenance survives',
  copied[0].libraryId === 'lib-cover-hero' &&
    proposal.blocks[0].libraryId === 'lib-cover-hero' &&
    copied[1].libraryId === null,
)

assert(
  'K. template.defaultLayoutId survives onto the proposal',
  templateWithBlocks.defaultLayoutId === LAYOUT_ID.LANDSCAPE &&
    payload.layoutId === LAYOUT_ID.LANDSCAPE &&
    proposal.layoutId === LAYOUT_ID.LANDSCAPE,
)

assert(
  'L. New proposal client fields remain empty/default',
  payload.clientName === '' &&
    payload.clientEmail === '' &&
    payload.company === '' &&
    proposal.clientName === '' &&
    proposal.clientEmail === '' &&
    proposal.company === '',
)

const legacyPayload = proposalFromTemplate(templateWithoutBlocks)
const legacyProposal = makeProposal(legacyPayload)
const legacyTypes = legacyProposal.blocks.map((block) => block.type)
const expectedHydratedTypes = []
for (const step of DEFAULT_BLOCK_SEQUENCE) {
  if (step.type === BLOCK_TYPE.RICH_TEXT) {
    templateWithoutBlocks.sections.forEach(() => expectedHydratedTypes.push(BLOCK_TYPE.RICH_TEXT))
    continue
  }
  expectedHydratedTypes.push(step.type)
}

assert(
  'M. A template without blocks follows the existing backwards-compatible path',
  !Object.hasOwn(legacyPayload, 'blocks') &&
    Array.isArray(legacyPayload.sections) &&
    legacyPayload.sections.length === 2 &&
    legacyPayload.sections[0].heading === 'Scope of work' &&
    legacyPayload.items[0].description === 'Identity package' &&
    legacyPayload.layoutId === LAYOUT_ID.PORTRAIT &&
    legacyTypes.join() === expectedHydratedTypes.join() &&
    legacyProposal.blocks.some(
      (block) =>
        block.type === BLOCK_TYPE.RICH_TEXT && block.data.heading === 'Scope of work',
    ),
)

assert(
  'N. Resulting proposal uses copied Block Engine blocks, not DEFAULT_BLOCK_SEQUENCE',
  proposal.blocks.length === 3 &&
    proposal.blocks.length !== defaultTypes.length &&
    proposalTypes.join() === copiedTypes.join() &&
    proposal.blocks[0].type === BLOCK_TYPE.COVER &&
    proposal.blocks[0].data.heading === 'Northwind brand system' &&
    proposal.blocks[1].type === BLOCK_TYPE.PRICING &&
    proposal.blocks[1].enabled === false &&
    proposal.blocks[0].id === copied[0].id &&
    typeof proposal.blocks[0].data === 'object' &&
    typeof proposal.blocks[0].settings === 'object',
)

const roundTrip = makeTemplate(JSON.parse(JSON.stringify(templateWithBlocks)))
assert(
  'Template JSON serialization keeps the Block Engine assembly',
  roundTrip.blocks.length === 3 &&
    roundTrip.blocks[0].id === 'blk-tpl-cover' &&
    roundTrip.blocks[0].libraryId === 'lib-cover-hero' &&
    roundTrip.defaultLayoutId === LAYOUT_ID.LANDSCAPE &&
    typeof exportTemplate === 'function',
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
