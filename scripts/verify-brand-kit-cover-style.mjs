import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COVER_STYLE,
  COVER_STYLES,
  FOOTER_STYLE,
  HEADER_STYLE,
  PAGE_NUMBER_POSITION,
  makeBrandKit,
  validateBrandKit,
} from '../src/models/brandKit.js'
import {
  fetchBrandKit,
  resetBrandKit,
  updateBrandKit,
} from '../src/services/brandKitService.js'
import { applyDesignToBrand } from '../src/theme/brandBridge.js'
import { resolveDesign, seedFromBrand } from '../src/theme/resolve.js'

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

let storedKit = null
const originalFetch = globalThis.fetch

globalThis.fetch = async (url, init) => {
  const href = String(url)
  const method = String(init?.method || 'GET').toUpperCase()

  if (href.includes('/api/assets')) {
    return { ok: true, json: async () => [] }
  }

  if (href.includes('/api/brand-kit') && method === 'PUT') {
    storedKit = JSON.parse(init.body)
    return { ok: true, json: async () => ({ record: storedKit }) }
  }

  if (href.includes('/api/brand-kit')) {
    return {
      ok: true,
      json: async () => (storedKit ? { record: storedKit } : { record: null }),
    }
  }

  if (href.includes('/api/proposals') || href.includes('/api/templates')) {
    throw new Error('Brand Kit cover style must not write proposal or template records.')
  }

  if (typeof originalFetch === 'function') {
    return originalFetch(url, init)
  }

  throw new TypeError(`Unexpected fetch: ${href}`)
}

const formSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKitForm.jsx')
const pageSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKit.jsx')
const brandModelSource = sourceOf('src', 'models', 'brandKit.js')
const resolveSource = sourceOf('src', 'theme', 'resolve.js')
const pdfSource = sourceOf('src', 'blocks', 'pdf.jsx')
const stylesSource = sourceOf('src', 'pdf', 'pdfStyles.js')
const screenSource = sourceOf('src', 'blocks', 'screen.jsx')
const pdfBrandSource = sourceOf('src', 'pdf', 'pdfBrand.js')
const footerSource = sourceOf('src', 'pdf', 'ProposalFooter.jsx')
const watermarkSource = sourceOf('src', 'pdf', 'ProposalWatermark.jsx')
const documentSource = sourceOf('src', 'pdf', 'ProposalDocument.jsx')
const fontsSource = sourceOf('src', 'pdf', 'pdfFonts.js')
const activitySource = sourceOf('src', 'pdf', 'ActivityLogDocument.jsx')
const bridgeSource = sourceOf('src', 'theme', 'brandBridge.js')
const proposalModelSource = sourceOf('src', 'models', 'proposal.js')
const templateModelSource = sourceOf('src', 'models', 'template.js')
const serviceModelSource = sourceOf('src', 'models', 'service.js')
const composeSource = sourceOf('src', 'utils', 'templateBlocks.js')
const createProposalSource = sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx')
const proposalEditSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const serviceEditorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
const assetsSource = sourceOf('src', 'pages', 'Assets', 'Assets.jsx')

const typeStart = formSource.indexOf('kicker="Type"')
const coverStart = formSource.indexOf('kicker="Cover"')
const chromeStart = formSource.indexOf('kicker="Document chrome"')
const contactStart = formSource.indexOf('kicker="Contact"')
const coverCard = formSource.slice(coverStart, chromeStart)
const chromeCard = formSource.slice(chromeStart, contactStart)

assert(
  'A. BrandKitForm authors coverStyle via existing COVER_STYLES',
  coverStart > typeStart &&
    chromeStart > coverStart &&
    coverCard.includes('id="coverStyle"') &&
    coverCard.includes('values.coverStyle') &&
    coverCard.includes('COVER_STYLES.map') &&
    coverCard.includes('patch({ coverStyle: event.target.value })') &&
    formSource.includes('COVER_STYLE') &&
    brandModelSource.includes("FULL_BLEED: 'full-bleed'") &&
    brandModelSource.includes("SPLIT: 'split'") &&
    brandModelSource.includes("MINIMAL: 'minimal'"),
)

assert(
  'B. Save still uses updateBrandKit / makeBrandKit',
  pageSource.includes('makeBrandKit(kit)') &&
    pageSource.includes('await update(values)') &&
    pageSource.includes('useUpdateBrandKit') &&
    !coverCard.includes('updateProposal') &&
    !coverCard.includes('writeDesign'),
)

await resetBrandKit()
const persisted = []
for (const style of COVER_STYLES) {
  const saved = await updateBrandKit({
    companyName: 'Forge Studio',
    coverStyle: style,
  })
  persisted.push(saved.coverStyle === style)
}
const reloaded = await fetchBrandKit()
assert(
  'C. full-bleed / split / minimal persist and round-trip',
  persisted.length === 3 &&
    persisted.every(Boolean) &&
    COVER_STYLES.includes(reloaded.coverStyle) &&
    reloaded.coverStyle === COVER_STYLE.MINIMAL,
)

const invalid = validateBrandKit(
  makeBrandKit({ companyName: 'Forge Studio', coverStyle: 'banner' }),
)
assert(
  'D. Invalid coverStyle fails validation',
  invalid.some((error) => error.field === 'coverStyle'),
)

assert(
  'E. CoverPdf reads brand.coverStyle',
  pdfSource.includes('export function CoverPdf') &&
    pdfSource.includes('const coverStyle = brand?.coverStyle') &&
    pdfSource.includes('COVER_STYLE.SPLIT') &&
    pdfSource.includes('COVER_STYLE.FULL_BLEED') &&
    pdfSource.includes('styles.coverMinimal') &&
    !pdfSource.includes('tokens.cover') &&
    !pdfSource.includes('readDesign'),
)

const coverPdfSource = pdfSource.slice(
  pdfSource.indexOf('export function CoverPdf'),
  pdfSource.indexOf('export function ExecutiveSummaryPdf'),
)
assert(
  'F. PDF cover is no longer a single unstyled stack for all kits',
  stylesSource.includes('coverMinimal:') &&
    stylesSource.includes('coverSplit:') &&
    stylesSource.includes('coverBleed:') &&
    coverPdfSource.includes('styles.coverSplit') &&
    coverPdfSource.includes('styles.coverBleed') &&
    coverPdfSource.includes('styles.coverMinimal') &&
    !coverPdfSource.includes('styles.section'),
)

const splitBrand = makeBrandKit({
  companyName: 'Forge Studio',
  coverStyle: COVER_STYLE.SPLIT,
  typography: { fontFamily: 'inter' },
  watermarkEnabled: true,
  watermarkText: 'INTERNAL',
  footerStyle: FOOTER_STYLE.CONTACT,
  pageNumberPosition: PAGE_NUMBER_POSITION.HIDDEN,
})
const seeded = seedFromBrand(splitBrand)
assert(
  'G. seedFromBrand maps coverStyle → cover.layout',
  resolveSource.includes('layout: kit.coverStyle || undefined') &&
    seeded.cover.layout === COVER_STYLE.SPLIT &&
    seeded.cover.layout === 'split',
)

const savedThemeWins = resolveDesign(
  { cover: { layout: 'full-bleed' } },
  { id: 'proposal-1', title: 'Cover check' },
  splitBrand,
)
const brandDefault = resolveDesign(null, { id: 'proposal-1', title: 'Cover check' }, splitBrand)
assert(
  'H. Saved Theme cover.layout still wins on screen',
  savedThemeWins.cover.layout === 'full-bleed' &&
    brandDefault.cover.layout === COVER_STYLE.SPLIT &&
    screenSource.includes('cover.layout === \'split\'') &&
    screenSource.includes('const cover = tokens.cover'),
)

assert(
  'I. PDF does not read Theme cover.layout / localStorage design',
  pdfSource.includes('brand?.coverStyle') &&
    !pdfSource.includes('tokens.cover.layout') &&
    !pdfSource.includes('cover.layout') &&
    !pdfSource.includes('readDesign') &&
    !pdfSource.includes('localStorage') &&
    !documentSource.includes('tokens.cover'),
)

const designed = applyDesignToBrand(splitBrand, {
  branding: { logo: '', logoLight: '', logoDark: '', icon: '', favicon: '' },
  cover: { backgroundImage: '', layout: 'stacked' },
  colors: { accent: '#111111', text: '', background: '' },
  typography: { headingFont: 'playfair', bodyFont: 'georgia' },
})
assert(
  'J. applyDesignToBrand preserves coverStyle and H19.1 chrome / H19.2 fontFamily',
  designed.coverStyle === COVER_STYLE.SPLIT &&
    designed.typography.fontFamily === 'inter' &&
    designed.watermarkEnabled === true &&
    designed.watermarkText === 'INTERNAL' &&
    designed.footerStyle === FOOTER_STYLE.CONTACT &&
    designed.pageNumberPosition === PAGE_NUMBER_POSITION.HIDDEN &&
    designed.headerStyle === HEADER_STYLE.STANDARD &&
    !bridgeSource.includes('coverStyle') &&
    bridgeSource.includes('...brand,'),
)

assert(
  'K. No proposal/template/service writes',
  !formSource.includes('updateProposal') &&
    !formSource.includes('updateTemplate') &&
    !formSource.includes('updateService') &&
    !pdfSource.includes('updateProposal') &&
    !resolveSource.includes('updateProposal') &&
    !proposalModelSource.includes('coverStyle') &&
    !templateModelSource.includes('coverStyle') &&
    !serviceModelSource.includes('coverStyle'),
)

assert(
  'L. headerStyle / watermarkAssetId remain unauthored',
  !formSource.includes('headerStyle') &&
    !formSource.includes('watermarkAssetId') &&
    brandModelSource.includes('headerStyle') &&
    brandModelSource.includes('watermarkAssetId'),
)

assert(
  'M. Document chrome card still has no coverStyle (H19.1 lock)',
  chromeStart > coverStart &&
    chromeCard.includes('id="watermarkEnabled"') &&
    chromeCard.includes('id="footerStyle"') &&
    !chromeCard.includes('coverStyle') &&
    !chromeCard.includes('headerStyle') &&
    !chromeCard.includes('ImageUpload'),
)

assert(
  'N. resolvePdfWatermark / ProposalFooter unchanged',
  pdfBrandSource.includes('brand?.watermarkEnabled') &&
    pdfBrandSource.includes("brand.watermarkText?.trim() || 'CONFIDENTIAL'") &&
    footerSource.includes('brand?.footerStyle') &&
    footerSource.includes('brand?.pageNumberPosition') &&
    watermarkSource.includes('resolvePdfWatermark(proposal, brand)') &&
    !pdfBrandSource.includes('coverStyle') &&
    !footerSource.includes('coverStyle'),
)

assert(
  'O. Brand Kit page still has no listAssets',
  !pageSource.includes('listAssets') &&
    !formSource.includes('listAssets') &&
    !formSource.includes('AssetPicker'),
)

assert(
  'P. No proposal.assetIds / template.assetIds',
  !proposalModelSource.includes('assetIds') &&
    !templateModelSource.includes('assetIds') &&
    serviceModelSource.includes('assetIds'),
)

assert(
  'Q. Activity-log PDF remains Helvetica',
  activitySource.includes("fontFamily: 'Helvetica'") &&
    activitySource.includes("fontFamily: 'Helvetica-Bold'") &&
    !activitySource.includes('coverStyle') &&
    !activitySource.includes('pdfFonts'),
)

assert(
  'R. H17/H18 compose/apply paths untouched',
  composeSource.includes('composeTemplateAssets') &&
    !composeSource.includes('coverStyle') &&
    !createProposalSource.includes('coverStyle') &&
    !proposalEditSource.includes('coverStyle') &&
    !serviceEditorSource.includes('coverStyle') &&
    assetsSource.includes('handleLibraryUpload'),
)

assert(
  'H19.2 type path remains',
  documentSource.includes('resolvePdfFontFamily(brand.typography?.fontFamily)') &&
    fontsSource.includes('registerPdfFonts') &&
    formSource.includes('id="fontFamily"'),
)

assert(
  'ServiceEditor H18 lock remains',
  !serviceEditorSource.includes('listAssets') &&
    !proposalEditSource.includes('listAssets'),
)

assert(
  'Unknown coverStyle falls back to the minimal PDF treatment',
  pdfSource.includes('COVER_STYLE.SPLIT') &&
    pdfSource.includes('COVER_STYLE.FULL_BLEED') &&
    pdfSource.includes('styles.coverMinimal') &&
    makeBrandKit({ companyName: 'Forge Studio' }).coverStyle === COVER_STYLE.MINIMAL,
)

runVerifier(
  'verify-brand-kit-pdf-type.mjs',
  'S. H19.2 PDF type verifier remains green',
)
runVerifier(
  'verify-brand-kit-document-chrome.mjs',
  'T. H19.1 Brand Kit document chrome verifier remains green',
)
runVerifier(
  'verify-asset-library-ingest.mjs',
  'U. H18.2 Asset Library ingest verifier remains green',
)
runVerifier(
  'verify-asset-library-picker.mjs',
  'V. H18.1 Asset Library picker verifier remains green',
)
runVerifier(
  'verify-proposal-create-asset-composition.mjs',
  'W. H17.8 verifier remains green',
)
runVerifier(
  'verify-proposal-asset-composition.mjs',
  'X. H17.7 verifier remains green',
)
runVerifier(
  'verify-template-asset-composition.mjs',
  'Y. H17.6 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'Z. H17.5.2 verifier remains green',
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
