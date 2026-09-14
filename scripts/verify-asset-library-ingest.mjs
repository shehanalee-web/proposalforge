import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_KIND } from '../src/models/asset.js'
import { ValidationError } from '../src/services/errors.js'
import {
  listAssets,
  putAsset,
  resetAssets,
  uploadAsset,
} from '../src/services/assetService.js'

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

function pdfFile(name) {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: 'application/pdf',
  })
}

function jpegFile(name) {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, {
    type: 'image/jpeg',
  })
}

let uploadSeq = 0
let failNextUpload = false
const originalFetch = globalThis.fetch

globalThis.fetch = async (url, init) => {
  const href = String(url)
  const method = String(init?.method || 'GET').toUpperCase()

  if (method === 'POST' && href.includes('/api/proposal-files')) {
    throw new Error('Proposal-scoped upload must not run during Asset Library ingest.')
  }

  if (method === 'POST' && href.includes('/api/assets') && !href.includes('/thumbnail')) {
    if (failNextUpload) {
      failNextUpload = false
      return {
        ok: false,
        json: async () => ({ message: 'Could not store that file.' }),
      }
    }

    uploadSeq += 1
    const id = `asset-h18-2-${uploadSeq}`
    const headers = init?.headers ?? {}
    const encodedName =
      headers['X-File-Name'] || headers['x-file-name'] || encodeURIComponent('file')
    const name = decodeURIComponent(String(encodedName))
    const mimeType = String(headers['Content-Type'] || headers['content-type'] || 'application/pdf')
    const kind = mimeType.startsWith('image/') ? ASSET_KIND.IMAGE : ASSET_KIND.DOCUMENT

    return {
      ok: true,
      json: async () => ({
        id,
        name,
        kind,
        mimeType,
        sizeBytes: 4,
        url: `/uploads/${id}/${name}`,
        thumbnailUrl: `/uploads/${id}/${name}`,
        alt: '',
        caption: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    }
  }

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

const pageSource = sourceOf('src', 'pages', 'Assets', 'Assets.jsx')
const uploadSource = sourceOf('src', 'components', 'ImageUpload', 'ImageUpload.jsx')
const pickerSource = sourceOf('src', 'components', 'AssetPicker', 'AssetPicker.jsx')
const helperSource = sourceOf('src', 'components', 'AssetPicker', 'libraryAsset.js')
const modulesSource = sourceOf('src', 'workspace', 'modules.js')
const serviceEditorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
const proposalEditSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const proposalModelSource = sourceOf('src', 'models', 'proposal.js')
const templateModelSource = sourceOf('src', 'models', 'template.js')

assert(
  'A. /assets uses existing ImageUpload → uploadAsset path',
  pageSource.includes("from '../../components/ImageUpload/ImageUpload.jsx'") &&
    pageSource.includes('<ImageUpload') &&
    pageSource.includes('onChange={handleLibraryUpload}') &&
    !pageSource.includes('uploadAsset') &&
    uploadSource.includes('await uploadAsset(file, { onProgress: setProgress })') &&
    uploadSource.includes("from '../../services/assetService.js'"),
)

assert(
  'B. No second uploader is introduced',
  !pageSource.includes('UploadDropzone') &&
    !pageSource.includes('useProposalUploads') &&
    !pageSource.includes('/api/assets') &&
    !pageSource.includes('/api/proposal-files') &&
    !pageSource.includes('postBytes') &&
    !pageSource.includes('createWriteStream') &&
    pageSource.includes('listAssets') &&
    uploadSource.includes('await uploadAsset(file, { onProgress: setProgress })'),
)

const existing = putAsset({
  id: 'asset-h18-2-existing',
  name: 'Existing hero',
  kind: ASSET_KIND.IMAGE,
  mimeType: 'image/jpeg',
  url: '/uploads/asset-h18-2-existing/hero.jpg',
  caption: 'Must remain unchanged',
})
const existingSnapshot = JSON.stringify(existing)
const beforeIds = (await listAssets()).map((asset) => asset.id).sort().join()

let pageAssets = await listAssets()

async function handleLibraryUpload(_url, asset) {
  if (!asset?.id) return
  pageAssets = await listAssets()
}

const uploaded = await uploadAsset(pdfFile('library-spec.pdf'))
await handleLibraryUpload(uploaded.url, uploaded)

assert(
  'C. Successful upload appears in listAssets / page refresh state',
  uploaded.id === 'asset-h18-2-1' &&
    uploaded.url.includes('/uploads/asset-h18-2-1/') &&
    pageSource.includes('async function handleLibraryUpload') &&
    pageSource.includes('const records = await listAssets()') &&
    pageSource.includes('setAssets(records)') &&
    pageAssets.some((asset) => asset.id === uploaded.id) &&
    pageAssets.some((asset) => asset.id === existing.id),
)

const existingAfter = (await listAssets()).find((asset) => asset.id === existing.id)
assert(
  'D. Existing asset records remain unchanged',
  existingAfter != null &&
    JSON.stringify(existingAfter) === existingSnapshot &&
    existingAfter.caption === 'Must remain unchanged' &&
    beforeIds === existing.id,
)

assert(
  'E. variant=file remains compatible with image + PDF ingest',
  pageSource.includes('variant="file"') &&
    pageSource.includes('accept="application/pdf,image/*,.pdf"') &&
    uploadSource.includes("variant === 'image'") &&
    uploadSource.includes('isImageFile(file)') &&
    jpegFile('hero.jpg').type.startsWith('image/') &&
    pdfFile('spec.pdf').type === 'application/pdf',
)

assert(
  'F. Proposal-scoped uploads are not Asset Library records',
  !pageSource.includes('UploadDropzone') &&
    !pageSource.includes('proposal-files') &&
    !pageSource.includes('useProposalUploads') &&
    !pageSource.includes('makeProposalUpload') &&
    (await listAssets()).every((asset) => asset.id.startsWith('asset-')),
)

resetAssets()
let emptyThrew = false
let emptyList = null
try {
  emptyList = await listAssets()
} catch {
  emptyThrew = true
}

assert(
  'G. Empty library still exposes upload and does not throw',
  emptyThrew === false &&
    Array.isArray(emptyList) &&
    emptyList.length === 0 &&
    pageSource.includes('No files yet. Uploads from Brand Kit and proposal blocks appear here.') &&
    pageSource.includes('action={') &&
    pageSource.indexOf('<ImageUpload') < pageSource.indexOf('assets.length === 0') &&
    pageSource.includes('variant="file"'),
)

assert(
  'H. /assets may call listAssets; ProposalEdit and ServiceEditor do not',
  pageSource.includes('listAssets()') &&
    pageSource.includes("from '../../services/assetService.js'") &&
    !proposalEditSource.includes('listAssets') &&
    !serviceEditorSource.includes('listAssets') &&
    !serviceEditorSource.includes('useAsyncData'),
)

assert(
  'I. AssetPicker remains on-demand',
  !pageSource.includes('AssetPicker') &&
    !uploadSource.includes('listAssets') &&
    uploadSource.includes('{libraryOpen ? (') &&
    uploadSource.includes('<AssetPicker') &&
    pickerSource.includes('listAssets()') &&
    !helperSource.includes('listAssets'),
)

assert(
  'J. No proposal.assetIds',
  !pageSource.includes('proposal.assetIds') &&
    !proposalModelSource.includes('assetIds') &&
    !pageSource.includes('updateProposal') &&
    !pageSource.includes('createProposal'),
)

assert(
  'K. No template.assetIds',
  !pageSource.includes('template.assetIds') &&
    !templateModelSource.includes('assetIds') &&
    !pageSource.includes('updateTemplate') &&
    !pageSource.includes('createTemplate'),
)

resetAssets()
uploadSeq = 0
await listAssets()
const first = await uploadAsset(pdfFile('same-spec.pdf'))
const second = await uploadAsset(pdfFile('same-spec.pdf'))
const duplicated = await listAssets()

assert(
  'L. Duplicate upload creates a new asset id',
  first.id !== second.id &&
    first.name === 'same-spec.pdf' &&
    second.name === 'same-spec.pdf' &&
    duplicated.filter((asset) => asset.name === 'same-spec.pdf').length === 2 &&
    !pageSource.includes('content-hash') &&
    !pageSource.includes('dedup'),
)

resetAssets()
putAsset({
  id: 'asset-h18-2-keep',
  name: 'Keep me',
  kind: ASSET_KIND.DOCUMENT,
  mimeType: 'application/pdf',
  url: '/uploads/asset-h18-2-keep/keep.pdf',
})
const keepBefore = JSON.stringify(await listAssets())
failNextUpload = true
let failedUpload = null
try {
  await uploadAsset(pdfFile('broken.pdf'))
} catch (caught) {
  failedUpload = caught
}
const keepAfter = JSON.stringify(await listAssets())
let ignoredPage = await listAssets()
await handleLibraryUpload('', null)

assert(
  'M. Failed upload does not create a successful library row',
  failedUpload instanceof ValidationError &&
    keepAfter === keepBefore &&
    ignoredPage.length === 1 &&
    ignoredPage[0].id === 'asset-h18-2-keep' &&
    pageSource.includes('if (!asset?.id) return'),
)

assert(
  'N. Ingest does not call composeTemplateAssets',
  !pageSource.includes('composeTemplateAssets') &&
    !pageSource.includes('composeServiceAssetsForCreate') &&
    !pageSource.includes('templateBlocks'),
)

assert(
  'O. Ingest does not call Apply helpers',
  !pageSource.includes('applyServiceAssetsToTemplate') &&
    !pageSource.includes('applyServiceAssetsToProposal') &&
    !pageSource.includes('applyServiceComponentsToTemplate') &&
    !pageSource.includes('applyServiceComponentsToProposal') &&
    !pageSource.includes('composeServiceComponentsForCreate'),
)

assert(
  'P. Ingest does not call updateProposal',
  !pageSource.includes('updateProposal') &&
    !pageSource.includes('createProposal') &&
    !pageSource.includes('updateService') &&
    !pageSource.includes('updateBrandKit') &&
    !pageSource.includes('proposalService'),
)

assert(
  'Module copy includes /assets ingest',
  modulesSource.includes(
    'Files uploaded from this library, Brand Kit, and proposal blocks.',
  ) && !modulesSource.includes('Files uploaded from Brand Kit and proposal blocks.'),
)

runVerifier(
  'verify-asset-library-picker.mjs',
  'Q. H18.1 Asset Library Picker verifier remains green',
)
runVerifier(
  'verify-proposal-create-asset-composition.mjs',
  'R. H17.8 verifier remains green',
)
runVerifier(
  'verify-proposal-asset-composition.mjs',
  'S. H17.7 verifier remains green',
)
runVerifier(
  'verify-template-asset-composition.mjs',
  'T. H17.6 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'U. H17.5.2 verifier remains green',
)

resetAssets()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
