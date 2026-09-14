import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COVER_STYLE,
  FOOTER_STYLE,
  HEADER_STYLE,
  PAGE_NUMBER_POSITION,
  SPACING_SCALE,
  makeBrandKit,
  validateBrandKit,
} from '../src/models/brandKit.js'
import { PROPOSAL_STATUS } from '../src/models/proposal.js'
import { resolvePdfWatermark } from '../src/pdf/pdfBrand.js'
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

function contactLine(brand, settings) {
  const studio =
    brand?.companyName?.trim() ||
    brand?.contact?.legalName?.trim() ||
    settings?.studioName?.trim()
  const email = brand?.contact?.email?.trim() || settings?.contactEmail?.trim()
  const phone = brand?.contact?.phone?.trim()
  const website = brand?.contact?.website?.trim()
  const address = brand?.contact?.address?.trim()
  const footerStyle = brand?.footerStyle || FOOTER_STYLE.STANDARD

  if (footerStyle === FOOTER_STYLE.MINIMAL) {
    return studio || 'ProposalForge'
  }

  if (footerStyle === FOOTER_STYLE.CONTACT) {
    return [studio, email, phone, website, address].filter(Boolean).join('  ·  ')
  }

  return [studio, email, phone].filter(Boolean).join('  ·  ')
}

function pageNumberFlags(position) {
  const resolved = position || PAGE_NUMBER_POSITION.FOOTER_RIGHT
  return {
    showPages: resolved !== PAGE_NUMBER_POSITION.HIDDEN,
    centerPages: resolved === PAGE_NUMBER_POSITION.FOOTER_CENTER,
  }
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
    throw new Error('Brand Kit chrome must not write proposal or template records.')
  }

  if (typeof originalFetch === 'function') {
    return originalFetch(url, init)
  }

  throw new TypeError(`Unexpected fetch: ${href}`)
}

const formSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKitForm.jsx')
const pageSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKit.jsx')
const hookSource = sourceOf('src', 'hooks', 'useUpdateBrandKit.js')
const footerSource = sourceOf('src', 'pdf', 'ProposalFooter.jsx')
const watermarkSource = sourceOf('src', 'pdf', 'ProposalWatermark.jsx')
const pdfBrandSource = sourceOf('src', 'pdf', 'pdfBrand.js')
const surfaceSource = sourceOf('src', 'theme', 'DocumentSurface.jsx')
const chromeSource = sourceOf('src', 'theme', 'DocumentChrome.jsx')
const bridgeSource = sourceOf('src', 'theme', 'brandBridge.js')
const modulesSource = sourceOf('src', 'workspace', 'modules.js')
const proposalModelSource = sourceOf('src', 'models', 'proposal.js')
const templateModelSource = sourceOf('src', 'models', 'template.js')
const brandModelSource = sourceOf('src', 'models', 'brandKit.js')

const chromeStart = formSource.indexOf('kicker="Document chrome"')
const contactStart = formSource.indexOf('kicker="Contact"')
const chromeCard = formSource.slice(chromeStart, contactStart)

assert(
  'A. BrandKitForm authors all four chrome fields',
  chromeStart >= 0 &&
    contactStart > chromeStart &&
    chromeCard.includes('id="watermarkEnabled"') &&
    chromeCard.includes('values.watermarkEnabled') &&
    chromeCard.includes('id="watermarkText"') &&
    chromeCard.includes('values.watermarkText') &&
    chromeCard.includes('id="footerStyle"') &&
    chromeCard.includes('values.footerStyle') &&
    chromeCard.includes('id="pageNumberPosition"') &&
    chromeCard.includes('values.pageNumberPosition') &&
    chromeCard.includes('FOOTER_STYLES.map') &&
    chromeCard.includes('PAGE_NUMBER_POSITIONS.map'),
)

assert(
  'B. Save still uses updateBrandKit / makeBrandKit',
  pageSource.includes('makeBrandKit(kit)') &&
    pageSource.includes('await update(values)') &&
    pageSource.includes('from \'../../hooks/useUpdateBrandKit.js\'') &&
    hookSource.includes('updateBrandKit') &&
    hookSource.includes("from '../services/brandKitService.js'"),
)

const customBrand = makeBrandKit({
  companyName: 'Forge Studio',
  watermarkEnabled: true,
  watermarkText: 'INTERNAL USE',
  contact: {
    email: 'hello@forge.test',
    phone: '020 0000 0000',
    website: 'https://forge.test',
    address: '1 Studio Lane',
  },
})

assert(
  'C. Custom watermark text is returned when enabled',
  resolvePdfWatermark({ status: PROPOSAL_STATUS.DRAFT }, customBrand) ===
    'INTERNAL USE' &&
    resolvePdfWatermark({ status: PROPOSAL_STATUS.SENT }, customBrand) ===
      'INTERNAL USE' &&
    pdfBrandSource.includes('brand.watermarkText?.trim() || \'CONFIDENTIAL\'') &&
    watermarkSource.includes('resolvePdfWatermark(proposal, brand)'),
)

assert(
  'D. Empty watermark text returns CONFIDENTIAL when enabled',
  resolvePdfWatermark(
    { status: PROPOSAL_STATUS.SENT },
    makeBrandKit({ watermarkEnabled: true, watermarkText: '   ' }),
  ) === 'CONFIDENTIAL',
)

assert(
  'E. Watermark off + draft proposal → DRAFT',
  resolvePdfWatermark(
    { status: PROPOSAL_STATUS.DRAFT },
    makeBrandKit({ watermarkEnabled: false, watermarkText: 'IGNORE ME' }),
  ) === 'DRAFT',
)

assert(
  'F. Watermark off + sent proposal → empty string',
  resolvePdfWatermark(
    { status: PROPOSAL_STATUS.SENT },
    makeBrandKit({ watermarkEnabled: false, watermarkText: 'IGNORE ME' }),
  ) === '',
)

const footerBrand = makeBrandKit({
  companyName: 'Forge Studio',
  contact: {
    email: 'hello@forge.test',
    phone: '020 0000 0000',
    website: 'https://forge.test',
    address: '1 Studio Lane',
  },
})
const footerSettings = {
  studioName: 'Settings Studio',
  contactEmail: 'settings@forge.test',
}

assert(
  'G. footerStyle minimal → studio name only',
  contactLine(
    { ...footerBrand, footerStyle: FOOTER_STYLE.MINIMAL },
    footerSettings,
  ) === 'Forge Studio' &&
    footerSource.includes('if (footerStyle === FOOTER_STYLE.MINIMAL)') &&
    footerSource.includes("return studio || 'ProposalForge'"),
)

const contactFooter = contactLine(
  { ...footerBrand, footerStyle: FOOTER_STYLE.CONTACT },
  footerSettings,
)
assert(
  'H. footerStyle contact includes website and address',
  contactFooter.includes('https://forge.test') &&
    contactFooter.includes('1 Studio Lane') &&
    contactFooter.includes('hello@forge.test') &&
    footerSource.includes(
      '[studio, email, phone, website, address].filter(Boolean).join(\'  ·  \')',
    ),
)

const standardFooter = contactLine(
  { ...footerBrand, footerStyle: FOOTER_STYLE.STANDARD },
  footerSettings,
)
assert(
  'I. footerStyle standard is studio + email + phone, not address',
  standardFooter === 'Forge Studio  ·  hello@forge.test  ·  020 0000 0000' &&
    !standardFooter.includes('1 Studio Lane') &&
    !standardFooter.includes('https://forge.test') &&
    footerSource.includes('[studio, email, phone].filter(Boolean).join(\'  ·  \')'),
)

const hiddenPages = pageNumberFlags(PAGE_NUMBER_POSITION.HIDDEN)
assert(
  'J. pageNumberPosition hidden hides page numbers',
  hiddenPages.showPages === false &&
    footerSource.includes('position !== PAGE_NUMBER_POSITION.HIDDEN'),
)

const centerPages = pageNumberFlags(PAGE_NUMBER_POSITION.FOOTER_CENTER)
const rightPages = pageNumberFlags(PAGE_NUMBER_POSITION.FOOTER_RIGHT)
assert(
  'K. footer-center and footer-right preserve existing ProposalFooter behavior',
  centerPages.showPages === true &&
    centerPages.centerPages === true &&
    rightPages.showPages === true &&
    rightPages.centerPages === false &&
    footerSource.includes('position === PAGE_NUMBER_POSITION.FOOTER_CENTER') &&
    footerSource.includes('showPages && centerPages') &&
    footerSource.includes('showPages && !centerPages'),
)

const invalidFooter = validateBrandKit(
  makeBrandKit({ companyName: 'Forge Studio', footerStyle: 'banner' }),
)
const invalidPages = validateBrandKit(
  makeBrandKit({ companyName: 'Forge Studio', pageNumberPosition: 'header' }),
)
assert(
  'L. Invalid footerStyle / pageNumberPosition fail validation',
  invalidFooter.some((error) => error.field === 'footerStyle') &&
    invalidPages.some((error) => error.field === 'pageNumberPosition'),
)

assert(
  'M. Chrome form does not write proposal/template/service records',
  !formSource.includes('updateProposal') &&
    !formSource.includes('createProposal') &&
    !formSource.includes('updateTemplate') &&
    !formSource.includes('updateService') &&
    !formSource.includes('proposalService') &&
    !pageSource.includes('updateProposal'),
)

assert(
  'N. No proposal.assetIds or template.assetIds',
  !formSource.includes('proposal.assetIds') &&
    !formSource.includes('template.assetIds') &&
    !proposalModelSource.includes('assetIds') &&
    !templateModelSource.includes('assetIds'),
)

assert(
  'O. watermarkAssetId remains unused',
  !chromeCard.includes('watermarkAssetId') &&
    !chromeCard.includes('ImageUpload') &&
    !chromeCard.includes('AssetPicker') &&
    brandModelSource.includes('watermarkAssetId'),
)

assert(
  'P. Theme draftWatermark remains independent',
  !formSource.includes('draftWatermark') &&
    !pageSource.includes('draftWatermark') &&
    surfaceSource.includes('tokens.metadata.draftWatermark') &&
    surfaceSource.includes('Draft') &&
    chromeSource.includes('useProposalTheme') &&
    !chromeSource.includes('watermarkEnabled'),
)

const designed = applyDesignToBrand(customBrand, {
  branding: { logo: '', logoLight: '', logoDark: '', icon: '', favicon: '' },
  cover: { backgroundImage: '' },
  colors: { accent: '#111111', text: '', background: '' },
  typography: { headingFont: '', bodyFont: '' },
})
assert(
  'Q. applyDesignToBrand preserves Brand Kit chrome',
  designed.watermarkEnabled === true &&
    designed.watermarkText === 'INTERNAL USE' &&
    designed.footerStyle === customBrand.footerStyle &&
    designed.pageNumberPosition === customBrand.pageNumberPosition &&
    designed.coverStyle === customBrand.coverStyle &&
    bridgeSource.includes('...brand,'),
)

assert(
  'R. H17 compose / Apply helpers / updateProposal are not called',
  !formSource.includes('composeTemplateAssets') &&
    !formSource.includes('composeServiceAssetsForCreate') &&
    !formSource.includes('applyServiceAssetsToTemplate') &&
    !formSource.includes('applyServiceAssetsToProposal') &&
    !formSource.includes('applyServiceComponentsToTemplate') &&
    !formSource.includes('applyServiceComponentsToProposal') &&
    !formSource.includes('updateProposal') &&
    !pageSource.includes('templateBlocks'),
)

await resetBrandKit()
const before = await fetchBrandKit()
const toggled = makeBrandKit({
  ...before,
  watermarkEnabled: !before.watermarkEnabled,
})
assert(
  'Negative. Toggling watermark does not modify coverStyle/headerStyle/spacing',
  toggled.coverStyle === before.coverStyle &&
    toggled.headerStyle === before.headerStyle &&
    toggled.spacing === before.spacing &&
    toggled.coverStyle === COVER_STYLE.MINIMAL &&
    toggled.headerStyle === HEADER_STYLE.STANDARD &&
    toggled.spacing === SPACING_SCALE.DEFAULT &&
    chromeCard.includes('patch({ watermarkEnabled: event.target.checked })') &&
    !chromeCard.includes('coverStyle') &&
    !chromeCard.includes('headerStyle') &&
    !chromeCard.includes('spacing'),
)

const saved = await updateBrandKit({
  ...before,
  watermarkEnabled: true,
  watermarkText: 'SITE COPY',
  footerStyle: FOOTER_STYLE.CONTACT,
  pageNumberPosition: PAGE_NUMBER_POSITION.HIDDEN,
})
assert(
  'S. Unrelated Brand Kit fields remain unchanged by chrome-only edits',
  saved.watermarkEnabled === true &&
    saved.watermarkText === 'SITE COPY' &&
    saved.footerStyle === FOOTER_STYLE.CONTACT &&
    saved.pageNumberPosition === PAGE_NUMBER_POSITION.HIDDEN &&
    saved.companyName === before.companyName &&
    saved.description === before.description &&
    JSON.stringify(saved.logos) === JSON.stringify(before.logos) &&
    JSON.stringify(saved.colors) === JSON.stringify(before.colors) &&
    saved.typography.fontFamily === before.typography.fontFamily &&
    JSON.stringify(saved.contact) === JSON.stringify(before.contact) &&
    JSON.stringify(saved.teamMembers) === JSON.stringify(before.teamMembers) &&
    JSON.stringify(saved.testimonials) === JSON.stringify(before.testimonials) &&
    saved.coverStyle === before.coverStyle &&
    saved.headerStyle === before.headerStyle &&
    saved.spacing === before.spacing,
)

assert(
  'Negative. Brand Kit page does not gain listAssets mount',
  !pageSource.includes('listAssets') &&
    !formSource.includes('listAssets') &&
    !formSource.includes('AssetPicker'),
)

assert(
  'Negative. Existing logo ImageUpload behavior remains unchanged',
  formSource.includes("from '../../components/ImageUpload/ImageUpload.jsx'") &&
    formSource.includes("handleAsset('primary'") &&
    formSource.includes("handleAsset('light'") &&
    formSource.includes("handleAsset('dark'") &&
    formSource.includes("handleAsset('favicon'") &&
    formSource.includes("handleAsset('cover'") &&
    formSource.includes('makeAssetRef({ assetId: asset?.id ?? null, url })') &&
    !chromeCard.includes('<ImageUpload'),
)

assert(
  'Module copy includes watermark and footer',
  modulesSource.includes('watermark and footer') &&
    modulesSource.includes('PDF watermark, footer style and page numbers'),
)

runVerifier(
  'verify-asset-library-ingest.mjs',
  'T. H18.2 Asset Library ingest verifier remains green',
)
runVerifier(
  'verify-asset-library-picker.mjs',
  'U. H18.1 Asset Library picker verifier remains green',
)
runVerifier(
  'verify-proposal-create-asset-composition.mjs',
  'V. H17.8 verifier remains green',
)
runVerifier(
  'verify-proposal-asset-composition.mjs',
  'W. H17.7 verifier remains green',
)
runVerifier(
  'verify-template-asset-composition.mjs',
  'X. H17.6 verifier remains green',
)
runVerifier(
  'verify-proposal-create-service-composition.mjs',
  'Y. H17.5.2 verifier remains green',
)

await resetBrandKit()
globalThis.fetch = originalFetch

console.log('')
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
