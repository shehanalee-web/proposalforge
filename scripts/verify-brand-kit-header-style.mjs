import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COVER_STYLE,
  FOOTER_STYLE,
  HEADER_STYLE,
  HEADER_STYLES,
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
    throw new Error('Brand Kit header style must not write proposal or template records.')
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
const headerSource = sourceOf('src', 'pdf', 'ProposalHeader.jsx')
const stylesSource = sourceOf('src', 'pdf', 'pdfStyles.js')
const footerSource = sourceOf('src', 'pdf', 'ProposalFooter.jsx')
const watermarkSource = sourceOf('src', 'pdf', 'ProposalWatermark.jsx')
const pdfBrandSource = sourceOf('src', 'pdf', 'pdfBrand.js')
const documentSource = sourceOf('src', 'pdf', 'ProposalDocument.jsx')
const fontsSource = sourceOf('src', 'pdf', 'pdfFonts.js')
const pdfSource = sourceOf('src', 'blocks', 'pdf.jsx')
const screenSource = sourceOf('src', 'blocks', 'screen.jsx')
const chromeSource = sourceOf('src', 'theme', 'DocumentChrome.jsx')
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
const headerStart = formSource.indexOf('kicker="Header"')
const chromeStart = formSource.indexOf('kicker="Document chrome"')
const contactStart = formSource.indexOf('kicker="Contact"')
const headerCard = formSource.slice(headerStart, chromeStart)
const chromeCard = formSource.slice(chromeStart, contactStart)
const brandBandBlock = stylesSource.slice(
  stylesSource.indexOf('brandBand:'),
  stylesSource.indexOf('headerCenteredBand:'),
)
const centeredBandBlock = stylesSource.slice(
  stylesSource.indexOf('headerCenteredBand:'),
  stylesSource.indexOf('headerCenteredStudio:'),
)

assert(
  'A. BrandKitForm authors headerStyle via existing HEADER_STYLES',
  coverStart > typeStart &&
    headerStart > coverStart &&
    chromeStart > headerStart &&
    headerCard.includes('id="headerStyle"') &&
    headerCard.includes('values.headerStyle') &&
    headerCard.includes('HEADER_STYLES.map') &&
    headerCard.includes('patch({ headerStyle: event.target.value })') &&
    formSource.includes('HEADER_STYLE') &&
    brandModelSource.includes("STANDARD: 'standard'") &&
    brandModelSource.includes("MINIMAL: 'minimal'") &&
    brandModelSource.includes("CENTERED: 'centered'"),
)

assert(
  'B. Save still uses updateBrandKit / makeBrandKit',
  pageSource.includes('makeBrandKit(kit)') &&
    pageSource.includes('await update(values)') &&
    pageSource.includes('useUpdateBrandKit') &&
    !headerCard.includes('updateProposal') &&
    !headerCard.includes('writeDesign'),
)

await resetBrandKit()
const persisted = []
for (const style of HEADER_STYLES) {
  const saved = await updateBrandKit({
    companyName: 'Forge Studio',
    headerStyle: style,
  })
  persisted.push(saved.headerStyle === style)
}
const reloaded = await fetchBrandKit()
assert(
  'C. standard / minimal / centered persist and round-trip',
  persisted.length === 3 &&
    persisted.every(Boolean) &&
    HEADER_STYLES.includes(reloaded.headerStyle) &&
    reloaded.headerStyle === HEADER_STYLE.CENTERED,
)

const invalid = validateBrandKit(
  makeBrandKit({ companyName: 'Forge Studio', headerStyle: 'banner' }),
)
assert(
  'D. Invalid headerStyle fails validation',
  invalid.some((error) => error.field === 'headerStyle'),
)

assert(
  'E. ProposalHeader reads brand.headerStyle',
  headerSource.includes('export default ProposalHeader') &&
    headerSource.includes('const headerStyle = brand?.headerStyle') &&
    headerSource.includes('HEADER_STYLE.STANDARD') &&
    headerSource.includes('HEADER_STYLE.MINIMAL') &&
    headerSource.includes('HEADER_STYLE.CENTERED') &&
    !headerSource.includes('tokens.chrome') &&
    !headerSource.includes('readDesign') &&
    !headerSource.includes('localStorage'),
)

assert(
  'F. Three distinct PDF header treatments',
  headerSource.includes('styles.brandBand') &&
    headerSource.includes('styles.headerCenteredBand') &&
    headerSource.includes('HEADER_STYLE.MINIMAL') &&
    headerSource.includes('headerStyle !== HEADER_STYLE.MINIMAL') &&
    brandBandBlock.includes("flexDirection: 'row'") &&
    centeredBandBlock.includes("alignItems: 'center'") &&
    !centeredBandBlock.includes("flexDirection: 'row'") &&
    stylesSource.includes('headerCenteredBand:') &&
    stylesSource.includes('headerCenteredTitle:'),
)

assert(
  'G. Metadata remains present for every header treatment',
  headerSource.includes('styles.metaRow') &&
    headerSource.includes('<Meta label="Number"') &&
    headerSource.includes('<Meta label="Status"') &&
    headerSource.includes('<Meta label="Issued"') &&
    headerSource.includes('<Meta label="Updated"') &&
    headerSource.includes('<Meta label="Valid until"') &&
    !headerSource.includes('return null'),
)

assert(
  'H. Full-bleed skips only the dark brand band',
  headerSource.includes('fullBleed = brand?.coverStyle === COVER_STYLE.FULL_BLEED') &&
    headerSource.includes('showDarkBand') &&
    headerSource.includes('!fullBleed && headerStyle !== HEADER_STYLE.MINIMAL') &&
    headerSource.includes('styles.metaRow') &&
    headerSource.includes('[styles.body, styles.muted]'),
)

assert(
  'I. Standard dark band uses the light logo surface',
  headerSource.includes("resolvePdfLogo(brand, 'light')") &&
    headerSource.includes("logoUrl = showDarkBand ? resolvePdfLogo(brand, 'light') : ''") &&
    !headerSource.includes("resolvePdfLogo(brand, 'dark')"),
)

const designed = applyDesignToBrand(
  makeBrandKit({
    companyName: 'Forge Studio',
    headerStyle: HEADER_STYLE.CENTERED,
    coverStyle: COVER_STYLE.SPLIT,
    typography: { fontFamily: 'inter' },
    watermarkEnabled: true,
    watermarkText: 'INTERNAL',
    footerStyle: FOOTER_STYLE.CONTACT,
    pageNumberPosition: PAGE_NUMBER_POSITION.HIDDEN,
  }),
  {
    branding: { logo: '', logoLight: '', logoDark: '', icon: '', favicon: '' },
    cover: { backgroundImage: '', layout: 'stacked' },
    colors: { accent: '#111111', text: '', background: '' },
    typography: { headingFont: 'playfair', bodyFont: 'georgia' },
  },
)
assert(
  'J. applyDesignToBrand preserves headerStyle and H19.1–H19.3 fields',
  designed.headerStyle === HEADER_STYLE.CENTERED &&
    designed.coverStyle === COVER_STYLE.SPLIT &&
    designed.typography.fontFamily === 'inter' &&
    designed.watermarkEnabled === true &&
    designed.watermarkText === 'INTERNAL' &&
    designed.footerStyle === FOOTER_STYLE.CONTACT &&
    designed.pageNumberPosition === PAGE_NUMBER_POSITION.HIDDEN &&
    !bridgeSource.includes('headerStyle') &&
    bridgeSource.includes('...brand,'),
)

assert(
  'K. Header card sits between Cover and Document chrome',
  headerStart > coverStart &&
    chromeStart > headerStart &&
    headerCard.includes('id="headerStyle"') &&
    !headerCard.includes('id="coverStyle"') &&
    !headerCard.includes('id="footerStyle"') &&
    !headerCard.includes('id="watermarkEnabled"') &&
    !chromeCard.includes('headerStyle') &&
    chromeCard.includes('id="watermarkEnabled"') &&
    chromeCard.includes('id="footerStyle"') &&
    !chromeCard.includes('ImageUpload'),
)

assert(
  'L. PDF header does not read Theme chrome / localStorage',
  headerSource.includes('brand?.headerStyle') &&
    !headerSource.includes('tokens.chrome') &&
    !headerSource.includes('cover.layout') &&
    !documentSource.includes('headerStyle') &&
    !resolveSource.includes('headerStyle') &&
    !chromeSource.includes('headerStyle') &&
    !screenSource.includes('headerStyle'),
)

assert(
  'M. No proposal/template/service writes',
  !formSource.includes('updateProposal') &&
    !formSource.includes('updateTemplate') &&
    !formSource.includes('updateService') &&
    !headerSource.includes('updateProposal') &&
    !proposalModelSource.includes('headerStyle') &&
    !templateModelSource.includes('headerStyle') &&
    !serviceModelSource.includes('headerStyle'),
)

assert(
  'N. watermarkAssetId remains unauthored; Brand Kit has no asset picker',
  !formSource.includes('watermarkAssetId') &&
    brandModelSource.includes('watermarkAssetId') &&
    !pageSource.includes('listAssets') &&
    !formSource.includes('listAssets') &&
    !formSource.includes('AssetPicker') &&
    !headerSource.includes('listAssets'),
)

assert(
  'O. No proposal.assetIds / template.assetIds',
  !proposalModelSource.includes('assetIds') &&
    !templateModelSource.includes('assetIds') &&
    serviceModelSource.includes('assetIds'),
)

assert(
  'P. Cover / footer / watermark / type paths remain',
  pdfSource.includes('brand?.coverStyle') &&
    footerSource.includes('brand?.footerStyle') &&
    footerSource.includes('brand?.pageNumberPosition') &&
    pdfBrandSource.includes('brand?.watermarkEnabled') &&
    watermarkSource.includes('resolvePdfWatermark(proposal, brand)') &&
    documentSource.includes('resolvePdfFontFamily(brand.typography?.fontFamily)') &&
    fontsSource.includes('registerPdfFonts') &&
    formSource.includes('id="coverStyle"') &&
    formSource.includes('id="fontFamily"'),
)

assert(
  'Q. H17/H18 compose/apply paths untouched',
  composeSource.includes('composeTemplateAssets') &&
    !composeSource.includes('headerStyle') &&
    !createProposalSource.includes('headerStyle') &&
    !proposalEditSource.includes('headerStyle') &&
    !serviceEditorSource.includes('headerStyle') &&
    assetsSource.includes('handleLibraryUpload'),
)

assert(
  'R. Default headerStyle is standard',
  makeBrandKit({ companyName: 'Forge Studio' }).headerStyle === HEADER_STYLE.STANDARD,
)

assert(
  'ServiceEditor H18 lock remains',
  !serviceEditorSource.includes('listAssets') &&
    !proposalEditSource.includes('listAssets'),
)

await resetBrandKit()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
