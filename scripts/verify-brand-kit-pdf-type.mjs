import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeBrandKit } from '../src/models/brandKit.js'
import { applyDesignToBrand } from '../src/theme/brandBridge.js'
import { registerPdfFonts, resolvePdfFontFamily } from '../src/pdf/pdfFonts.js'

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

const fontsSource = sourceOf('src', 'pdf', 'pdfFonts.js')
const stylesSource = sourceOf('src', 'pdf', 'pdfStyles.js')
const documentSource = sourceOf('src', 'pdf', 'ProposalDocument.jsx')
const generateSource = sourceOf('src', 'pdf', 'generateProposalPdf.js')
const formSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKitForm.jsx')
const pageSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKit.jsx')
const brandModelSource = sourceOf('src', 'models', 'brandKit.js')
const pdfBrandSource = sourceOf('src', 'pdf', 'pdfBrand.js')
const footerSource = sourceOf('src', 'pdf', 'ProposalFooter.jsx')
const watermarkSource = sourceOf('src', 'pdf', 'ProposalWatermark.jsx')
const activitySource = sourceOf('src', 'pdf', 'ActivityLogDocument.jsx')
const bridgeSource = sourceOf('src', 'theme', 'brandBridge.js')
const surfaceSource = sourceOf('src', 'theme', 'DocumentSurface.jsx')
const proposalModelSource = sourceOf('src', 'models', 'proposal.js')
const templateModelSource = sourceOf('src', 'models', 'template.js')
const serviceModelSource = sourceOf('src', 'models', 'service.js')
const composeSource = sourceOf('src', 'utils', 'templateBlocks.js')
const createProposalSource = sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx')
const proposalEditSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const serviceFormSource = sourceOf('src', 'pages', 'Services', 'ServiceForm.jsx')
const serviceEditorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
const assetsSource = sourceOf('src', 'pages', 'Assets', 'Assets.jsx')

assert(
  'A. Known webfont IDs resolve to non-Helvetica PDF families',
  resolvePdfFontFamily('inter') === 'Inter' &&
    resolvePdfFontFamily('dm-sans') === 'DM Sans' &&
    resolvePdfFontFamily('outfit') === 'Outfit' &&
    resolvePdfFontFamily('playfair') === 'Playfair Display' &&
    resolvePdfFontFamily('merriweather') === 'Merriweather' &&
    resolvePdfFontFamily('inter') !== 'Helvetica',
)

assert('B. helvetica → Helvetica', resolvePdfFontFamily('helvetica') === 'Helvetica')
assert('C. system → Helvetica', resolvePdfFontFamily('system') === 'Helvetica')
assert('D. georgia → Times-Roman', resolvePdfFontFamily('georgia') === 'Times-Roman')
assert('E. garamond → Times-Roman', resolvePdfFontFamily('garamond') === 'Times-Roman')
assert(
  'F. Unknown ID → Helvetica',
  resolvePdfFontFamily('comic-sans') === 'Helvetica' &&
    resolvePdfFontFamily('') === 'Helvetica' &&
    resolvePdfFontFamily(null) === 'Helvetica',
)

const kit = makeBrandKit({
  companyName: 'Forge Studio',
  typography: { fontFamily: 'inter' },
  watermarkEnabled: true,
  watermarkText: 'INTERNAL',
})
const beforeUnknown = JSON.stringify(kit)
resolvePdfFontFamily('not-a-font')
assert(
  'G. Unknown ID does not mutate Brand Kit',
  JSON.stringify(kit) === beforeUnknown && kit.typography.fontFamily === 'inter',
)

assert(
  'H. ProposalDocument applies resolved font family from Brand Kit id',
  documentSource.includes('registerPdfFonts()') &&
    documentSource.includes(
      '{ fontFamily: resolvePdfFontFamily(brand.typography?.fontFamily) }',
    ) &&
    documentSource.includes('brand.colors?.background') &&
    !documentSource.includes('tokens.typography') &&
    !documentSource.includes('design.typography') &&
    !documentSource.includes('headingFont'),
)

assert(
  'I. Proposal headings/chrome no longer force Helvetica-Bold',
  !stylesSource.includes('Helvetica-Bold') &&
    !stylesSource.includes("fontFamily: 'Helvetica'") &&
    stylesSource.includes('fontWeight: 700'),
)

let registerThrew = false
try {
  registerPdfFonts()
  registerPdfFonts()
} catch {
  registerThrew = true
}
assert('J. registerPdfFonts() can safely be called twice', registerThrew === false)

assert(
  'K. BrandKitForm remains the existing type authoring surface',
  formSource.includes('id="fontFamily"') &&
    formSource.includes('values.typography.fontFamily') &&
    formSource.includes('kicker="Type"') &&
    !fontsSource.includes('BrandKitForm'),
)

assert(
  'L. No new Brand Kit type fields',
  brandModelSource.includes('fontFamily') &&
    !fontsSource.includes('pdfFontFamily') &&
    !formSource.includes('pdfFontFamily') &&
    !proposalModelSource.includes('fontFamily') &&
    !templateModelSource.includes('fontFamily'),
)

assert(
  'M. resolvePdfWatermark remains unchanged',
  pdfBrandSource.includes('brand?.watermarkEnabled') &&
    pdfBrandSource.includes("brand.watermarkText?.trim() || 'CONFIDENTIAL'") &&
    watermarkSource.includes('resolvePdfWatermark(proposal, brand)') &&
    !fontsSource.includes('resolvePdfWatermark'),
)

assert(
  'N. ProposalFooter remains unchanged',
  footerSource.includes('brand?.footerStyle') &&
    footerSource.includes('brand?.pageNumberPosition') &&
    !footerSource.includes('pdfFonts') &&
    !footerSource.includes('resolvePdfFontFamily'),
)

const designed = applyDesignToBrand(kit, {
  branding: { logo: '', logoLight: '', logoDark: '', icon: '', favicon: '' },
  cover: { backgroundImage: '' },
  colors: { accent: '#111111', text: '', background: '' },
  typography: { headingFont: '', bodyFont: '' },
})
assert(
  'O. applyDesignToBrand preserves typography.fontFamily and H19.1 chrome',
  designed.typography.fontFamily === 'inter' &&
    designed.watermarkEnabled === true &&
    designed.watermarkText === 'INTERNAL' &&
    designed.footerStyle === kit.footerStyle &&
    designed.pageNumberPosition === kit.pageNumberPosition &&
    bridgeSource.includes('...brand,'),
)

assert(
  'P. No proposal/template/service writes',
  !fontsSource.includes('updateProposal') &&
    !fontsSource.includes('updateTemplate') &&
    !fontsSource.includes('updateService') &&
    !documentSource.includes('updateProposal') &&
    !generateSource.includes('updateBrandKit'),
)

assert(
  'Q. Theme typography is not the PDF source of truth',
  documentSource.includes('resolvePdfFontFamily(brand.typography?.fontFamily)') &&
    !documentSource.includes('tokens.typography') &&
    !fontsSource.includes('readDesign') &&
    !fontsSource.includes('applyThemeId'),
)

assert(
  'R. CSS stacks are never passed into @react-pdf fontFamily',
  !fontsSource.includes('sans-serif') &&
    !fontsSource.includes('fontStackFor') &&
    !documentSource.includes('headingFont') &&
    !documentSource.includes('bodyFont') &&
    resolvePdfFontFamily('inter') === 'Inter',
)

assert(
  'S. ActivityLogDocument remains Helvetica',
  activitySource.includes("fontFamily: 'Helvetica'") &&
    activitySource.includes("fontFamily: 'Helvetica-Bold'") &&
    !activitySource.includes('pdfFonts') &&
    !activitySource.includes('resolvePdfFontFamily'),
)

assert(
  'T. H17/H18 composition and apply paths are untouched',
  composeSource.includes('composeTemplateAssets') &&
    !composeSource.includes('pdfFonts') &&
    !createProposalSource.includes('resolvePdfFontFamily') &&
    !proposalEditSource.includes('resolvePdfFontFamily') &&
    !serviceFormSource.includes('resolvePdfFontFamily') &&
    assetsSource.includes('handleLibraryUpload'),
)

assert(
  'U. Brand Kit page does not gain listAssets',
  !pageSource.includes('listAssets') &&
    !formSource.includes('listAssets') &&
    !fontsSource.includes('listAssets'),
)

const chromeStart = formSource.indexOf('kicker="Document chrome"')
const contactStart = formSource.indexOf('kicker="Contact"')
const chromeCard = formSource.slice(chromeStart, contactStart)
assert(
  'V. coverStyle/headerStyle/watermarkAssetId remain unauthored',
  !formSource.includes('coverStyle') &&
    !formSource.includes('headerStyle') &&
    !formSource.includes('watermarkAssetId') &&
    !chromeCard.includes('ImageUpload') &&
    brandModelSource.includes('coverStyle') &&
    brandModelSource.includes('watermarkAssetId'),
)

assert(
  'No proposal.assetIds / template.assetIds',
  !proposalModelSource.includes('assetIds') &&
    !templateModelSource.includes('assetIds') &&
    serviceModelSource.includes('assetIds'),
)

assert(
  'ServiceEditor H18 lock remains',
  !serviceEditorSource.includes('listAssets') &&
    !proposalEditSource.includes('listAssets'),
)

assert(
  'Theme draftWatermark remains independent',
  surfaceSource.includes('tokens.metadata.draftWatermark') &&
    !fontsSource.includes('draftWatermark'),
)

runVerifier(
  'verify-brand-kit-document-chrome.mjs',
  'W. H19.1 Brand Kit document chrome verifier remains green',
)
runVerifier(
  'verify-asset-library-ingest.mjs',
  'X. H18.2 Asset Library ingest verifier remains green',
)
runVerifier(
  'verify-asset-library-picker.mjs',
  'Y. H18.1 Asset Library picker verifier remains green',
)
runVerifier(
  'verify-proposal-create-asset-composition.mjs',
  'Z. H17.8 verifier remains green',
)
runVerifier(
  'verify-proposal-asset-composition.mjs',
  'AA. H17.7 verifier remains green',
)
runVerifier(
  'verify-template-asset-composition.mjs',
  'AB. H17.6 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'AC. H17.5.2 verifier remains green',
)

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
