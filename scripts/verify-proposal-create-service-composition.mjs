import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_BLOCK_SEQUENCE } from '../src/blocks/hydrate.js'
import { makeBlock } from '../src/blocks/instance.js'
import { BLOCK_TYPE } from '../src/blocks/ids.js'
import { LAYOUT_ID } from '../src/layouts/ids.js'
import { findTemplateForService } from '../src/models/service.js'
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
} from '../src/services/proposalService.js'
import {
  createService,
  resetServices,
} from '../src/services/serviceService.js'
import {
  createTemplate,
  fetchTemplateById,
  resetTemplates,
} from '../src/services/templateService.js'
import { proposalFromTemplate } from '../src/utils/proposalFromTemplate.js'
import { composeServiceComponentsForCreate } from '../src/utils/templateBlocks.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const DEFAULT_CLIENT_NAME = 'New client'

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

async function createFromService(service, templates) {
  const template = findTemplateForService(templates, service)
  const extras = template ? proposalFromTemplate(template, service) : {}
  const payload = {
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
  const composed = await composeServiceComponentsForCreate(payload, service)
  return createProposal(composed)
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
  id: 'blk-keep-h17-5-2',
  type: BLOCK_TYPE.COVER,
  data: { heading: 'Keep this authored cover' },
})
const alreadyLibrary = makeBlock({
  id: 'blk-already-lib-h17-5-2',
  type: sourceBefore.type,
  data: JSON.parse(JSON.stringify(sourceBefore.data ?? {})),
  libraryId,
})

const linkedTemplate = await createTemplate({
  id: 'tpl-h17-5-2-linked',
  title: 'H17.5.2 linked template',
  notes: 'Template notes must survive create-time composition.',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep],
})
const templateSnapshot = JSON.stringify(await fetchTemplateById(linkedTemplate.id))

const service = await createService({
  id: 'svc-h17-5-2-linked',
  name: 'H17.5.2 service',
  templateId: linkedTemplate.id,
  contentBlockIds: [libraryId],
})

const created = await createFromService(service, [linkedTemplate])
const stored = await loadStoredProposalById(created.id)
const createdLibrary = stored.blocks.find((block) => block.libraryId === libraryId)
const copiedCover = stored.blocks.find(
  (block) => block.type === BLOCK_TYPE.COVER && block.data.heading === 'Keep this authored cover',
)

assert(
  'A. Create materializes service contentBlockIds onto copied template blocks',
  stored.serviceIds.join() === service.id &&
    stored.projectType === service.name &&
    stored.clientName === DEFAULT_CLIENT_NAME &&
    copiedCover &&
    copiedCover.id !== 'blk-keep-h17-5-2' &&
    createdLibrary?.type === sourceBefore.type &&
    createdLibrary.data.body === sourceBefore.data.body &&
    typeof createdLibrary.id === 'string' &&
    createdLibrary.id.startsWith('blk-') &&
    createdLibrary.id !== libraryId &&
    createdLibrary.libraryId === libraryId &&
    stored.blocks.length === 2,
)

const alreadyTemplate = await createTemplate({
  id: 'tpl-h17-5-2-already',
  title: 'H17.5.2 already composed template',
  defaultLayoutId: LAYOUT_ID.PORTRAIT,
  blocks: [authoredKeep, alreadyLibrary],
})
const alreadyService = await createService({
  id: 'svc-h17-5-2-already',
  name: 'H17.5.2 already composed',
  templateId: alreadyTemplate.id,
  contentBlockIds: [libraryId],
})
const alreadyCreated = await createFromService(alreadyService, [alreadyTemplate])
const alreadyStored = await loadStoredProposalById(alreadyCreated.id)

assert(
  'B. Create does not duplicate a libraryId already present on the template copy',
  alreadyStored.blocks.filter((block) => block.libraryId === libraryId).length === 1 &&
    alreadyStored.blocks.length === 2 &&
    alreadyStored.blocks.some(
      (block) =>
        block.type === BLOCK_TYPE.COVER &&
        block.data.heading === 'Keep this authored cover',
    ),
)

const emptyService = await createService({
  id: 'svc-h17-5-2-empty',
  name: 'H17.5.2 empty ids',
  templateId: linkedTemplate.id,
  contentBlockIds: [],
})
const emptyExtras = proposalFromTemplate(linkedTemplate, emptyService)
const emptyPayload = {
  ...emptyExtras,
  title: emptyExtras.title || `${emptyService.name} proposal`,
  clientName: emptyExtras.clientName?.trim() || DEFAULT_CLIENT_NAME,
  projectType: emptyService.name,
  serviceIds: [emptyService.id],
  summary:
    emptyExtras.summary ||
    emptyService.defaultDescription ||
    emptyService.description,
}
const emptyComposed = await composeServiceComponentsForCreate(
  emptyPayload,
  emptyService,
)
const emptyCreated = await createProposal(emptyComposed)
const emptyStored = await loadStoredProposalById(emptyCreated.id)
const absentService = await createService({
  id: 'svc-h17-5-2-absent',
  name: 'H17.5.2 absent ids',
  templateId: linkedTemplate.id,
})
const absentPayload = {
  title: `${absentService.name} proposal`,
  clientName: DEFAULT_CLIENT_NAME,
  projectType: absentService.name,
  serviceIds: [absentService.id],
}
const absentComposed = await composeServiceComponentsForCreate(
  absentPayload,
  absentService,
)

assert(
  'C. Empty or absent contentBlockIds leave create on the pre-H17.5.2 path',
  emptyComposed === emptyPayload &&
    absentComposed === absentPayload &&
    !Object.hasOwn(absentComposed, 'blocks') &&
    emptyStored.blocks.length === linkedTemplate.blocks.length &&
    emptyStored.blocks.every((block) => !block.libraryId) &&
    !emptyStored.blocks.some((block) => block.libraryId === libraryId),
)

const noTemplateService = await createService({
  id: 'svc-h17-5-2-none',
  name: 'H17.5.2 no template',
  contentBlockIds: [libraryId],
})
const noTemplateCreated = await createFromService(noTemplateService, [])
const noTemplateStored = await loadStoredProposalById(noTemplateCreated.id)
const noTemplateLibrary = noTemplateStored.blocks.find(
  (block) => block.libraryId === libraryId,
)

assert(
  'D. No linked template hydrates DEFAULT_BLOCK_SEQUENCE before composition',
  noTemplateStored.blocks.length === DEFAULT_BLOCK_SEQUENCE.length + 1 &&
    DEFAULT_BLOCK_SEQUENCE.every((step, index) => {
      const block = noTemplateStored.blocks[index]
      return block?.type === step.type && block.enabled === step.enabled
    }) &&
    noTemplateLibrary?.libraryId === libraryId &&
    noTemplateLibrary.id !== libraryId &&
    sourceOf('src', 'utils', 'templateBlocks.js').includes('ensureProposalBlocks(payload)'),
)

const unknownId = 'prop-h17-5-2-unknown'
const unknownService = await createService({
  id: 'svc-h17-5-2-unknown',
  name: 'H17.5.2 unknown library',
  templateId: linkedTemplate.id,
  contentBlockIds: ['block-missing-h17-5-2'],
})
let unknownError = null
try {
  const extras = proposalFromTemplate(linkedTemplate, unknownService)
  const payload = {
    ...extras,
    id: unknownId,
    title: extras.title || `${unknownService.name} proposal`,
    clientName: extras.clientName?.trim() || DEFAULT_CLIENT_NAME,
    projectType: unknownService.name,
    serviceIds: [unknownService.id],
    summary:
      extras.summary ||
      unknownService.defaultDescription ||
      unknownService.description,
  }
  const composed = await composeServiceComponentsForCreate(
    payload,
    unknownService,
  )
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
  'E. Unknown library id throws NotFoundError and creates no proposal row',
  unknownError instanceof NotFoundError &&
    unknownError.message.includes('block-missing-h17-5-2') &&
    unknownStored === false,
)

const createPageSource = sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx')
const helperSource = sourceOf('src', 'utils', 'templateBlocks.js')
assert(
  'F. proposalFromTemplate.js remains a sync template copy with no library fetch',
  !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes(
    'fetchLibraryBlockById',
  ) &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes(
      'composeTemplateFromService',
    ) &&
    !sourceOf('src', 'utils', 'proposalFromTemplate.js').includes(
      'composeServiceComponentsForCreate',
    ) &&
    !createPageSource.includes('fetchLibraryBlockById') &&
    createPageSource.includes('composeServiceComponentsForCreate(payload, service)') &&
    createPageSource.includes('create(composed)'),
)

assert(
  'G. Duplicate proposal flow does not invoke create-time service composition',
  !sourceOf('src', 'components', 'CreateProposal', 'CreateProposalDialog.jsx').includes(
    'composeServiceComponentsForCreate',
  ) &&
    !sourceOf('src', 'utils', 'duplicateDraft.js').includes(
      'composeServiceComponentsForCreate',
    ) &&
    !sourceOf('src', 'utils', 'duplicateDraft.js').includes(
      'composeTemplateFromService',
    ) &&
    !createPageSource.includes('applyServiceComponentsToProposal') &&
    !createPageSource.includes('updateProposal'),
)

const sourceAfter = await fetchLibraryBlockById(libraryId)
const templateAfter = await fetchTemplateById(linkedTemplate.id)

assert(
  'H. Source library records and the linked template are not mutated',
  JSON.stringify(sourceAfter) === sourceSnapshot &&
    sourceAfter.useCount === sourceUseCount &&
    JSON.stringify(templateAfter) === templateSnapshot &&
    helperSource.includes('composeTemplateFromService') &&
    /return \{\s*\.\.\.payload,\s*blocks: composed\.blocks,\s*\}/.test(helperSource) &&
    !helperSource.includes('createProposal('),
)

await updateLibraryBlock(libraryId, {
  data: { body: 'MUTATED LIBRARY BODY' },
})
const storedAfterLibraryEdit = await loadStoredProposalById(created.id)
assert(
  'H2. Mutating the library after create does not rewrite stored proposal blocks',
  storedAfterLibraryEdit.blocks.find((block) => block.libraryId === libraryId)?.data
    .body === sourceBefore.data.body,
)

runVerifier(
  'verify-proposal-service-composition.mjs',
  'I. H17.5.1 verifier remains green',
)
runVerifier(
  'verify-template-service-composition.mjs',
  'I2. H17.4 verifier remains green',
)
runVerifier('verify-template-composition.mjs', 'I3. H17.3 verifier remains green')
runVerifier(
  'verify-template-block-authoring.mjs',
  'I4. H17.2 verifier remains green',
)
runVerifier(
  'verify-template-block-assembly.mjs',
  'I5. H17.1 verifier remains green',
)

await resetLibraryBlocks()
await resetServices()
resetTemplates()
await resetProposals()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
