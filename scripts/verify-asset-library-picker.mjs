import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_KIND } from '../src/models/asset.js'
import { makeAssetRef } from '../src/models/brandKit.js'
import { makeCoverData, makeGalleryItem } from '../src/blocks/schemas.js'
import { makeService } from '../src/models/service.js'
import {
  listAssets,
  putAsset,
  resetAssets,
} from '../src/services/assetService.js'
import {
  assetMatchesVariant,
  filterLibraryAssets,
  selectLibraryAsset,
  toggleAssetId,
} from '../src/components/AssetPicker/libraryAsset.js'

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

const pickerSource = sourceOf('src', 'components', 'AssetPicker', 'AssetPicker.jsx')
const helperSource = sourceOf('src', 'components', 'AssetPicker', 'libraryAsset.js')
const uploadSource = sourceOf('src', 'components', 'ImageUpload', 'ImageUpload.jsx')
const serviceFormSource = sourceOf('src', 'pages', 'Services', 'ServiceForm.jsx')
const serviceEditorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
const proposalEditSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const blockFieldsSource = sourceOf('src', 'blocks', 'editor', 'BlockFields.jsx')
const brandFormSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKitForm.jsx')

assert(
  'A. AssetPicker uses listAssets',
  pickerSource.includes('listAssets()') &&
    pickerSource.includes("from '../../services/assetService.js'") &&
    !helperSource.includes('listAssets'),
)

assert(
  'B. AssetPicker does not call uploadAsset when selecting',
  !pickerSource.includes('uploadAsset') &&
    !helperSource.includes('uploadAsset') &&
    helperSource.includes('onChange(asset.url, asset)') &&
    helperSource.includes('export function selectLibraryAsset'),
)

assert(
  'C. ImageUpload upload path still uses uploadAsset',
  uploadSource.includes('await uploadAsset(file, { onProgress: setProgress })') &&
    uploadSource.includes('onChange(asset.url, asset)') &&
    uploadSource.includes('selectLibraryAsset(onChange, asset)'),
)

const image = putAsset({
  id: 'asset-h18-1-hero',
  name: 'Hero render',
  kind: ASSET_KIND.IMAGE,
  mimeType: 'image/jpeg',
  url: '/uploads/asset-h18-1-hero/hero.jpg',
  caption: 'Library caption must not overwrite gallery caption',
})
const pdf = putAsset({
  id: 'asset-h18-1-spec',
  name: 'Specification PDF',
  kind: ASSET_KIND.DOCUMENT,
  mimeType: 'application/pdf',
  url: '/uploads/asset-h18-1-spec/spec.pdf',
})
const assetsBefore = JSON.stringify(await listAssets())

let receivedUrl = null
let receivedAsset = null
selectLibraryAsset((url, asset) => {
  receivedUrl = url
  receivedAsset = asset
}, image)

assert(
  'D. Existing asset selection passes asset.url and asset object through onChange',
  receivedUrl === image.url &&
    receivedAsset === image &&
    receivedAsset.id === image.id,
)

const cover = makeCoverData({
  imageUrl: receivedAsset.url,
  imageAssetId: receivedAsset.id,
})
assert(
  'E. Cover stores assetId + url through existing consumer behavior',
  cover.imageUrl === image.url &&
    cover.imageAssetId === image.id &&
    blockFieldsSource.includes('imageUrl: asset?.url ?? url ?? \'\'' ) &&
    blockFieldsSource.includes('imageAssetId: asset?.id ?? \'\''),
)

const galleryCaption = 'Keep this authored caption'
const galleryItem = makeGalleryItem({
  url: receivedAsset.url,
  assetId: receivedAsset.id,
  caption: galleryCaption,
})
assert(
  'F. Gallery stores assetId + url without overwriting caption',
  galleryItem.assetId === image.id &&
    galleryItem.url === image.url &&
    galleryItem.caption === galleryCaption &&
    galleryItem.caption !== image.caption &&
    blockFieldsSource.includes('assetId: asset?.id ?? \'\''),
)

const brandRef = makeAssetRef({ assetId: receivedAsset.id, url: receivedAsset.url })
assert(
  'G. Brand asset refs remain { assetId, url }',
  brandRef.assetId === image.id &&
    brandRef.url === image.url &&
    brandFormSource.includes('makeAssetRef({ assetId: asset?.id ?? null, url })'),
)

const added = toggleAssetId([], image.id)
const duplicate = toggleAssetId(added, image.id)
const withPdf = toggleAssetId(toggleAssetId([], image.id), pdf.id)
const service = makeService({
  name: 'H18.1 service',
  assetIds: withPdf,
})
assert(
  'H. Service picker stores IDs only',
  added.join() === image.id &&
    withPdf.join() === `${image.id},${pdf.id}` &&
    service.assetIds.join() === `${image.id},${pdf.id}` &&
    !Object.hasOwn(service, 'blocks') &&
    serviceFormSource.includes('onChange(\'assetIds\', toggleAssetId(selectedAssetIds, id))') &&
    serviceFormSource.includes('<AssetPicker'),
)

assert(
  'I. Service duplicate IDs are not duplicated',
  duplicate.join() === '' &&
    toggleAssetId([image.id, image.id, ` ${image.id} `], pdf.id).join() ===
      `${image.id},${pdf.id}`,
)

assert(
  'J. Service picker does not compose gallery items',
  !pickerSource.includes('composeTemplateAssets') &&
    !helperSource.includes('composeTemplateAssets') &&
    !serviceFormSource.includes('composeTemplateAssets') &&
    !serviceFormSource.includes('applyServiceAssetsToTemplate') &&
    !uploadSource.includes('composeTemplateAssets'),
)

assert(
  'K. Picker does not persist proposals/templates/services',
  !pickerSource.includes('createProposal') &&
    !pickerSource.includes('updateProposal') &&
    !pickerSource.includes('updateTemplate') &&
    !pickerSource.includes('updateService') &&
    !helperSource.includes('createProposal') &&
    !helperSource.includes('updateProposal') &&
    serviceFormSource.includes('onSubmit') &&
    !serviceFormSource.includes('composeServiceAssetsForCreate'),
)

let emptyThrew = false
try {
  filterLibraryAssets([])
  filterLibraryAssets([], { variant: 'file', query: 'missing' })
} catch {
  emptyThrew = true
}
assert(
  'L. Empty library does not throw',
  emptyThrew === false &&
    filterLibraryAssets([]).length === 0 &&
    pickerSource.includes('No files in the Asset Library yet.'),
)

assert(
  'M. Picker does not fetch while closed/mounted',
  !uploadSource.includes('listAssets') &&
    uploadSource.includes('{libraryOpen ? (') &&
    uploadSource.includes('<AssetPicker') &&
    serviceFormSource.includes('{libraryOpen ? (') &&
    pickerSource.includes('useEffect(() => {') &&
    pickerSource.includes('listAssets()'),
)

assert(
  'N. variant=file accepts PDFs and images',
  assetMatchesVariant(image, 'file') &&
    assetMatchesVariant(pdf, 'file') &&
    assetMatchesVariant(image, 'image') &&
    !assetMatchesVariant(pdf, 'image') &&
    filterLibraryAssets([image, pdf], { variant: 'file' }).length === 2 &&
    filterLibraryAssets([image, pdf], { variant: 'image' }).map((asset) => asset.id).join() ===
      image.id &&
    uploadSource.includes('variant={variant}') &&
    serviceFormSource.includes('variant="file"'),
)

const afterPick = JSON.stringify(await listAssets())
assert(
  'O. Asset records are not mutated by selection',
  afterPick === assetsBefore &&
    image.caption === 'Library caption must not overwrite gallery caption' &&
    !helperSource.includes('makeAsset') &&
    !helperSource.includes('uploadAsset'),
)

assert(
  'P. ServiceForm does not contain listAssets or fetchAssetById',
  !serviceFormSource.includes('listAssets') &&
    !serviceFormSource.includes('fetchAssetById') &&
    serviceFormSource.includes('from \'../../components/AssetPicker/AssetPicker.jsx\''),
)

assert(
  'Q. ServiceEditor does not contain listAssets/useAsyncData for this feature',
  !serviceEditorSource.includes('listAssets') &&
    !serviceEditorSource.includes('useAsyncData') &&
    !serviceEditorSource.includes('AssetPicker') &&
    serviceEditorSource.includes('assetIds: values.assetIds'),
)

assert(
  'R. ProposalEdit does not contain listAssets',
  !proposalEditSource.includes('listAssets') &&
    !proposalEditSource.includes('AssetPicker') &&
    !proposalEditSource.includes('uploadAsset'),
)

runVerifier(
  'verify-proposal-create-asset-composition.mjs',
  'S. H17.8 verifier remains green',
)
runVerifier(
  'verify-proposal-asset-composition.mjs',
  'T. H17.7 verifier remains green',
)
runVerifier(
  'verify-template-asset-composition.mjs',
  'U. H17.6 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'V. H17.5.2 verifier remains green',
)

resetAssets()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
