import { DEFAULT_COMPANY_ID, KNOWLEDGE_CATEGORY, KNOWLEDGE_SOURCE, KNOWLEDGE_STATUS, KNOWLEDGE_TYPE } from './types.js'

const ISOLATION_COMPANY_ID = 'company-harborline'
const STAMP = '2026-09-01T12:00:00.000Z'

function item(input) {
  return {
    approvedBy: input.status === KNOWLEDGE_STATUS.APPROVED ? 'demo' : '',
    approvedAt: input.status === KNOWLEDGE_STATUS.APPROVED ? STAMP : null,
    createdAt: STAMP,
    updatedAt: STAMP,
    usageCount: 0,
    lastUsedAt: null,
    sourceId: '',
    tags: [],
    metadata: { demo: true, trust: input.status === KNOWLEDGE_STATUS.APPROVED ? 'company-approved' : 'unverified' },
    ...input,
  }
}

/**
 * Small deterministic demo set. Isolation company records exist only so tests
 * can prove Company B never appears in Company A results.
 *
 * @type {object[]}
 */
export const DEMO_KNOWLEDGE = [
  item({
    id: 'know-demo-studio-profile',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.COMPANY_PROFILE,
    category: KNOWLEDGE_CATEGORY.COMPANY,
    title: 'Company Profile',
    content:
      'ProposalForge Studio is an independent studio producing proposals for agencies, fabricators and creative teams. We help studios turn their process into clear, client-ready documents.',
    tags: ['company', 'profile', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-positioning',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.POSITIONING,
    category: KNOWLEDGE_CATEGORY.COMPANY,
    title: 'Studio positioning',
    content:
      'We write proposals the way a studio actually works: scoped, priced and presented without generic filler. Preferred wording is direct, specific and calm.',
    tags: ['positioning', 'voice', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-service',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.SERVICE,
    category: KNOWLEDGE_CATEGORY.OFFERING,
    title: 'Architectural Model Service',
    content:
      'Physical and digital architectural models for client presentations, planning reviews and exhibition. Typical engagements include massing studies, facade studies and presentation models.',
    tags: ['service', 'models', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-exclusions',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.EXCLUSION,
    category: KNOWLEDGE_CATEGORY.LEGAL,
    title: 'Standard Exclusions',
    content:
      'Unless listed in the proposal, the following are excluded: third-party printing, courier fees, structural engineering, planning submissions, and revisions beyond the agreed round.',
    tags: ['exclusions', 'legal', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-warranty',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.WARRANTY,
    category: KNOWLEDGE_CATEGORY.LEGAL,
    title: 'Standard Warranty',
    content:
      'Workmanship is warranted for 12 months from delivery against defects arising from our manufacture. Wear from handling, site installation by others, and client-supplied materials are not covered.',
    tags: ['warranty', 'legal', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-case-study',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.CASE_STUDY,
    category: KNOWLEDGE_CATEGORY.PROOF,
    title: 'Sample Case Study',
    content:
      'For a waterfront pavilion, we delivered a 1:50 presentation model in six weeks. The client used it in two planning meetings and closed the next design stage without a rewrite of the proposal.',
    tags: ['case-study', 'proof', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-summary',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.APPROVED_SECTION,
    category: KNOWLEDGE_CATEGORY.LANGUAGE,
    title: 'Approved Executive Summary',
    content:
      'This proposal sets out a clear scope, a fixed commercial, and a delivery sequence the client can approve in one sitting. We will produce the agreed model package and support one revision round.',
    tags: ['executive-summary', 'wording', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-terms',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.TERMINOLOGY,
    category: KNOWLEDGE_CATEGORY.LANGUAGE,
    title: 'Brand Terminology',
    content:
      'Preferred: engagement, scope, deliverable, presentation model. Avoid: synergy, best-in-class, leverage, going forward. Say “revision round”, not “unlimited tweaks”.',
    tags: ['terminology', 'voice', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-studio-draft-faq',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.FAQ,
    category: KNOWLEDGE_CATEGORY.LANGUAGE,
    title: 'Draft shipping FAQ',
    content:
      'Who arranges shipping? Draft answer: the studio can arrange crating and freight as an optional add-on. This wording is not approved yet.',
    tags: ['faq', 'draft', 'demo'],
    status: KNOWLEDGE_STATUS.DRAFT,
    source: KNOWLEDGE_SOURCE.MANUAL,
    metadata: { demo: true, trust: 'unverified' },
  }),
  item({
    id: 'know-demo-studio-archived-assumption',
    companyId: DEFAULT_COMPANY_ID,
    type: KNOWLEDGE_TYPE.ASSUMPTION,
    category: KNOWLEDGE_CATEGORY.LEGAL,
    title: 'Archived site-access assumption',
    content:
      'Older assumption: the client provides unrestricted site access during working hours. Retired after the studio moved to workshop-only delivery.',
    tags: ['assumption', 'archived', 'demo'],
    status: KNOWLEDGE_STATUS.ARCHIVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
    metadata: { demo: true, trust: 'unverified' },
  }),
  item({
    id: 'know-demo-harbor-profile',
    companyId: ISOLATION_COMPANY_ID,
    type: KNOWLEDGE_TYPE.COMPANY_PROFILE,
    category: KNOWLEDGE_CATEGORY.COMPANY,
    title: 'Harborline Company Profile',
    content:
      'Harborline Fabrication is a confidential isolation record. This profile must never appear in ProposalForge Studio search or AI context.',
    tags: ['harborline', 'secret-to-studio', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
  item({
    id: 'know-demo-harbor-warranty',
    companyId: ISOLATION_COMPANY_ID,
    type: KNOWLEDGE_TYPE.WARRANTY,
    category: KNOWLEDGE_CATEGORY.LEGAL,
    title: 'Harborline marine warranty',
    content:
      'Harborline warrants marine-grade coatings for 24 months. Isolation copy: salt-spray language unique to Harborline.',
    tags: ['warranty', 'marine', 'demo'],
    status: KNOWLEDGE_STATUS.APPROVED,
    source: KNOWLEDGE_SOURCE.MANUAL,
  }),
]

export const DEMO_ISOLATION_COMPANY_ID = ISOLATION_COMPANY_ID
