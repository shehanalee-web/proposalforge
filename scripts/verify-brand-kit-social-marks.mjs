import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COVER_STYLE,
  FOOTER_STYLE,
  HEADER_STYLE,
  PAGE_NUMBER_POSITION,
  SOCIAL_NETWORK,
  SOCIAL_NETWORK_LABELS,
  SOCIAL_NETWORKS,
  makeBrandKit,
  makeSocialLink,
  validateBrandKit,
} from '../src/models/brandKit.js'
import { resolveSocialLinks } from '../src/blocks/brand.js'
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
    throw new Error('Brand Kit social marks must not write proposal or template records.')
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
const footerSource = sourceOf('src', 'pdf', 'ProposalFooter.jsx')
const stylesSource = sourceOf('src', 'pdf', 'pdfStyles.js')
const portalHeaderSource = sourceOf('src', 'portal', 'PortalHeader.jsx')
const chromeSource = sourceOf('src', 'theme', 'DocumentChrome.jsx')
const resolveSource = sourceOf('src', 'theme', 'resolve.js')
const bridgeSource = sourceOf('src', 'theme', 'brandBridge.js')
const documentSource = sourceOf('src', 'pdf', 'ProposalDocument.jsx')
const fontsSource = sourceOf('src', 'pdf', 'pdfFonts.js')
const pdfSource = sourceOf('src', 'blocks', 'pdf.jsx')
const headerSource = sourceOf('src', 'pdf', 'ProposalHeader.jsx')
const pdfBrandSource = sourceOf('src', 'pdf', 'pdfBrand.js')
const watermarkSource = sourceOf('src', 'pdf', 'ProposalWatermark.jsx')
const activitySource = sourceOf('src', 'pdf', 'ActivityLogDocument.jsx')
const proposalModelSource = sourceOf('src', 'models', 'proposal.js')
const templateModelSource = sourceOf('src', 'models', 'template.js')
const serviceModelSource = sourceOf('src', 'models', 'service.js')
const composeSource = sourceOf('src', 'utils', 'templateBlocks.js')
const createProposalSource = sourceOf('src', 'pages', 'CreateProposal', 'CreateProposal.jsx')
const proposalEditSource = sourceOf('src', 'pages', 'History', 'ProposalEdit.jsx')
const serviceEditorSource = sourceOf('src', 'pages', 'Services', 'ServiceEditor.jsx')
const assetsSource = sourceOf('src', 'pages', 'Assets', 'Assets.jsx')
const verifierSource = sourceOf('scripts', 'verify-brand-kit-social-marks.mjs')

const presenceStart = formSource.indexOf('kicker="Presence"')
const acceptanceStart = formSource.indexOf('kicker="Acceptance"')
const presenceCard = formSource.slice(presenceStart, acceptanceStart)
const contactFn = footerSource.slice(
  footerSource.indexOf('function contactLine'),
  footerSource.indexOf('function ProposalFooter'),
)

assert(
  'A. BrandKitForm still authors socialLinks via existing SOCIAL_NETWORKS',
  presenceStart >= 0 &&
    presenceCard.includes('SOCIAL_NETWORKS.map') &&
    presenceCard.includes('makeSocialLink') &&
    presenceCard.includes('values.socialLinks') &&
    formSource.includes('Handles only — documents pick the right network mark automatically.') &&
    !brandHelperSource.includes('pdfSocial') &&
    brandModelSource.includes('socialLinks'),
)

await resetBrandKit()
const linked = makeSocialLink({
  network: SOCIAL_NETWORK.LINKEDIN,
  handle: '@forge',
})
const blank = makeSocialLink({
  network: SOCIAL_NETWORK.INSTAGRAM,
  handle: '   ',
})
const saved = await updateBrandKit({
  companyName: 'Forge Studio',
  socialLinks: [linked, blank],
})
const reloaded = await fetchBrandKit()
assert(
  'B. updateBrandKit round-trip keeps non-empty socialLinks and drops blank handles',
  saved.socialLinks.length === 1 &&
    reloaded.socialLinks.length === 1 &&
    reloaded.socialLinks[0].network === SOCIAL_NETWORK.LINKEDIN &&
    reloaded.socialLinks[0].handle === '@forge' &&
    SOCIAL_NETWORKS.includes(reloaded.socialLinks[0].network),
)

const invalidNetwork = validateBrandKit({
  companyName: 'Forge Studio',
  socialLinks: [{ id: 'social-bad', network: 'myspace', handle: 'forge' }],
})
assert(
  'C. Invalid social network fails validation',
  invalidNetwork.some((error) => error.field === 'socialLinks.0.network'),
)

const mapped = resolveSocialLinks(
  makeBrandKit({
    companyName: 'Forge Studio',
    socialLinks: [
      makeSocialLink({ network: SOCIAL_NETWORK.LINKEDIN, handle: '@forge' }),
      makeSocialLink({ network: SOCIAL_NETWORK.INSTAGRAM, handle: 'forge.studio' }),
      makeSocialLink({ network: SOCIAL_NETWORK.X, handle: 'forge' }),
      makeSocialLink({ network: SOCIAL_NETWORK.FACEBOOK, handle: 'forge' }),
      makeSocialLink({ network: SOCIAL_NETWORK.YOUTUBE, handle: '@forge' }),
      makeSocialLink({ network: SOCIAL_NETWORK.BEHANCE, handle: 'forge' }),
      makeSocialLink({ network: SOCIAL_NETWORK.DRIBBBLE, handle: 'forge' }),
      makeSocialLink({
        network: SOCIAL_NETWORK.LINKEDIN,
        handle: 'https://www.linkedin.com/company/forge',
      }),
      makeSocialLink({
        network: SOCIAL_NETWORK.OTHER,
        handle: 'http://links.forge.test/studio',
      }),
      makeSocialLink({ network: SOCIAL_NETWORK.OTHER, handle: 'forge' }),
      makeSocialLink({ network: SOCIAL_NETWORK.INSTAGRAM, handle: '  ' }),
    ],
  }),
)
const byNetwork = Object.fromEntries(
  mapped
    .filter((link) => !/^https?:\/\//i.test(link.handle))
    .map((link) => [link.network, link]),
)
assert(
  'D. resolveSocialLinks maps handles, keeps http(s), and skips blanks / hostless Other',
  mapped.length === 9 &&
    byNetwork[SOCIAL_NETWORK.LINKEDIN].href === 'https://www.linkedin.com/in/forge' &&
    byNetwork[SOCIAL_NETWORK.INSTAGRAM].href === 'https://www.instagram.com/forge.studio' &&
    byNetwork[SOCIAL_NETWORK.X].href === 'https://x.com/forge' &&
    byNetwork[SOCIAL_NETWORK.FACEBOOK].href === 'https://www.facebook.com/forge' &&
    byNetwork[SOCIAL_NETWORK.YOUTUBE].href === 'https://www.youtube.com/@forge' &&
    byNetwork[SOCIAL_NETWORK.BEHANCE].href === 'https://www.behance.net/forge' &&
    byNetwork[SOCIAL_NETWORK.DRIBBBLE].href === 'https://dribbble.com/forge' &&
    mapped.some((link) => link.href === 'https://www.linkedin.com/company/forge') &&
    mapped.some((link) => link.href === 'http://links.forge.test/studio') &&
    mapped.every((link) => link.label === SOCIAL_NETWORK_LABELS[link.network]) &&
    !mapped.some((link) => link.network === SOCIAL_NETWORK.OTHER && link.handle === 'forge'),
)

assert(
  'E. ProposalFooter and PortalHeader consume resolveSocialLinks with Link / anchor',
  footerSource.includes("import { resolveSocialLinks } from '../blocks/brand.js'") &&
    footerSource.includes('const social = resolveSocialLinks(brand)') &&
    footerSource.includes('<Link src={link.href}') &&
    footerSource.includes('{link.label}') &&
    stylesSource.includes('footerSocialRow:') &&
    portalHeaderSource.includes("import { resolveSocialLinks } from '../blocks/brand.js'") &&
    portalHeaderSource.includes('const social = resolveSocialLinks(kit)') &&
    portalHeaderSource.includes('<a href={link.href}') &&
    portalHeaderSource.includes('{link.label}'),
)

assert(
  'F. Minimal contact line stays studio-only; social is a sibling row',
  contactFn.includes('if (footerStyle === FOOTER_STYLE.MINIMAL)') &&
    contactFn.includes("return studio || 'ProposalForge'") &&
    !contactFn.includes('socialLinks') &&
    !contactFn.includes('resolveSocialLinks') &&
    footerSource.indexOf('footerSocialRow') > footerSource.indexOf('styles.footerRow') &&
    footerSource.includes('{social.length > 0 ? ('),
)

assert(
  'G. Standard contact line still omits address; contact style still includes it',
  contactFn.includes(
    "[studio, email, phone, website, address].filter(Boolean).join('  ·  ')",
  ) &&
    contactFn.includes("[studio, email, phone].filter(Boolean).join('  ·  ')") &&
    footerSource.includes('brand?.footerStyle') &&
    footerSource.includes('brand?.pageNumberPosition'),
)

assert(
  'H. Empty socialLinks renders no social row',
  resolveSocialLinks(makeBrandKit({ companyName: 'Forge Studio' })).length === 0 &&
    resolveSocialLinks(null).length === 0 &&
    footerSource.includes('{social.length > 0 ? (') &&
    portalHeaderSource.includes('{social.length > 0 ? ('),
)

const designed = applyDesignToBrand(
  makeBrandKit({
    companyName: 'Forge Studio',
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
  'I. applyDesignToBrand preserves socialLinks and H19.1–H19.4 fields',
  designed.socialLinks.length === 1 &&
    designed.socialLinks[0].network === SOCIAL_NETWORK.X &&
    designed.socialLinks[0].handle === 'forge' &&
    designed.headerStyle === HEADER_STYLE.CENTERED &&
    designed.coverStyle === COVER_STYLE.SPLIT &&
    designed.typography.fontFamily === 'inter' &&
    designed.watermarkEnabled === true &&
    designed.watermarkText === 'INTERNAL' &&
    designed.footerStyle === FOOTER_STYLE.CONTACT &&
    designed.pageNumberPosition === PAGE_NUMBER_POSITION.HIDDEN &&
    !bridgeSource.includes('socialLinks') &&
    bridgeSource.includes('...brand,'),
)

assert(
  'J. Cover / header / type paths remain Brand Kit sourced',
  pdfSource.includes('brand?.coverStyle') &&
    headerSource.includes('brand?.headerStyle') &&
    documentSource.includes('resolvePdfFontFamily(brand.typography?.fontFamily)') &&
    fontsSource.includes('registerPdfFonts') &&
    formSource.includes('id="coverStyle"') &&
    formSource.includes('id="headerStyle"') &&
    formSource.includes('id="fontFamily"') &&
    !documentSource.includes('resolveSocialLinks') &&
    !resolveSource.includes('socialLinks'),
)

assert(
  'K. watermarkAssetId remains unauthored; Brand Kit has no asset picker',
  !formSource.includes('watermarkAssetId') &&
    brandModelSource.includes('watermarkAssetId') &&
    !pageSource.includes('listAssets') &&
    !formSource.includes('listAssets') &&
    !formSource.includes('AssetPicker') &&
    !brandHelperSource.includes('listAssets') &&
    !footerSource.includes('listAssets') &&
    !portalHeaderSource.includes('listAssets') &&
    !proposalModelSource.includes('assetIds') &&
    !templateModelSource.includes('assetIds') &&
    serviceModelSource.includes('assetIds'),
)

assert(
  'L. Theme DocumentChrome does not read socialLinks or Brand Kit chrome',
  !chromeSource.includes('socialLinks') &&
    !chromeSource.includes('resolveSocialLinks') &&
    !chromeSource.includes('watermarkEnabled') &&
    !chromeSource.includes('headerStyle') &&
    !chromeSource.includes('footerStyle'),
)

assert(
  'M. No proposal / template / service writes',
  !brandHelperSource.includes('updateProposal') &&
    !footerSource.includes('updateProposal') &&
    !portalHeaderSource.includes('updateProposal') &&
    !brandHelperSource.includes('updateTemplate') &&
    !brandHelperSource.includes('updateService') &&
    !proposalModelSource.includes('socialLinks') &&
    !templateModelSource.includes('socialLinks') &&
    !serviceModelSource.includes('socialLinks'),
)

assert(
  'N. Activity-log PDF remains Helvetica',
  activitySource.includes("fontFamily: 'Helvetica'") &&
    activitySource.includes("fontFamily: 'Helvetica-Bold'") &&
    !activitySource.includes('resolveSocialLinks') &&
    !activitySource.includes('pdfFonts'),
)

assert(
  'O. H17/H18 compose/apply paths untouched',
  composeSource.includes('composeTemplateAssets') &&
    !composeSource.includes('resolveSocialLinks') &&
    !createProposalSource.includes('resolveSocialLinks') &&
    !proposalEditSource.includes('resolveSocialLinks') &&
    !serviceEditorSource.includes('resolveSocialLinks') &&
    assetsSource.includes('handleLibraryUpload') &&
    pdfBrandSource.includes('brand?.watermarkEnabled') &&
    watermarkSource.includes('resolvePdfWatermark(proposal, brand)'),
)

const verifierPrelude = verifierSource.slice(0, verifierSource.indexOf('function assert'))
assert(
  'P. Verifier does not spawn nested H17/H18/H19 suites',
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
