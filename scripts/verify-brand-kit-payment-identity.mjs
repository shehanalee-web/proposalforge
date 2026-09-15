import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COVER_STYLE,
  FOOTER_STYLE,
  HEADER_STYLE,
  PAGE_NUMBER_POSITION,
  SOCIAL_NETWORK,
  TAX_MODE,
  makeBrandKit,
  makeSocialLink,
  validateBrandKit,
} from '../src/models/brandKit.js'
import { resolveBankDetails } from '../src/blocks/brand.js'
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
    throw new Error(
      'Brand Kit payment identity must not write proposal or template records.',
    )
  }

  if (typeof originalFetch === 'function') {
    return originalFetch(url, init)
  }

  throw new TypeError(`Unexpected fetch: ${href}`)
}

const formSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKitForm.jsx')
const pageSource = sourceOf('src', 'pages', 'BrandKit', 'BrandKit.jsx')
const brandHelperSource = sourceOf('src', 'blocks', 'brand.js')
const brandModelSource = sourceOf('src', 'models', 'brandKit.js')
const pdfSource = sourceOf('src', 'blocks', 'pdf.jsx')
const screenSource = sourceOf('src', 'blocks', 'screen.jsx')
const termsBlockSource = sourceOf('src', 'layouts', 'blocks', 'TermsBlock.jsx')
const commercialSource = sourceOf(
  'src',
  'components',
  'CommercialBuilder',
  'CommercialBuilder.jsx',
)
const chromeSource = sourceOf('src', 'theme', 'DocumentChrome.jsx')
const resolveSource = sourceOf('src', 'theme', 'resolve.js')
const bridgeSource = sourceOf('src', 'theme', 'brandBridge.js')
const documentSource = sourceOf('src', 'pdf', 'ProposalDocument.jsx')
const fontsSource = sourceOf('src', 'pdf', 'pdfFonts.js')
const headerSource = sourceOf('src', 'pdf', 'ProposalHeader.jsx')
const footerSource = sourceOf('src', 'pdf', 'ProposalFooter.jsx')
const pdfBrandSource = sourceOf('src', 'pdf', 'pdfBrand.js')
const watermarkSource = sourceOf('src', 'pdf', 'ProposalWatermark.jsx')
const activitySource = sourceOf('src', 'pdf', 'ActivityLogDocument.jsx')
const proposalModelSource = sourceOf('src', 'models', 'proposal.js')
const templateModelSource = sourceOf('src', 'models', 'template.js')
const serviceModelSource = sourceOf('src', 'models', 'service.js')
const composeSource = sourceOf('src', 'utils', 'templateBlocks.js')
const createProposalSource = sourceOf(
  'src',
  'pages',
  'CreateProposal',
  'CreateProposal.jsx',
)
const proposalEditSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const serviceEditorSource = sourceOf(
  'src',
  'pages',
  'Services',
  'ServiceEditor.jsx',
)
const assetsSource = sourceOf('src', 'pages', 'Assets', 'Assets.jsx')
const verifierSource = sourceOf(
  'scripts',
  'verify-brand-kit-payment-identity.mjs',
)

const financeStart = formSource.indexOf('kicker="Finance"')
const financeCard = formSource.slice(financeStart)
const termsPdfFn = pdfSource.slice(
  pdfSource.indexOf('export function TermsPdf'),
  pdfSource.indexOf('export function SignaturePdf'),
)
const termsScreenFn = screenSource.slice(
  screenSource.indexOf('export function TermsScreen'),
  screenSource.indexOf('export function SignatureScreen'),
)
const paymentTermsFn = brandHelperSource.slice(
  brandHelperSource.indexOf('export function resolvePaymentTerms'),
  brandHelperSource.indexOf('const BANK_DETAIL_FIELDS'),
)

assert(
  'A. Existing Finance Brand Kit fields are consumed; no new schema fields',
  financeStart >= 0 &&
    financeCard.includes('values.bank.accountName') &&
    financeCard.includes('values.bank.bankName') &&
    financeCard.includes('values.bank.accountNumber') &&
    financeCard.includes('values.bank.sortCode') &&
    financeCard.includes('values.bank.iban') &&
    financeCard.includes('values.bank.swift') &&
    financeCard.includes('values.vatNumber') &&
    financeCard.includes('values.tax.taxId') &&
    brandModelSource.includes('accountName') &&
    brandModelSource.includes('vatNumber') &&
    brandHelperSource.includes('export function resolveBankDetails') &&
    !brandHelperSource.includes('pdfBank') &&
    !brandModelSource.includes('paymentInstructions') &&
    !formSource.includes('resolveBankDetails'),
)

await resetBrandKit()
const saved = await updateBrandKit({
  companyName: 'Forge Studio',
  vatNumber: 'GB123456789',
  bank: {
    accountName: 'Forge Studio Ltd',
    bankName: 'Forge Bank',
    accountNumber: '12345678',
    sortCode: '00-00-00',
    iban: 'GB00FORGE00000000000',
    swift: 'FORGGB2L',
  },
  tax: {
    taxId: 'TAX-99',
    rate: '20',
    mode: TAX_MODE.EXCLUSIVE,
  },
})
const reloaded = await fetchBrandKit()
assert(
  'B. Filled bank/VAT data survives updateBrandKit/makeBrandKit round-trip',
  saved.bank.accountName === 'Forge Studio Ltd' &&
    reloaded.bank.bankName === 'Forge Bank' &&
    reloaded.bank.accountNumber === '12345678' &&
    reloaded.bank.sortCode === '00-00-00' &&
    reloaded.bank.iban === 'GB00FORGE00000000000' &&
    reloaded.bank.swift === 'FORGGB2L' &&
    reloaded.vatNumber === 'GB123456789' &&
    reloaded.tax.taxId === 'TAX-99',
)

const invalidMode = validateBrandKit({
  companyName: 'Forge Studio',
  tax: { mode: 'gross', rate: '20' },
})
const invalidRate = validateBrandKit({
  companyName: 'Forge Studio',
  tax: { mode: TAX_MODE.EXCLUSIVE, rate: '150' },
})
assert(
  'C. Invalid tax.mode and out-of-range tax.rate still fail existing validation',
  invalidMode.some((error) => error.field === 'tax.mode') &&
    invalidRate.some((error) => error.field === 'tax.rate'),
)

const filled = resolveBankDetails(
  makeBrandKit({
    companyName: 'Forge Studio',
    vatNumber: 'GB123456789',
    bank: {
      accountName: 'Forge Studio Ltd',
      bankName: 'Forge Bank',
      accountNumber: '12345678',
      sortCode: '  ',
      iban: 'GB00FORGE00000000000',
      swift: '',
    },
    tax: { taxId: 'TAX-99' },
  }),
)
const byId = Object.fromEntries(filled.map((row) => [row.id, row]))
assert(
  'D. resolveBankDetails omits blanks and preserves filled identity fields',
  filled.length === 6 &&
    byId.accountName.value === 'Forge Studio Ltd' &&
    byId.bankName.value === 'Forge Bank' &&
    byId.accountNumber.value === '12345678' &&
    byId.iban.value === 'GB00FORGE00000000000' &&
    byId.vatNumber.value === 'GB123456789' &&
    byId.taxId.value === 'TAX-99' &&
    !byId.sortCode &&
    !byId.swift &&
    byId.accountName.label === 'Account name' &&
    resolveBankDetails(null).length === 0,
)

assert(
  'E. TermsPdf reads the helper and renders Payment details when identity exists',
  pdfSource.includes('resolveBankDetails') &&
    termsPdfFn.includes('const bank = resolveBankDetails(brand)') &&
    termsPdfFn.includes('Payment details') &&
    termsPdfFn.includes('{row.label}: {row.value}') &&
    termsPdfFn.includes('bank.length > 0'),
)

assert(
  'F. TermsScreen reads the helper and renders the same identity',
  screenSource.includes('resolveBankDetails') &&
    termsScreenFn.includes('const bank = resolveBankDetails(brand)') &&
    termsScreenFn.includes('Payment details') &&
    termsScreenFn.includes('{row.label}: {row.value}'),
)

assert(
  'G. TermsBlock uses the existing Terms flow and exposes the same payment identity',
  termsBlockSource.includes('resolveTermsBody(null, proposal, brand)') &&
    termsBlockSource.includes('resolvePaymentTerms(null, proposal, brand)') &&
    termsBlockSource.includes('resolveBankDetails(brand)') &&
    termsBlockSource.includes('Payment details') &&
    termsBlockSource.includes('{row.label}: {row.value}'),
)

assert(
  'H. Empty bank/VAT produces no Payment details subsection',
  resolveBankDetails(makeBrandKit({ companyName: 'Forge Studio' })).length === 0 &&
    termsPdfFn.includes('{bank.length > 0 ? (') &&
    termsScreenFn.includes('{bank.length > 0 ? (') &&
    termsBlockSource.includes('{bank.length > 0 ? ('),
)

assert(
  'I. Bank-only identity still renders Terms',
  resolveBankDetails(
    makeBrandKit({
      companyName: 'Forge Studio',
      bank: { accountName: 'Forge Studio Ltd' },
    }),
  ).length === 1 &&
    termsPdfFn.includes('if (!body && !payment && bank.length === 0) return null') &&
    termsScreenFn.includes(
      'if (!body && !payment && bank.length === 0) return null',
    ) &&
    termsBlockSource.includes('Terms & conditions'),
)

assert(
  'J. Existing paymentTerms behavior remains unchanged',
  paymentTermsFn.includes("Boolean(instance?.data?.body?.trim()) || Boolean(proposal?.terms?.trim())") &&
    paymentTermsFn.includes("return brand?.paymentTerms?.trim() || ''") &&
    termsPdfFn.includes('Payment terms') &&
    termsPdfFn.includes('<Text style={styles.body}>{payment}</Text>') &&
    termsScreenFn.includes('Payment terms') &&
    termsBlockSource.includes('Payment terms') &&
    pdfSource.indexOf('Payment terms') < pdfSource.indexOf('Payment details'),
)

const designed = applyDesignToBrand(
  makeBrandKit({
    companyName: 'Forge Studio',
    vatNumber: 'GB123456789',
    bank: { accountName: 'Forge Studio Ltd', bankName: 'Forge Bank' },
    tax: { taxId: 'TAX-99' },
    socialLinks: [makeSocialLink({ network: SOCIAL_NETWORK.X, handle: 'forge' })],
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
  'K. applyDesignToBrand preserves bank/VAT and H19.1–H19.5 fields',
  designed.bank.accountName === 'Forge Studio Ltd' &&
    designed.bank.bankName === 'Forge Bank' &&
    designed.vatNumber === 'GB123456789' &&
    designed.tax.taxId === 'TAX-99' &&
    designed.socialLinks[0].handle === 'forge' &&
    designed.headerStyle === HEADER_STYLE.CENTERED &&
    designed.coverStyle === COVER_STYLE.SPLIT &&
    designed.typography.fontFamily === 'inter' &&
    designed.watermarkEnabled === true &&
    designed.watermarkText === 'INTERNAL' &&
    designed.footerStyle === FOOTER_STYLE.CONTACT &&
    designed.pageNumberPosition === PAGE_NUMBER_POSITION.HIDDEN &&
    !bridgeSource.includes('bank') &&
    bridgeSource.includes('...brand,'),
)

assert(
  'L. No proposal.assetIds / template.assetIds; Brand Kit has no asset picker',
  !proposalModelSource.includes('assetIds') &&
    !templateModelSource.includes('assetIds') &&
    serviceModelSource.includes('assetIds') &&
    !formSource.includes('watermarkAssetId') &&
    brandModelSource.includes('watermarkAssetId') &&
    !pageSource.includes('listAssets') &&
    !formSource.includes('listAssets') &&
    !formSource.includes('AssetPicker') &&
    !brandHelperSource.includes('listAssets') &&
    !pdfSource.includes('listAssets'),
)

assert(
  'M. No proposal / template / service bank fields or writes',
  !proposalModelSource.includes('bank') &&
    !templateModelSource.includes('bank') &&
    !serviceModelSource.includes('bank') &&
    !proposalModelSource.includes('vatNumber') &&
    !templateModelSource.includes('vatNumber') &&
    !brandHelperSource.includes('updateProposal') &&
    !pdfSource.includes('updateProposal') &&
    !screenSource.includes('updateProposal') &&
    !termsBlockSource.includes('updateProposal') &&
    !commercialSource.includes('resolveBankDetails'),
)

assert(
  'N. Theme DocumentChrome does not read bank/VAT identity',
  !chromeSource.includes('bank') &&
    !chromeSource.includes('vatNumber') &&
    !chromeSource.includes('resolveBankDetails') &&
    !chromeSource.includes('watermarkEnabled') &&
    !resolveSource.includes('resolveBankDetails'),
)

assert(
  'O. Activity-log PDF remains Helvetica',
  activitySource.includes("fontFamily: 'Helvetica'") &&
    activitySource.includes("fontFamily: 'Helvetica-Bold'") &&
    !activitySource.includes('resolveBankDetails') &&
    !activitySource.includes('pdfFonts'),
)

assert(
  'P. H17/H18 compose/apply paths remain untouched',
  composeSource.includes('composeTemplateAssets') &&
    !composeSource.includes('resolveBankDetails') &&
    !createProposalSource.includes('resolveBankDetails') &&
    !proposalEditSource.includes('resolveBankDetails') &&
    !serviceEditorSource.includes('resolveBankDetails') &&
    assetsSource.includes('handleLibraryUpload') &&
    pdfBrandSource.includes('brand?.watermarkEnabled') &&
    watermarkSource.includes('resolvePdfWatermark(proposal, brand)') &&
    headerSource.includes('brand?.headerStyle') &&
    footerSource.includes('resolveSocialLinks') &&
    documentSource.includes('resolvePdfFontFamily(brand.typography?.fontFamily)') &&
    fontsSource.includes('registerPdfFonts'),
)

const verifierPrelude = verifierSource.slice(
  0,
  verifierSource.indexOf('function assert'),
)
assert(
  'Q. Verifier contains no child_process, spawnSync, or runVerifier',
  !verifierPrelude.includes('child_process') &&
    !verifierPrelude.includes('spawnSync') &&
    !verifierPrelude.includes('runVerifier'),
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
