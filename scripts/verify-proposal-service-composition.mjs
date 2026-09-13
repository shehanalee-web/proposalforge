import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { ACTIVITY_EVENT_TYPE } from '../src/models/activityEvent.js'
import { makeProposal } from '../src/models/proposal.js'
import { NotFoundError } from '../src/services/errors.js'
import {
  fetchLibraryBlockById,
  resetLibraryBlocks,
  updateLibraryBlock,
} from '../src/services/libraryBlockService.js'
import {
  createProposal,
  loadStoredProposalById,
  resetProposals,
  updateProposal,
} from '../src/services/proposalService.js'
import { listProposalActivity } from '../src/services/activityService.js'
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
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import { applyServiceComponentsToProposal } from '../src/utils/templateBlocks.js'

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

const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const href = String(url)
  if (href.includes('/api/proposals')) {
    return {
      ok: true,
      json: async () => ({ records: [] }),
    }
  }
  if (typeof originalFetch === 'function') {
    return originalFetch(url, init)
  }
  throw new TypeError(`Unexpected fetch: ${href}`)
}

await resetLibraryBlocks()
await resetServices()
resetTemplates()
await resetProposals()

const libraryId = 'block-about-us'
const sourceBefore = await fetchLibraryBlockById(libraryId)
const sourceSnapshot = JSON.stringify(sourceBefore)
const sourceUseCount = sourceBefore.useCount

const authoredKeep = makeBlock({
  id: 'blk-keep-h17-5',
  type: BLOCK_TYPE.COVER,
  data: { heading: 'Keep this authored cover' },
})
const storedExtra = makeBlock({
  id: 'blk-store-extra-h17-5',
  type: BLOCK_TYPE.TERMS,
  data: { body: 'Present in store, missing from a stale editor snapshot.' },
})

const linkedTemplate = await createTemplate({
  id: 'tpl-h17-5-linked',
  title: 'H17.5 linked template',
  notes: 'Template notes must survive proposal Apply.',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep],
})
const templateSnapshot = JSON.stringify(await fetchTemplateById(linkedTemplate.id))

const service = await createService({
  id: 'svc-h17-5-linked',
  name: 'H17.5 service',
  templateId: linkedTemplate.id,
  contentBlockIds: [libraryId],
})

const created = await createProposal({
  id: 'prop-h17-5-apply',
  title: 'H17.5 proposal',
  clientName: 'Northwind',
  company: 'Northwind Ltd',
  notes: 'Unrelated notes must survive Apply.',
  layoutId: LAYOUT_ID.LANDSCAPE,
  serviceIds: [service.id],
  projectType: service.name,
  blocks: [authoredKeep, storedExtra],
})

const activityBeforeApply = await listProposalActivity(created.id)
const viewedBefore = activityBeforeApply.filter(
  (event) => event.event_type === ACTIVITY_EVENT_TYPE.VIEWED,
).length

const firstApply = await applyServiceComponentsToProposal(created.id, service)
const firstStored = await loadStoredProposalById(created.id)
const firstIds = firstStored.blocks.map((block) => block.id)
const createdLibrary = firstStored.blocks.find((block) => block.libraryId === libraryId)

assert(
  'A. Happy path materializes service contentBlockIds into proposal.blocks',
  firstApply.updated === true &&
    firstIds.includes('blk-keep-h17-5') &&
    firstIds.includes('blk-store-extra-h17-5') &&
    createdLibrary?.type === sourceBefore.type &&
    createdLibrary.data.body === sourceBefore.data.body &&
    typeof createdLibrary.id === 'string' &&
    createdLibrary.id.startsWith('blk-') &&
    createdLibrary.id !== libraryId &&
    createdLibrary.libraryId === libraryId,
)

const applyHelperSource = sourceOf('src', 'utils', 'templateBlocks.js')
assert(
  'B. Persistence patches only blocks and keeps unrelated proposal fields',
  /updateProposal\(stored\.id,\s*\{\s*blocks: composed\.blocks,\s*\}\)/.test(
    applyHelperSource,
  ) &&
    firstStored.title === 'H17.5 proposal' &&
    firstStored.clientName === 'Northwind' &&
    firstStored.company === 'Northwind Ltd' &&
    firstStored.notes === 'Unrelated notes must survive Apply.' &&
    firstStored.layoutId === LAYOUT_ID.LANDSCAPE &&
    firstStored.serviceIds.join() === service.id &&
    firstStored.projectType === service.name,
)

const secondApply = await applyServiceComponentsToProposal(created.id, service)
const secondStored = await loadStoredProposalById(created.id)

assert(
  'C. Repeated Apply is a true persist no-op',
  secondApply.updated === false &&
    secondStored.updatedAt === firstStored.updatedAt &&
    secondStored.currentVersion === firstStored.currentVersion &&
    (secondStored.versions ?? []).length === (firstStored.versions ?? []).length &&
    secondStored.blocks.map((block) => block.id).join() === firstIds.join() &&
    secondStored.blocks.filter((block) => block.libraryId === libraryId).length === 1,
)

assert(
  'D. Apply composes against the stored proposal, not a stale editor snapshot',
  firstIds.includes('blk-store-extra-h17-5') &&
    firstStored.blocks.find((block) => block.id === 'blk-store-extra-h17-5')?.data
      .body === 'Present in store, missing from a stale editor snapshot.' &&
    !sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'applyServiceComponentsToProposal(id, service, documentBlocks)',
    ) &&
    sourceOf('src', 'utils', 'templateBlocks.js').includes('loadStoredProposalById'),
)

const emptyApply = await applyServiceComponentsToProposal(created.id, {
  contentBlockIds: [],
})
const emptyStored = await loadStoredProposalById(created.id)

assert(
  'E. Empty contentBlockIds Apply does not persist',
  emptyApply.updated === false &&
    emptyStored.updatedAt === firstStored.updatedAt &&
    emptyStored.blocks.map((block) => block.id).join() === firstIds.join(),
)

const beforeUnknown = await loadStoredProposalById(created.id)
let unknownError = null
try {
  await applyServiceComponentsToProposal(created.id, {
    contentBlockIds: ['block-missing-h17-5'],
  })
} catch (error) {
  unknownError = error
}
const afterUnknown = await loadStoredProposalById(created.id)

assert(
  'F. Unknown library id surfaces NotFoundError and does not update the proposal',
  unknownError instanceof NotFoundError &&
    unknownError.message.includes('block-missing-h17-5') &&
    afterUnknown.updatedAt === beforeUnknown.updatedAt &&
    afterUnknown.blocks.map((block) => block.id).join() ===
      beforeUnknown.blocks.map((block) => block.id).join() &&
    !afterUnknown.blocks.some((block) => block.libraryId === 'block-missing-h17-5'),
)

const otherService = await createService({
  id: 'svc-h17-5-other',
  name: 'Other service',
  templateId: linkedTemplate.id,
  contentBlockIds: ['block-exec-summary'],
})
const ordinarySave = await updateProposal(created.id, {
  serviceIds: [otherService.id],
  projectType: otherService.name,
})

assert(
  'G. Ordinary proposal save does not compose Content Library blocks',
  ordinarySave.serviceIds.join() === otherService.id &&
    ordinarySave.projectType === otherService.name &&
    ordinarySave.blocks.map((block) => block.id).join() === firstIds.join() &&
    !ordinarySave.blocks.some((block) => block.libraryId === 'block-exec-summary') &&
    !sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'composeTemplateFromService',
    ) &&
    sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'toEditableChanges(values, documentBlocks)',
    ) &&
    !sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'fetchLibraryBlockById',
    ),
)

const createPayload = proposalFromTemplate(linkedTemplate, service)
const createdFromTemplate = makeProposal(createPayload)

assert(
  'H. Create-from-template still copies template.blocks only',
  !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes(
    'fetchLibraryBlockById',
  ) &&
    !sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx').includes(
      'applyServiceComponentsToProposal',
    ) &&
    !sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx').includes(
      'fetchLibraryBlockById',
    ) &&
    Array.isArray(createPayload.blocks) &&
    createPayload.blocks.length === linkedTemplate.blocks.length &&
    createPayload.blocks.every(
      (block, index) => block.id !== linkedTemplate.blocks[index].id,
    ) &&
    !createPayload.blocks.some((block) => block.libraryId === libraryId) &&
    createdFromTemplate.serviceIds.join() === service.id,
)

const sourceAfter = await fetchLibraryBlockById(libraryId)
const templateAfter = await fetchTemplateById(linkedTemplate.id)

assert(
  'I. Source library records and the linked template are not mutated',
  JSON.stringify(sourceAfter) === sourceSnapshot &&
    sourceAfter.useCount === sourceUseCount &&
    JSON.stringify(templateAfter) === templateSnapshot,
)

const activityAfterApply = await listProposalActivity(created.id)
const viewedAfter = activityAfterApply.filter(
  (event) => event.event_type === ACTIVITY_EVENT_TYPE.VIEWED,
).length

assert(
  'J. Apply does not record a Studio View by loading the proposal',
  viewedAfter === viewedBefore &&
    !sourceOf('src', 'utils', 'templateBlocks.js').includes('fetchProposalById') &&
    sourceOf('src', 'services', 'proposalService.js').includes(
      'loadStoredProposalById',
    ) &&
    sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx').includes(
      'applyServiceComponentsToProposal',
    ) &&
    sourceOf('src', 'pages', 'NewProposal', 'ProposalForm.jsx').includes(
      'Apply Default Components to Proposal',
    ),
)

await updateLibraryBlock(libraryId, {
  data: { body: 'MUTATED LIBRARY BODY' },
})
const storedAfterLibraryEdit = await loadStoredProposalById(created.id)
assert(
  'I2. Mutating the library after Apply does not rewrite stored proposal blocks',
  storedAfterLibraryEdit.blocks.find((block) => block.libraryId === libraryId)?.data
    .body === sourceBefore.data.body,
)

await updateService(service.id, {
  description: 'Service details save must not compose.',
})
assert(
  'G2. Service Details save still does not compose into the proposal',
  (await loadStoredProposalById(created.id)).blocks.map((block) => block.id).join() ===
    firstIds.join(),
)

runVerifier(
  'verify-template-service-composition.mjs',
  'K. H17.4 verifier remains green',
)
runVerifier('verify-template-composition.mjs', 'K2. H17.3 verifier remains green')
runVerifier(
  'verify-template-block-authoring.mjs',
  'K3. H17.2 verifier remains green',
)
runVerifier(
  'verify-template-block-assembly.mjs',
  'K4. H17.1 verifier remains green',
)

await resetLibraryBlocks()
await resetServices()
resetTemplates()
await resetProposals()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
